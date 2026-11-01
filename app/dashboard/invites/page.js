"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useDash } from "@/lib/dash/store";
import { GUEST_STATUS_LABEL, guestStats, guestStatus, kpiItems, responseIndex, guestLabel } from "@/lib/dash/model";
import { fullName, normalize, pctLabel, uid } from "@/lib/dash/format";
import { columnValues } from "@/lib/dash/codes";
import { PASTEL_KEYS, RSVP, pastel } from "@/lib/dash/theme";
import { rsvpFromCell } from "@/lib/dash/importParse";
import { Icon } from "@/components/dash/icons";
import { Btn, Field, GroupChip, InlineEdit, KpiBar, Modal, Popover, RsvpMenu } from "@/components/dash/ui";
import InvitesHeader from "@/components/dash/InvitesTabs";
import MomentsModal from "@/components/dash/MomentsModal";
import GroupEdit from "@/components/dash/GroupEdit";
import GuestsNote from "@/components/dash/GuestsNote";
import { ResizeHandle, useColumnLayout } from "@/components/dash/Columns";
import { ChoiceCell, ColumnModal, FieldHeader } from "@/components/dash/ColumnModal";

// Valeurs qu'on peut proposer pour filtrer par une colonne : les réponses prédéfinies
// si elle en a, sinon les valeurs déjà saisies par les organisateurs (2 à 20, comme pour les groupes)
function fieldFilterValues(field, guests) {
  if (field.kind !== "choice") return columnValues(guests, field.id);
  return (field.options || []).map((o) => ({ key: normalize(o), label: o, n: guests.filter((g) => normalize((g.custom || {})[field.id] || "") === normalize(o)).length }));
}

// Modifier une colonne personnalisée pour toute la sélection : choisir d'abord la colonne, puis la valeur
function BulkColumnMenu({ fields, onApply }) {
  const [open, setOpen] = useState(null); // null fermé | "field" | "value"
  const [field, setField] = useState(null);
  const [text, setText] = useState("");
  const close = () => {
    setOpen(null);
    setField(null);
    setText("");
  };
  return (
    <span className="d-anchor">
      <button type="button" onClick={() => setOpen(open ? null : "field")} aria-haspopup="menu">
        Colonne
      </button>
      <Popover open={open === "field"} onClose={close}>
        {fields.length ? (
          fields.map((f) => (
            <button
              key={f.id}
              type="button"
              className="d-pop-item"
              onClick={() => {
                setField(f);
                setOpen("value");
              }}
            >
              <span className="d-pop-label">{f.name}</span>
            </button>
          ))
        ) : (
          <span className="d-pop-label d-muted d-small" style={{ padding: "4px 8px" }}>
            Pas encore de colonne ajoutée.
          </span>
        )}
      </Popover>
      <Popover open={open === "value"} onClose={close}>
        {field?.kind === "choice" ? (
          <>
            {(field.options || []).map((o) => (
              <button
                key={o}
                type="button"
                className="d-pop-item"
                onClick={() => {
                  onApply(field, o);
                  close();
                }}
              >
                <span className="d-pop-label">{o}</span>
              </button>
            ))}
            <button
              type="button"
              className="d-pop-item"
              onClick={() => {
                onApply(field, null);
                close();
              }}
            >
              <span className="d-pop-label d-muted">Effacer</span>
            </button>
          </>
        ) : (
          <form
            style={{ display: "flex", gap: 6, padding: "4px 2px" }}
            onSubmit={(e) => {
              e.preventDefault();
              onApply(field, text.trim() || null);
              close();
            }}
          >
            <input
              className="d-input"
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`Valeur pour « ${field?.name} »`}
              aria-label={`Valeur pour ${field?.name}`}
              style={{ minWidth: 170 }}
            />
            <Btn type="submit" small>
              Appliquer
            </Btn>
          </form>
        )}
      </Popover>
    </span>
  );
}

const FILTER_STATUSES = [
  { id: "oui", label: "Vient" },
  { id: "non", label: "Ne vient pas" },
  { id: "attente", label: "En attente" },
  { id: "non_invite", label: "Non invité" },
];

function StatusChips({ value, onChange }) {
  return (
    <div className="d-filters">
      {FILTER_STATUSES.map((st) => (
        <button key={st.id} type="button" className={`d-gfilter-chip${value === st.id ? " is-on" : ""}`} aria-pressed={value === st.id} onClick={() => onChange(value === st.id ? null : st.id)}>
          {value === st.id ? <Icon name="check" size={12} sw={3} /> : null}
          {st.label}
        </button>
      ))}
    </div>
  );
}

function splitName(s) {
  const parts = String(s || "").trim().split(/\s+/);
  return { first_name: parts.shift() || "", last_name: parts.join(" ") };
}

const TEXT_KEYS = ["diet", "address", "email", "phone"];
const RSVP_RANK = { oui: 0, attente: 1, non: 2, non_invite: 3 };
const collator = new Intl.Collator("fr", { numeric: true, sensitivity: "base" });

// Texte collé depuis un tableur : tabulations entre colonnes, retours à la ligne entre lignes,
// guillemets autour d'une cellule qui contient elle-même un retour à la ligne
function parseTsv(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let quoted = false;
  const s = String(text || "").replace(/\r\n?/g, "\n");
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"' && cur === "") quoted = true;
    else if (ch === "\t") {
      row.push(cur);
      cur = "";
    } else if (ch === "\n") {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else cur += ch;
  }
  if (cur !== "" || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

function SortItems({ dir, onSort, rsvp }) {
  return (
    <>
      <button type="button" className={`d-pop-item${dir === 1 ? " is-on" : ""}`} onClick={() => onSort(1)}>
        <span className="d-pop-label">
          <Icon name="arrowDown" size={14} sw={2} />
          {rsvp ? "Trier : « Vient » en premier" : "Trier de A à Z"}
        </span>
      </button>
      <button type="button" className={`d-pop-item${dir === -1 ? " is-on" : ""}`} onClick={() => onSort(-1)}>
        <span className="d-pop-label">
          <Icon name="arrowUp" size={14} sw={2} />
          {rsvp ? "Trier : « Non invité » en premier" : "Trier de Z à A"}
        </span>
      </button>
      {dir ? (
        <button type="button" className="d-pop-item" onClick={() => onSort(0)}>
          <span className="d-pop-label">
            <Icon name="x" size={14} sw={2.2} />
            Retirer le tri
          </span>
        </button>
      ) : null}
    </>
  );
}

// Menu de fin de ligne : retirer l'invité de la liste
function RowMenu({ guest, label }) {
  const dash = useDash();
  const [open, setOpen] = useState(false);
  return (
    <span className="d-anchor">
      <button type="button" className="d-icon-btn d-row-menu" aria-label={`Options de ${label}`} onClick={() => setOpen((o) => !o)}>
        <Icon name="dots" size={16} sw={2.4} />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} align="right">
        <Link href={`/dashboard/invites/${guest.id}`} className="d-pop-item">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Icon name="external" size={14} />
            Voir la fiche
          </span>
        </Link>
        <button
          type="button"
          className="d-pop-item is-danger"
          onClick={() => {
            setOpen(false);
            if (window.confirm(`Retirer ${label} de la liste ?`)) dash.remove("guests", guest.id);
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Icon name="trash" size={14} />
            Retirer de la liste
          </span>
        </button>
      </Popover>
    </span>
  );
}

function GroupCell({ guest, group, groups, label }) {
  const dash = useDash();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const close = () => {
    setOpen(false);
    setCreating(false);
    setName("");
  };
  const create = async (e) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    const exists = groups.find((g) => normalize(g.name) === normalize(n));
    let id = exists?.id;
    if (!id) {
      id = uid();
      const color = PASTEL_KEYS[groups.length % PASTEL_KEYS.length];
      await dash.insert("guest_groups", { id, name: n, color, position: groups.length });
    }
    dash.update("guests", guest.id, { group_id: id });
    close();
  };
  return (
    <span className="d-anchor">
      <GroupChip group={group} onClick={() => (open ? close() : setOpen(true))} />
      <Popover open={open} onClose={close}>
        <span className="d-pop-label d-small d-muted" style={{ padding: "4px 8px" }}>
          Groupe de {label}
        </span>
        {groups.map((g) => (
          <button
            key={g.id}
            type="button"
            className={`d-pop-item${g.id === guest.group_id ? " is-on" : ""}`}
            onClick={() => {
              dash.update("guests", guest.id, { group_id: g.id });
              close();
            }}
          >
            <GroupChip group={g} />
            {g.id === guest.group_id ? <Icon name="check" size={14} sw={2.2} /> : null}
          </button>
        ))}
        {guest.group_id ? (
          <button
            type="button"
            className="d-pop-item"
            onClick={() => {
              dash.update("guests", guest.id, { group_id: null });
              close();
            }}
          >
            <span className="d-pop-label">Sans groupe</span>
          </button>
        ) : null}
        {creating ? (
          <form onSubmit={create} style={{ display: "flex", gap: 6, padding: "4px 2px" }}>
            <input className="d-input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du groupe" maxLength={60} aria-label="Nom du nouveau groupe" style={{ minWidth: 150 }} />
            <Btn type="submit" small disabled={!name.trim()}>
              Créer
            </Btn>
          </form>
        ) : (
          <button type="button" className="d-pop-item" onClick={() => setCreating(true)}>
            <span className="d-pop-label">
              <Icon name="plus" size={14} sw={2.2} />
              Nouveau groupe
            </span>
          </button>
        )}
        <span style={{ height: 1, background: "var(--d-line)", margin: "4px 2px" }} />
        <button
          type="button"
          className="d-pop-item is-danger"
          onClick={() => {
            close();
            if (window.confirm(`Retirer ${label} de la liste ?`)) dash.remove("guests", guest.id);
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Icon name="trash" size={14} />
            Retirer de la liste
          </span>
        </button>
      </Popover>
    </span>
  );
}

// En-tête d'une colonne du tableau : un clic ouvre « Renommer » et « Supprimer » (sur toutes les colonnes, pas seulement les ajoutées)
function ColumnHead({ col, onRename, onRemove, removeLabel, extraItems }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(col.label);
  if (editing) {
    const save = () => {
      setEditing(false);
      const v = draft.trim();
      if (v && v !== col.label) onRename(v);
    };
    return (
      <input
        className="d-inline-input"
        autoFocus
        value={draft}
        maxLength={40}
        aria-label={`Nouveau nom de la colonne ${col.label}`}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setEditing(false);
        }}
        style={{ width: 110 }}
      />
    );
  }
  return (
    <span className="d-anchor">
      <button type="button" className="d-link d-field-head" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        {col.label}
        <Icon name="chevDown" size={11} sw={2.2} />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} align="right">
        <button
          type="button"
          className="d-pop-item"
          onClick={() => {
            setOpen(false);
            setDraft(col.label);
            setEditing(true);
          }}
        >
          <span className="d-pop-label">
            <Icon name="pencil" size={14} sw={2} />
            Renommer la colonne
          </span>
        </button>
        {extraItems ? (
          <span style={{ display: "contents" }} onClick={() => setOpen(false)}>
            {extraItems}
          </span>
        ) : null}
        {onRemove ? (
          <button
            type="button"
            className="d-pop-item is-danger"
            onClick={() => {
              setOpen(false);
              onRemove();
            }}
          >
            <span className="d-pop-label">
              <Icon name="trash" size={14} sw={2} />
              {removeLabel || "Supprimer la colonne"}
            </span>
          </button>
        ) : null}
      </Popover>
    </span>
  );
}

function AddGuests({ onClose }) {
  const dash = useDash();
  const { groups, events, guests } = dash.data;
  const [names, setNames] = useState("");
  const [groupId, setGroupId] = useState(groups[0]?.id || "");
  const [invitedTo, setInvitedTo] = useState(events.map((e) => e.id));
  const lines = names
    .split(/\n|;/)
    .map((l) => l.trim())
    .filter(Boolean);

  async function save(e) {
    e.preventDefault();
    if (!lines.length) return;
    const rows = lines.map((l, i) => ({ ...splitName(l), group_id: groupId || null, custom: {}, position: guests.length + i }));
    const created = await dash.insert("guests", rows);
    const responses = [];
    for (const g of created) for (const ev of events) responses.push({ guest_id: g.id, event_id: ev.id, status: invitedTo.includes(ev.id) ? "attente" : "non_invite", updated_at: new Date().toISOString() });
    if (responses.length) await dash.insert("guest_responses", responses);
    onClose();
  }

  return (
    <Modal
      title="Ajouter des invités"
      onClose={onClose}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>
            Annuler
          </Btn>
          <Btn onClick={save} disabled={!lines.length}>
            {lines.length > 1 ? `Ajouter ${lines.length} invités` : "Ajouter l'invité"}
          </Btn>
        </>
      }
    >
      <form className="d-col" onSubmit={save}>
        <Field label="Prénom et nom" hint="Un invité par ligne. Les enfants et les +1 comptent chacun pour un invité.">
          <textarea className="d-textarea" value={names} onChange={(e) => setNames(e.target.value)} placeholder={"Claire Morel\nPierre Morel"} autoFocus />
        </Field>
        <Field label="Groupe">
          <select className="d-select" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
            <option value="">Sans groupe</option>
          </select>
        </Field>
        <Field label="Invités à" group>
          <div className="d-filters">
            {events.map((ev) => {
              const on = invitedTo.includes(ev.id);
              return (
                <button key={ev.id} type="button" className={`d-pill${on ? " is-on" : ""}`} aria-pressed={on} onClick={() => setInvitedTo((x) => (on ? x.filter((i) => i !== ev.id) : [...x, ev.id]))}>
                  {on ? <Icon name="check" size={13} sw={2.2} /> : null}
                  {ev.name}
                </button>
              );
            })}
          </div>
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

// Téléphone : une ligne par invité, qui mène à la fiche, avec la pastille de son groupe (artboard 1a)
function GuestCard({ guest: g, events, idx, byId, groupById }) {
  const r = idx.get(g.id) || {};
  const host = g.plus_one_of ? byId.get(g.plus_one_of) : null;
  const status = guestStatus(r, events);
  const label = guestLabel(g, byId) || (host ? `+1 de ${fullName(host)}` : "Sans nom");
  const group = groupById.get(g.group_id);
  const p = pastel(group?.color);
  const sub = [g.age ? `${g.age} ans` : null, host && !fullName(g) ? "À nommer" : null].filter(Boolean).join(" · ");
  const inner = (
    <>
      <span className="d-gavatar" style={{ background: group ? p.bg : "#e4e2dc" }} aria-hidden="true">
        {(label || "?").charAt(0).toUpperCase()}
      </span>
      <span className="d-gcard-name">
        <strong style={status === "non" ? { textDecoration: "line-through", color: "var(--d-muted)" } : undefined}>{label}</strong>
        <span className="d-guest-sub">
          <GroupChip group={group} />
          {sub ? <span>{sub}</span> : null}
        </span>
      </span>
      <span className={`d-gcard-status is-${status}`}>{GUEST_STATUS_LABEL[status]}</span>
    </>
  );
  return (
    <Link href={`/dashboard/invites/${g.id}`} className="d-gcard d-gcard-row">
      {inner}
    </Link>
  );
}

export default function Invites() {
  const dash = useDash();
  const data = dash.data;
  const { guests, groups, events, fields, wedding } = data;
  const [moments, setMoments] = useState(false);
  const [groupFilter, setGroupFilter] = useState(null);
  const [fieldFilter, setFieldFilter] = useState(null);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [addingCol, setAddingCol] = useState(false);
  const [bulkMenu, setBulkMenu] = useState(null); // "groupe" | "moment"
  // Un seul bouton « Filtres » (artboards 1a3, ordinateur et téléphone) : groupe, présence, moment, colonnes
  const [filtering, setFiltering] = useState(false);
  const [statusFilter, setStatusFilter] = useState(null);
  const [momentFilter, setMomentFilter] = useState({}); // { [eventId]: statut }

  // Une colonne supprimée ne reste pas filtrée
  const activeFieldFilter = fieldFilter && fields.some((f) => f.id === fieldFilter.fieldId) ? fieldFilter : null;
  const idx = useMemo(() => responseIndex(data.responses), [data.responses]);
  const byId = useMemo(() => new Map(guests.map((g) => [g.id, g])), [guests]);
  const groupById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);

  const inFieldFilter = (g) => !activeFieldFilter || normalize((g.custom || {})[activeFieldFilter.fieldId] || "") === activeFieldFilter.key;
  const base = guests;
  const q = normalize(query);
  const inStatus = (g) => !statusFilter || guestStatus(idx.get(g.id) || {}, events) === statusFilter;
  const inMoments = (g) => Object.entries(momentFilter).every(([evId, st]) => !events.some((e) => e.id === evId) || ((idx.get(g.id) || {})[evId] || "non_invite") === st);
  const matches = (g) => (!groupFilter || g.group_id === groupFilter) && inFieldFilter(g) && inStatus(g) && inMoments(g) && (!q || normalize(`${guestLabel(g, byId)} ${g.email || ""}`).includes(q));
  // Texte d'une cellule, tel qu'on le copie ou qu'on le trie
  const statusOf = (g, evId) => (idx.get(g.id) || {})[evId] || "non_invite";
  const cellText = (key, g) => {
    if (key === "name") return fullName(g);
    if (key.startsWith("ev:")) return RSVP[statusOf(g, key.slice(3))]?.label || "";
    if (key.startsWith("field:")) return String((g.custom || {})[key.slice(6)] ?? "");
    if (TEXT_KEYS.includes(key)) return g[key] || "";
    return "";
  };
  // Tri par colonne (menu de l'en-tête) : les cellules vides passent à la fin
  const [sort, setSort] = useState(null); // { key, dir: 1 | -1 }
  const filtered = base.filter((g) => matches(g));
  const shown = sort
    ? [...filtered].sort((a, b) => {
        if (sort.key.startsWith("ev:")) return (RSVP_RANK[statusOf(a, sort.key.slice(3))] - RSVP_RANK[statusOf(b, sort.key.slice(3))]) * sort.dir;
        const x = cellText(sort.key, a).trim();
        const y = cellText(sort.key, b).trim();
        if (!x !== !y) return x ? -1 : 1;
        return collator.compare(x, y) * sort.dir;
      })
    : filtered;
  const sortItems = (key) => <SortItems dir={sort?.key === key ? sort.dir : 0} rsvp={key.startsWith("ev:")} onSort={(dir) => setSort(dir ? { key, dir } : null)} />;
  const filterCount = (groupFilter ? 1 : 0) + (statusFilter ? 1 : 0) + Object.keys(momentFilter).length + (activeFieldFilter ? 1 : 0);
  const clearFilters = () => {
    setGroupFilter(null);
    setStatusFilter(null);
    setMomentFilter({});
    setFieldFilter(null);
  };
  // Sélection : cases à cocher, « Tout sélectionner » (tous les invités affichés, filtres compris),
  // et Maj + clic sur une case pour cocher toute une plage d'un coup (comme un tableur)
  const [selected, setSelected] = useState({});
  const lastClickRef = useRef(null);
  const checkboxRefs = useRef(new Map()); // id -> <input> : pour déplacer le focus avec ↑/↓
  // Glisser : appuyer sur une ligne (ou sa case) puis passer sur d'autres lignes leur donne le même état.
  // Depuis la case, la sélection part tout de suite ; ailleurs sur la ligne, seulement quand la souris
  // atteint une autre ligne, pour qu'un simple clic sur le nom ou un statut garde son effet.
  const dragRef = useRef(null); // { on, lastIdx }
  const pendingRef = useRef(null); // { id, on, rowIdx } : appui hors de la case, pas encore glissé
  const skipClickRef = useRef(false); // le clic qui suit l'appui est déjà traité
  useEffect(() => {
    const end = () => {
      const dragged = !!dragRef.current;
      dragRef.current = null;
      pendingRef.current = null;
      document.body.style.userSelect = "";
      if (dragged) skipClickRef.current = true;
      setTimeout(() => {
        skipClickRef.current = false;
      }, 0);
    };
    // Après un glisser, le clic qui suit ne doit pas ouvrir le nom ou un statut relâché dessous
    const swallow = (e) => {
      if (skipClickRef.current && !e.target.closest?.("input.d-check")) {
        e.stopPropagation();
        e.preventDefault();
      }
    };
    document.addEventListener("mouseup", end);
    document.addEventListener("click", swallow, true);
    return () => {
      document.removeEventListener("mouseup", end);
      document.removeEventListener("click", swallow, true);
    };
  }, []);
  const rowMouseDown = (e, g, rowIdx) => {
    // La case a sa propre gestion ; dans un champ en cours d'édition, on laisse sélectionner du texte
    if (e.button !== 0 || e.shiftKey || e.target.closest("input, textarea, select")) return;
    pendingRef.current = { id: g.id, on: !selected[g.id], rowIdx };
  };
  const dragOver = (rowIdx) => {
    const p = pendingRef.current;
    if (p && !dragRef.current && rowIdx !== p.rowIdx) {
      pendingRef.current = null;
      dragRef.current = { on: p.on, lastIdx: p.rowIdx };
      document.body.style.userSelect = "none";
      window.getSelection()?.removeAllRanges();
      document.activeElement?.blur?.();
    }
    const d = dragRef.current;
    if (!d || d.lastIdx === rowIdx) return;
    const [a, b] = [d.lastIdx, rowIdx].sort((x, y) => x - y);
    setSelected((x) => {
      const next = { ...x };
      for (let i = a; i <= b; i += 1) if (shown[i]) next[shown[i].id] = d.on;
      return next;
    });
    d.lastIdx = rowIdx;
    lastClickRef.current = rowIdx;
  };
  const toggle = (id) => setSelected((x) => ({ ...x, [id]: !x[id] }));
  const toggleWithRange = (id, index, shiftKey) => {
    if (shiftKey && lastClickRef.current !== null) {
      const [a, b] = [lastClickRef.current, index].sort((x, y) => x - y);
      const turnOn = !selected[id];
      setSelected((x) => {
        const next = { ...x };
        for (let i = a; i <= b; i += 1) next[shown[i].id] = turnOn;
        return next;
      });
    } else {
      toggle(id);
    }
    lastClickRef.current = index;
  };
  const selIds = shown.filter((g) => selected[g.id]).map((g) => g.id);
  const allSelected = shown.length > 0 && selIds.length === shown.length;
  const selectAll = () => setSelected(Object.fromEntries(shown.map((g) => [g.id, true])));
  const clearSel = () => {
    setSelected({});
    setBulkMenu(null);
  };
  const ok = (text) => dash.setToast({ kind: "ok", text });
  const n = (k, one, many) => `${k} ${k > 1 ? many : one}`;

  async function bulkRemove() {
    const everyone = selIds.length === guests.length;
    const msg = everyone
      ? `Supprimer toute la liste (${n(selIds.length, "invité", "invités")}) ? Leurs réponses seront effacées. Cette action est définitive.`
      : `Retirer ${n(selIds.length, "invité", "invités")} de la liste ? Leurs réponses seront effacées.`;
    if (!window.confirm(msg)) return;
    const ids = selIds;
    clearSel();
    if (await dash.removeGuests(ids)) ok(`${n(ids.length, "invité retiré", "invités retirés")}.`);
  }
  async function bulkGroup(groupId) {
    const ids = selIds;
    const name = groupId ? groupById.get(groupId)?.name : null;
    clearSel();
    if (await dash.updateGuests(ids, { group_id: groupId })) ok(name ? `${n(ids.length, "invité déplacé", "invités déplacés")} dans « ${name} ».` : `${n(ids.length, "invité", "invités")} sans groupe.`);
  }
  async function bulkMoment(ev, invite) {
    const ids = invite ? selIds.filter((id) => ((idx.get(id) || {})[ev.id] || "non_invite") === "non_invite") : selIds;
    if (!invite && !window.confirm(`Ne plus inviter ${n(ids.length, "personne", "personnes")} à « ${ev.name} » ? Leurs réponses à ce moment seront effacées.`)) return;
    clearSel();
    if (ids.length && (await dash.setResponses(ids, ev.id, invite ? "attente" : "non_invite"))) ok(invite ? `${n(ids.length, "invité", "invités")} à « ${ev.name} ».` : `${n(ids.length, "invité retiré", "invités retirés")} de « ${ev.name} ».`);
  }
  async function bulkField(field, value) {
    const ids = selIds;
    clearSel();
    await Promise.all(
      ids.map((id) => {
        const custom = { ...(byId.get(id)?.custom || {}) };
        if (value) custom[field.id] = value;
        else delete custom[field.id];
        return dash.update("guests", id, { custom });
      }),
    );
    ok(value ? `${n(ids.length, "invité modifié", "invités modifiés")} · « ${field.name} » : ${value}.` : `${n(ids.length, "invité modifié", "invités modifiés")} · « ${field.name} » effacée.`);
  }

  // Valeur brute d'une cellule, pour pouvoir la remettre telle quelle (annuler)
  const rawOf = (g, key) => {
    if (key === "name") return { first_name: g.first_name || "", last_name: g.last_name || "" };
    if (key.startsWith("ev:")) return statusOf(g, key.slice(3));
    if (key.startsWith("field:")) return (g.custom || {})[key.slice(6)] ?? null;
    return g[key] ?? null;
  };
  // Annuler / rétablir : chaque geste (saisie, collage, effacement, statut) est un pas de l'historique
  const undoRef = useRef([]); // [{ before: [{ id, key, value }], after: [...] }]
  const redoRef = useRef([]);

  // Écrit des valeurs brutes : une seule mise à jour par invité, les statuts groupés par moment
  async function applyValues(list, record = true) {
    const patches = new Map();
    const statuses = new Map(); // "eventId|statut" -> ids
    const step = { before: [], after: [] };
    for (const { id, key, value } of list) {
      const g = byId.get(id);
      if (!g) continue;
      const before = rawOf(g, key);
      if (JSON.stringify(before) === JSON.stringify(value)) continue;
      step.before.push({ id, key, value: before });
      step.after.push({ id, key, value });
      if (key.startsWith("ev:")) {
        const k = `${key.slice(3)}|${value}`;
        statuses.set(k, [...(statuses.get(k) || []), id]);
        continue;
      }
      const p = patches.get(id) || {};
      if (key === "name") Object.assign(p, value);
      else if (key.startsWith("field:")) {
        const custom = { ...(p.custom || g.custom || {}) };
        if (value) custom[key.slice(6)] = value;
        else delete custom[key.slice(6)];
        p.custom = custom;
      } else p[key] = value;
      patches.set(id, p);
    }
    if (!step.after.length) return 0;
    if (record) {
      undoRef.current = [...undoRef.current.slice(-99), step];
      redoRef.current = [];
    }
    await Promise.all([...patches].map(([id, p]) => dash.update("guests", id, p)));
    for (const [k, ids] of statuses) {
      const [evId, st] = k.split("|");
      await dash.setResponses(ids, evId, st);
    }
    return step.after.length;
  }

  // Texte saisi ou collé → valeur brute ; les cellules qui n'acceptent pas le texte sont ignorées
  function writeCells(list) {
    const values = [];
    for (const { g, key, text } of list) {
      const v = String(text ?? "").trim();
      if (key.startsWith("ev:")) {
        const st = rsvpFromCell(v);
        if (st) values.push({ id: g.id, key, value: st });
      } else if (key === "name") {
        if (v) values.push({ id: g.id, key, value: splitName(v) });
      } else if (TEXT_KEYS.includes(key)) values.push({ id: g.id, key, value: v || null });
      else if (key.startsWith("field:")) {
        const f = fields.find((x) => x.id === key.slice(6));
        if (!f) continue;
        const value = f.kind === "choice" && v ? (f.options || []).find((o) => normalize(o) === normalize(v)) : v;
        if (v && !value) continue; // une colonne à choix n'accepte que ses options
        values.push({ id: g.id, key, value: value || null });
      }
    }
    return applyValues(values);
  }

  const historyStep = async (from, to, word) => {
    const step = from.current.pop();
    if (!step) return;
    to.current = [...to.current, step];
    await applyValues(from === undoRef ? step.before : step.after, false);
    const n = step.after.length;
    ok(`${n > 1 ? `${n} modifications` : "Modification"} ${word}.`);
  };
  const historyRef = useRef(null);
  historyRef.current = {
    undo: () => historyStep(undoRef, redoRef, undoRef.current.at(-1)?.after.length > 1 ? "annulées" : "annulée"),
    redo: () => historyStep(redoRef, undoRef, redoRef.current.at(-1)?.after.length > 1 ? "rétablies" : "rétablie"),
  };
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k !== "z" && k !== "y") return;
      // Dans un champ en cours de saisie, le navigateur annule la frappe lui-même
      if (e.target.matches?.("input:not(.d-check), textarea, select, [contenteditable=true]")) return;
      e.preventDefault();
      if (k === "y" || e.shiftKey) historyRef.current.redo();
      else historyRef.current.undo();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Ligne vide en bas du tableau : on tape un nom, Entrée, l'invité est créé (invité à tous les moments)
  const [newName, setNewName] = useState("");
  async function addRow() {
    const v = newName.trim();
    if (!v) return;
    setNewName("");
    const created = await dash.insert("guests", [{ ...splitName(v), group_id: groupFilter || null, custom: {}, position: guests.length }]);
    const now = new Date().toISOString();
    const responses = created.flatMap((g) => events.map((ev) => ({ guest_id: g.id, event_id: ev.id, status: "attente", updated_at: now })));
    if (responses.length) await dash.insert("guest_responses", responses);
    // La ligne de saisie reste en vue pour enchaîner les noms
    requestAnimationFrame(() => sheetRef.current?.querySelector(".d-add-input")?.scrollIntoView({ block: "nearest" }));
  }

  // Pied du tableau : un total par colonne, calculé sur les invités affichés
  const footFor = (c) => {
    if (c.key === "name") return n(shown.length, "invité", "invités");
    if (c.event) {
      const count = (st) => shown.filter((g) => statusOf(g, c.event.id) === st).length;
      const oui = count("oui");
      const att = count("attente");
      return (
        <span className="d-foot-stack">
          <b>{n(oui, "vient", "viennent")}</b>
          {att ? <span>{att} en attente</span> : null}
        </span>
      );
    }
    if (c.key.startsWith("field:") || TEXT_KEYS.includes(c.key)) {
      const filled = shown.filter((g) => cellText(c.key, g).trim()).length;
      return filled ? <span className="d-foot-muted">{n(filled, "rempli", "remplis")}</span> : null;
    }
    return null;
  };

  // Tableur : une cellule active (flèches, Tab, Entrée pour modifier, taper pour remplacer),
  // une plage (Maj + flèches, Maj + clic), copier-coller avec les autres tableurs
  const sheetRef = useRef(null);
  // Plein écran : le tableau occupe tout l'écran, prêt pour le clavier ; Échap en sort
  const [full, setFull] = useState(false);
  useEffect(() => {
    if (!full) return undefined;
    document.body.style.overflow = "hidden";
    if (!sheetRef.current?.contains(document.activeElement)) {
      (sheetRef.current?.querySelector('td[data-r="0"][data-c="1"] button') || sheetRef.current)?.focus();
    }
    const onKey = (e) => {
      if (e.key !== "Escape" || document.querySelector(".d-pop")) return;
      if (e.target.matches?.("input:not(.d-check), textarea, select")) return; // Échap annule d'abord la saisie
      setFull(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [full]);
  const [cell, setCell] = useState(null); // { r, c }
  const [anchor, setAnchor] = useState(null);
  const extendingRef = useRef(false);
  const range = cell && anchor ? { r0: Math.min(cell.r, anchor.r), r1: Math.max(cell.r, anchor.r), c0: Math.min(cell.c, anchor.c), c1: Math.max(cell.c, anchor.c) } : null;
  const inRange = (r, c) => !!range && r >= range.r0 && r <= range.r1 && c >= range.c0 && c <= range.c1;
  const focusCell = (r, c) => {
    const td = sheetRef.current?.querySelector(`td[data-r="${r}"][data-c="${c}"]`);
    if (!td) return;
    (td.querySelector("input.d-check, button.d-inline, button") || td).focus();
  };
  const goTo = (r, c, extend) => {
    const nr = Math.max(0, Math.min(shown.length - 1, r));
    const nc = Math.max(0, Math.min(cols.columns.length - 1, c));
    extendingRef.current = !!extend;
    setCell({ r: nr, c: nc });
    if (!extend) setAnchor({ r: nr, c: nc });
    focusCell(nr, nc);
    extendingRef.current = false;
  };
  const cellFocus = (r, c) => {
    setCell({ r, c });
    if (!extendingRef.current) setAnchor({ r, c });
  };
  const rangeCells = () => {
    if (!range) return [];
    const out = [];
    for (let r = range.r0; r <= range.r1; r += 1) for (let c = range.c0; c <= range.c1; c += 1) if (shown[r] && cols.columns[c]) out.push({ g: shown[r], key: cols.columns[c].key, r, c });
    return out;
  };
  const onSheetKey = (e) => {
    if (!cell || e.target.closest(".d-pop, .d-add-row")) return;
    const editing = e.target.matches("input:not(.d-check), textarea, select");
    if (!editing && e.defaultPrevented) return; // déjà traité (↑/↓ sur une case à cocher)
    if (editing) {
      // Fin d'édition : Entrée descend, Tab passe à droite, Échap reste sur la cellule
      if (e.key === "Enter" && !e.shiftKey) setTimeout(() => goTo(cell.r + 1, cell.c), 0);
      else if (e.key === "Escape") setTimeout(() => focusCell(cell.r, cell.c), 0);
      else if (e.key === "Tab") {
        e.preventDefault();
        goTo(cell.r, cell.c + (e.shiftKey ? -1 : 1));
      }
      return;
    }
    const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (moves[e.key]) {
      e.preventDefault();
      goTo(cell.r + moves[e.key][0], cell.c + moves[e.key][1], e.shiftKey);
    } else if (e.key === "Tab") {
      const next = cell.c + (e.shiftKey ? -1 : 1);
      if (next < 0 || next >= cols.columns.length) return;
      e.preventDefault();
      goTo(cell.r, next);
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      goTo(cell.r, e.key === "Home" ? 0 : cols.columns.length - 1, e.shiftKey);
    } else if ((e.key === "Delete" || e.key === "Backspace") && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      const list = rangeCells().map((x) => ({ ...x, text: "" }));
      writeCells(list).then((n) => n > 1 && ok(`${n} cellules effacées.`));
    } else if (e.key === "Escape") setAnchor(cell);
  };
  const onSheetCopy = (e) => {
    if (!range || e.target.matches?.("input:not(.d-check), textarea")) return;
    const lines = [];
    for (let r = range.r0; r <= range.r1; r += 1) {
      const row = [];
      for (let c = range.c0; c <= range.c1; c += 1) row.push(shown[r] && cols.columns[c] ? cellText(cols.columns[c].key, shown[r]).replace(/[\t\n]/g, " ") : "");
      lines.push(row.join("\t"));
    }
    e.clipboardData.setData("text/plain", lines.join("\n"));
    e.preventDefault();
  };
  const onSheetPaste = (e) => {
    if (!range || e.target.matches?.("input:not(.d-check), textarea")) return;
    const grid = parseTsv(e.clipboardData.getData("text/plain"));
    if (!grid.length) return;
    e.preventDefault();
    const single = grid.length === 1 && grid[0].length === 1;
    const list = [];
    const rows = single ? range.r1 - range.r0 + 1 : grid.length;
    for (let i = 0; i < rows; i += 1) {
      const g = shown[range.r0 + i];
      if (!g) break;
      const width = single ? range.c1 - range.c0 + 1 : grid[i].length;
      for (let j = 0; j < width; j += 1) {
        const col = cols.columns[range.c0 + j];
        if (col) list.push({ g, key: col.key, text: single ? grid[0][0] : grid[i][j] });
      }
    }
    writeCells(list).then((n) => ok(n ? `${n} cellule${n > 1 ? "s" : ""} collée${n > 1 ? "s" : ""}.` : "Rien à coller ici."));
  };

  const stats = kpiItems(data, "invites");
  const g = guestStats(data);

  // Colonnes du tableau : largeur et ordre au choix de chacun (gardés dans le navigateur)
  const columnDefs = [
    {
      key: "select",
      label: "",
      fixed: true,
      noResize: true,
      render: (g, r, host, rowIdx) => (
        <input
          type="checkbox"
          className="d-check"
          checked={!!selected[g.id]}
          onChange={() => {}}
          onMouseDown={(e) => {
            if (e.button !== 0 || e.shiftKey) return;
            e.preventDefault(); // pas de sélection de texte pendant le glisser
            e.currentTarget.focus();
            const on = !selected[g.id];
            dragRef.current = { on, lastIdx: rowIdx };
            skipClickRef.current = true;
            setSelected((x) => ({ ...x, [g.id]: on }));
            lastClickRef.current = rowIdx;
          }}
          onClick={(e) => {
            if (skipClickRef.current) {
              skipClickRef.current = false;
              return;
            }
            toggleWithRange(g.id, rowIdx, e.shiftKey);
          }}
          onKeyDown={(e) => {
            if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
            const nextIdx = e.key === "ArrowDown" ? rowIdx + 1 : rowIdx - 1;
            const nextRow = shown[nextIdx];
            if (!nextRow) return;
            e.preventDefault();
            if (e.shiftKey) toggleWithRange(nextRow.id, nextIdx, true);
            checkboxRefs.current.get(nextRow.id)?.focus();
          }}
          ref={(el) => {
            if (el) checkboxRefs.current.set(g.id, el);
            else checkboxRefs.current.delete(g.id);
          }}
          aria-label={`Sélectionner ${guestLabel(g, byId) || "cet invité"}`}
          title="Clic : sélectionner · Glisser : sélectionner plusieurs lignes · Maj + clic : sélectionner une plage · ↑/↓ : se déplacer · Maj + ↑/↓ : étendre la sélection"
        />
      ),
    },
    {
      key: "name",
      label: "Invités",
      fixed: true,
      render: (g, r, host) => (
        <div className="d-guest-name">
          <InlineEdit value={fullName(g)} placeholder={host ? `+1 de ${fullName(host)}` : "Sans nom"} label="nom de l'invité" width={170} onSave={(v) => applyValues([{ id: g.id, key: "name", value: splitName(v) }])} />
          <span className="d-guest-sub">
            {g.age ? <span>{g.age} ans</span> : null}
            {host && !fullName(g) ? <span>À nommer</span> : null}
            <GroupCell guest={g} group={groupById.get(g.group_id)} groups={groups} label={guestLabel(g, byId)} />
          </span>
        </div>
      ),
    },
    ...events.map((ev) => ({
      key: `ev:${ev.id}`,
      label: ev.short_name,
      event: ev,
      render: (g, r) => <RsvpMenu status={r[ev.id] || "non_invite"} onPick={(k) => applyValues([{ id: g.id, key: `ev:${ev.id}`, value: k }])} title={`${ev.name} : modifier le statut`} />,
    })),
    { key: "diet", label: "Régime", render: (g) => <InlineEdit value={g.diet} label="régime" width={110} onSave={(v) => applyValues([{ id: g.id, key: "diet", value: v }])} className="d-cell-clip" /> },
    { key: "address", label: "Adresse", render: (g) => <InlineEdit value={g.address} label="adresse" width={220} onSave={(v) => applyValues([{ id: g.id, key: "address", value: v }])} className="d-cell-clip" /> },
    { key: "email", label: "Mail", render: (g) => <InlineEdit value={g.email} label="mail" width={180} onSave={(v) => applyValues([{ id: g.id, key: "email", value: v }])} className="d-cell-clip" /> },
    { key: "phone", label: "Téléphone", render: (g) => <InlineEdit value={g.phone} label="téléphone" width={130} onSave={(v) => applyValues([{ id: g.id, key: "phone", value: v }])} className="d-cell-clip" /> },
    ...fields.map((f) => ({
      key: `field:${f.id}`,
      label: f.name,
      custom: true,
      field: f,
      render: (g) => {
        const saveCustom = (v) => applyValues([{ id: g.id, key: `field:${f.id}`, value: v || null }]);
        return f.kind === "choice" ? (
          <ChoiceCell value={(g.custom || {})[f.id]} options={f.options} label={f.name} onChange={saveCustom} />
        ) : (
          <InlineEdit value={(g.custom || {})[f.id]} label={f.name} width={110} onSave={saveCustom} className="d-cell-clip" />
        );
      },
    })),
    { key: "tools", label: "", fixed: true, noResize: true, render: (g, r, host) => <RowMenu guest={g} label={fullName(g) || (host ? `le +1 de ${fullName(host)}` : "cet invité")} /> },
  ];
  const cols = useColumnLayout("invites", columnDefs);
  const [restoring, setRestoring] = useState(false);

  // En-tête de chaque colonne : renommer et supprimer sont possibles partout
  function headFor(c) {
    if (c.custom) return <FieldHeader field={c.field} extra={sortItems(c.key)} />;
    if (c.key === "tools") return c.label;
    if (c.key === "select") {
      return (
        <input
          type="checkbox"
          className="d-check"
          checked={allSelected}
          ref={(el) => {
            if (el) el.indeterminate = selIds.length > 0 && !allSelected;
          }}
          onChange={() => (allSelected ? clearSel() : selectAll())}
          aria-label="Tout sélectionner"
        />
      );
    }
    if (c.event) {
      const ev = c.event;
      const n = (data.responses || []).filter((r) => r.event_id === ev.id && r.status !== "non_invite").length;
      return (
        <ColumnHead
          col={c}
          onRename={(v) => dash.update("events", ev.id, { short_name: v.slice(0, 14) })}
          removeLabel="Supprimer le moment"
          onRemove={() => {
            const msg = n ? `Supprimer « ${ev.name} » ? Les réponses de ${n} invité${n > 1 ? "s" : ""} à ce moment seront effacées.` : `Supprimer « ${ev.name} » ?`;
            if (window.confirm(msg)) dash.remove("events", ev.id);
          }}
          extraItems={
            <>
              {sortItems(c.key)}
              <button type="button" className="d-pop-item" onClick={() => setMoments(true)}>
                <span className="d-pop-label">
                  <Icon name="pencil" size={14} sw={2} />
                  Modifier les moments
                </span>
              </button>
            </>
          }
        />
      );
    }
    const removable = !c.fixed;
    return (
      <ColumnHead
        col={c}
        onRename={(v) => cols.rename(c.key, v)}
        extraItems={sortItems(c.key)}
        removeLabel="Supprimer la colonne"
        onRemove={
          removable
            ? () => {
                if (window.confirm(`Supprimer la colonne « ${c.label} » du tableau ? Les informations restent enregistrées, vous pourrez la réafficher.`)) cols.hide(c.key);
              }
            : undefined
        }
      />
    );
  }

  return (
    <>
      <InvitesHeader
        tab="liste"
        actions={
          <span className="d-desk-only-flex" style={{ gap: 10 }}>
            <Btn kind="strong" icon="download" href="/dashboard/invites/exporter">
              Exporter
            </Btn>
            <Btn icon="sparkle" href="/dashboard/invites/importer">
              Importer une liste
            </Btn>
          </span>
        }
      />

      <div className="d-desk-only">
        <KpiBar items={stats} plusHref="/dashboard/indicateurs/invites" />
      </div>
      <div className="d-mob-only">
        <div className="d-mstats-scroll">
          <span><strong>{guests.length}</strong><small>Invités</small></span>
          <span><strong>{g.answered} <i>({pctLabel(g.answered, g.total)})</i></strong><small>Réponses</small></span>
          <span><strong>{g.oui} <i>({pctLabel(g.oui, g.total)})</i></strong><small>Participants</small></span>
        </div>
      </div>

      <div className="d-desk-only">
        <GuestsNote />
      </div>

      <div className="d-col" style={{ gap: 14 }}>
        <div className="d-filters d-ifilters" style={{ justifyContent: "space-between" }}>
          <div className="d-filters d-ifilters-left">
            <label className="d-search">
              <Icon name="search" size={15} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Chercher un invité" aria-label="Chercher un invité" />
            </label>
            <button type="button" className={`d-group-pick${filterCount ? " is-on" : ""}`} onClick={() => setFiltering(true)}>
              <Icon name="list" size={14} sw={2.2} />
              Filtres
              {filterCount ? <span className="d-filter-count">{filterCount}</span> : null}
            </button>
          </div>
          <span className="d-filters d-desk-only">
            {cols.customised ? (
              <button type="button" className="d-pill" onClick={cols.reset} title="Remettre l'ordre et la largeur des colonnes par défaut">
                Colonnes par défaut
              </button>
            ) : null}
            {cols.hiddenColumns.length ? (
              <span className="d-anchor">
                <button type="button" className="d-pill" onClick={() => setRestoring((o) => !o)} aria-haspopup="menu" aria-expanded={restoring}>
                  Colonnes supprimées · {cols.hiddenColumns.length}
                </button>
                <Popover open={restoring} onClose={() => setRestoring(false)} align="right">
                  {cols.hiddenColumns.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      className="d-pop-item"
                      onClick={() => {
                        cols.show(c.key);
                        setRestoring(false);
                      }}
                    >
                      <span className="d-pop-label">
                        <Icon name="plus" size={14} sw={2.2} />
                        Réafficher « {c.label} »
                      </span>
                    </button>
                  ))}
                </Popover>
              </span>
            ) : null}
            <button type="button" className="d-pill is-dashed" onClick={() => setAddingCol(true)}>
              <Icon name="plus" size={14} sw={2} />
              Ajouter une colonne
            </button>
          </span>
        </div>
      </div>

      {guests.length ? (
        <div className="d-desk-only">
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <Btn kind="lime" icon="plus" onClick={() => setAdding(true)}>
              Ajouter des invités
            </Btn>
            <Btn kind="ghost" icon="expand" onClick={() => setFull(true)} title="Travailler la liste en plein écran, au clavier">
              Plein écran
            </Btn>
          </div>
        </div>
      ) : null}

      {guests.length ? (
        selIds.length ? (
          <>
            <div className="d-desk-only">
              {/* Largeur fixe, jamais de retour à la ligne : une sélection ne doit pas déplacer le tableau sous la souris */}
              <div className="d-selbar" role="region" aria-label="Invités sélectionnés" style={{ flexWrap: "nowrap", overflowX: "auto" }}>
                <strong style={{ flex: "none" }}>{n(selIds.length, "sélection", "sélections")}</strong>
                <span className="d-selbar-actions" style={{ flexWrap: "nowrap" }}>
                  {!allSelected ? (
                    <button type="button" onClick={selectAll}>
                      Tout sélectionner ({shown.length})
                    </button>
                  ) : null}
                  <span className="d-anchor">
                    <button type="button" onClick={() => setBulkMenu((m) => (m === "groupe" ? null : "groupe"))} aria-haspopup="menu">
                      Groupe
                    </button>
                    <Popover open={bulkMenu === "groupe"} onClose={() => setBulkMenu(null)}>
                      {groups.map((g) => (
                        <button key={g.id} type="button" className="d-pop-item" onClick={() => bulkGroup(g.id)}>
                          <GroupChip group={g} />
                        </button>
                      ))}
                      <button type="button" className="d-pop-item" onClick={() => bulkGroup(null)}>
                        <span className="d-pop-label">Sans groupe</span>
                      </button>
                    </Popover>
                  </span>
                  {events.length ? (
                    <span className="d-anchor">
                      <button type="button" onClick={() => setBulkMenu((m) => (m === "moment" ? null : "moment"))} aria-haspopup="menu">
                        Moments
                      </button>
                      <Popover open={bulkMenu === "moment"} onClose={() => setBulkMenu(null)}>
                        {events.map((ev) => (
                          <span key={ev.id} style={{ display: "contents" }}>
                            <button type="button" className="d-pop-item" onClick={() => bulkMoment(ev, true)}>
                              <span className="d-pop-label">Inviter à {ev.name}</span>
                            </button>
                            <button type="button" className="d-pop-item" onClick={() => bulkMoment(ev, false)}>
                              <span className="d-pop-label">Ne plus inviter à {ev.name}</span>
                            </button>
                          </span>
                        ))}
                      </Popover>
                    </span>
                  ) : null}
                  <BulkColumnMenu fields={fields} onApply={bulkField} />
                  <button type="button" onClick={clearSel}>
                    Tout désélectionner
                  </button>
                  <button type="button" className="is-danger" onClick={bulkRemove}>
                    <Icon name="trash" size={14} sw={2} />
                    {allSelected && shown.length === guests.length ? "Supprimer toute la liste" : selIds.length > 1 ? `Supprimer les ${selIds.length}` : "Supprimer"}
                  </button>
                </span>
              </div>
            </div>

          </>
        ) : (
          <>
            <div className="d-desk-only">
              {/* Même hauteur que la barre d'actions groupées ci-dessus : sélectionner un premier invité ne doit pas pousser le tableau */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", minHeight: 56, alignItems: "center" }}>
                <button type="button" className="d-pill" onClick={selectAll} disabled={!shown.length}>
                  <Icon name="check" size={14} sw={2.2} />
                  Tout sélectionner{shown.length ? ` · ${shown.length}` : ""}
                </button>
              </div>
            </div>
          </>
        )
      ) : null}

      {guests.length ? (
        <div className="d-cards d-mob-only">
          {shown.map((g) => (
            <GuestCard key={g.id} guest={g} events={events} idx={idx} byId={byId} groupById={groupById} />
          ))}
          {!shown.length ? <p className="d-muted d-small" style={{ margin: 0, padding: 16 }}>Aucun invité ne correspond.</p> : null}
        </div>
      ) : null}

      {guests.length ? (
        <div className={`d-sheet-shell d-desk-only${full ? " is-full" : ""}`} role={full ? "dialog" : undefined} aria-modal={full || undefined} aria-label={full ? "Liste des invités en plein écran" : undefined}>
        {full ? (
          <div className="d-sheet-head">
            <strong>Liste des invités</strong>
            <span className="d-small d-muted">{n(shown.length, "invité", "invités")}{selIds.length ? ` · ${n(selIds.length, "sélection", "sélections")}` : ""}</span>
            <span className="d-spacer" />
            <span className="d-small d-muted d-sheet-keys">Flèches, Tab et Entrée pour se déplacer · Cmd+Z pour annuler</span>
            <Btn kind="ghost" small icon="x" onClick={() => setFull(false)}>
              Quitter le plein écran
            </Btn>
          </div>
        ) : null}
        <div className="d-table-wrap d-sheet" ref={sheetRef}>
          <table className="d-table d-guests d-cols" onKeyDown={onSheetKey} onCopy={onSheetCopy} onPaste={onSheetPaste}>
            <thead>
              <tr>
                {cols.columns.map((c) => {
                  const hp = cols.headerProps(c);
                  const frozen = c.key === "select" ? "d-frozen-1" : c.key === "name" ? "d-frozen-2" : "";
                  return (
                    <th key={c.key} {...hp} className={[hp.className, c.custom ? "d-col-custom" : "", frozen].filter(Boolean).join(" ") || undefined} title={c.fixed ? undefined : "Glisser pour déplacer la colonne"}>
                      {headFor(c)}
                      {sort?.key === c.key ? (
                        <button type="button" className="d-sort-mark" onClick={() => setSort(null)} aria-label={`Retirer le tri sur ${c.label}`} title="Retirer le tri">
                          <Icon name={sort.dir === 1 ? "arrowDown" : "arrowUp"} size={12} sw={2.4} />
                        </button>
                      ) : null}
                      {c.noResize ? null : <ResizeHandle label={c.label} onMouseDown={(e) => cols.startResize(c.key, e, e.currentTarget.parentElement)} />}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {shown.map((g, rowIdx) => {
                const r = idx.get(g.id) || {};
                const host = g.plus_one_of ? byId.get(g.plus_one_of) : null;
                return (
                  <tr key={g.id} className={selected[g.id] ? "d-row-selected" : undefined} onMouseDown={(e) => rowMouseDown(e, g, rowIdx)} onMouseEnter={() => dragOver(rowIdx)}>
                    {cols.columns.map((c, colIdx) => {
                      const active = cell && cell.r === rowIdx && cell.c === colIdx;
                      const cls = [
                        c.custom ? "d-col-custom" : "",
                        c.key === "select" ? "d-frozen-1" : c.key === "name" ? "d-frozen-2" : "",
                        active ? "is-cell-active" : "",
                        !active && range && (range.r0 !== range.r1 || range.c0 !== range.c1) && inRange(rowIdx, colIdx) ? "is-cell-range" : "",
                      ].filter(Boolean);
                      return (
                        <td
                          key={c.key}
                          style={cols.cellStyle(c)}
                          className={cls.join(" ") || undefined}
                          data-r={rowIdx}
                          data-c={colIdx}
                          tabIndex={-1}
                          onFocus={() => cellFocus(rowIdx, colIdx)}
                          onMouseDown={(e) => {
                            // Maj + clic sur une cellule : étend la plage (la case à cocher garde son Maj + clic)
                            if (!e.shiftKey || !cell || c.key === "select") return;
                            e.preventDefault();
                            skipClickRef.current = true; // le clic ne doit pas ouvrir le nom ou le statut
                            extendingRef.current = true;
                            setCell({ r: rowIdx, c: colIdx });
                            focusCell(rowIdx, colIdx);
                            extendingRef.current = false;
                          }}
                        >
                          {c.render(g, r, host, rowIdx)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              <tr className="d-add-row">
                {cols.columns.map((c) => (
                  <td key={c.key} className={c.key === "select" ? "d-frozen-1" : c.key === "name" ? "d-frozen-2" : undefined}>
                    {c.key === "name" ? (
                      <input
                        className="d-add-input"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addRow();
                          } else if (e.key === "Escape") setNewName("");
                        }}
                        onBlur={addRow}
                        placeholder="+ Ajouter un invité"
                        aria-label="Nom du nouvel invité"
                      />
                    ) : null}
                  </td>
                ))}
              </tr>
            </tbody>
            <tfoot>
              <tr>
                {cols.columns.map((c) => (
                  <td key={c.key} className={c.key === "select" ? "d-frozen-1" : c.key === "name" ? "d-frozen-2" : undefined}>
                    {footFor(c)}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
        </div>
      ) : (
        <div className="d-empty">
          <p>Pas encore d'invités.</p>
          <div className="d-filters">
            <span className="d-desk-only-flex">
              <Btn icon="sparkle" href="/dashboard/invites/importer">
                Importer une liste
              </Btn>
            </span>
            <Btn kind="ghost" icon="plus" onClick={() => setAdding(true)}>
              Ajouter des invités
            </Btn>
          </div>
        </div>
      )}

      <button type="button" className="d-fab" aria-label="Ajouter un invité" onClick={() => setAdding(true)}>
        <Icon name="plus" size={22} sw={2.4} />
      </button>

      {adding ? <AddGuests onClose={() => setAdding(false)} /> : null}
      {addingCol ? <ColumnModal onClose={() => setAddingCol(false)} /> : null}
      {moments ? <MomentsModal onClose={() => setMoments(false)} /> : null}
      {filtering ? (
        <Modal
          title="Filtres"
          onClose={() => setFiltering(false)}
          footer={
            <>
              <button type="button" className="d-link" onClick={clearFilters}>
                Tout effacer
              </button>
              <span className="d-spacer" />
              <Btn onClick={() => setFiltering(false)}>{`Voir ${n(shown.length, "invité", "invités")}`}</Btn>
            </>
          }
        >
          <div className="d-gfilter">
            <div className="d-gfilter-head">
              <strong>Groupe</strong>
            </div>
            <div className="d-filters">
              {groups.map((gr) => {
                const p = pastel(gr.color);
                const on = groupFilter === gr.id;
                return (
                  <span key={gr.id} className="d-group-filter">
                    <button type="button" className={`d-gfilter-chip${on ? " is-on" : ""}`} style={on ? undefined : { background: p.bg, borderColor: p.bg }} aria-pressed={on} onClick={() => setGroupFilter(on ? null : gr.id)}>
                      {on ? <Icon name="check" size={12} sw={3} /> : null}
                      {gr.name}
                    </button>
                    {/* Modifier un groupe (artboard 1f2) : réservé à l'ordinateur */}
                    <span className="d-desk-only-inline">
                      <GroupEdit group={gr} count={guests.filter((x) => x.group_id === gr.id).length} />
                    </span>
                  </span>
                );
              })}
            </div>
          </div>
          <div className="d-gfilter">
            <div className="d-gfilter-head">
              <strong>Présence</strong>
            </div>
            <StatusChips value={statusFilter} onChange={setStatusFilter} />
          </div>
          {events.length ? (
            <div className="d-gfilter">
              <div className="d-gfilter-head">
                <strong>Moment</strong>
                <button
                  type="button"
                  className="d-link d-desk-only-inline"
                  onClick={() => {
                    setFiltering(false);
                    setMoments(true);
                  }}
                >
                  Modifier les moments
                </button>
              </div>
              {events.map((ev) => (
                <div key={ev.id} className="d-gfilter-moment">
                  <span>{ev.name}</span>
                  <StatusChips
                    value={momentFilter[ev.id] || null}
                    onChange={(st) =>
                      setMomentFilter((m) => {
                        const next = { ...m };
                        if (st) next[ev.id] = st;
                        else delete next[ev.id];
                        return next;
                      })
                    }
                  />
                </div>
              ))}
            </div>
          ) : null}
          {fields.some((f) => fieldFilterValues(f, guests).length) ? (
            <div className="d-gfilter">
              <div className="d-gfilter-head">
                <strong>Vos colonnes</strong>
              </div>
              {fields
                .map((f) => [f, fieldFilterValues(f, guests)])
                .filter(([, vals]) => vals.length)
                .map(([f, vals]) => (
                  <div key={f.id} className="d-gfilter-moment">
                    <span>{f.name}</span>
                    <div className="d-filters">
                      {vals.map((o) => {
                        const on = activeFieldFilter?.fieldId === f.id && activeFieldFilter.key === o.key;
                        return (
                          <button key={o.key} type="button" className={`d-gfilter-chip${on ? " is-on" : ""}`} aria-pressed={on} onClick={() => setFieldFilter(on ? null : { fieldId: f.id, fieldName: f.name, key: o.key, label: o.label })}>
                            {on ? <Icon name="check" size={12} sw={3} /> : null}
                            {o.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
            </div>
          ) : null}
        </Modal>
      ) : null}
    </>
  );
}


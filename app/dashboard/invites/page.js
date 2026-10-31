"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useDash } from "@/lib/dash/store";
import { GUEST_STATUS_LABEL, guestStats, guestStatus, kpiItems, responseIndex, guestLabel } from "@/lib/dash/model";
import { fullName, normalize, pctLabel, uid } from "@/lib/dash/format";
import { columnValues } from "@/lib/dash/codes";
import { PASTEL_KEYS, pastel } from "@/lib/dash/theme";
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

function RsvpCell({ guest, event, status }) {
  const dash = useDash();
  return <RsvpMenu status={status} onPick={(k) => dash.setResponse(guest.id, event.id, k)} title={`${event.name} : modifier le statut`} />;
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
        {extraItems}
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
  const shown = base.filter((g) => matches(g));
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
  // Glisser : appuyer sur une case puis passer sur d'autres lignes leur donne le même état
  const dragRef = useRef(null); // { on, lastIdx }
  const skipClickRef = useRef(false); // le clic qui suit l'appui est déjà traité
  useEffect(() => {
    const end = () => {
      dragRef.current = null;
      setTimeout(() => {
        skipClickRef.current = false;
      }, 0);
    };
    document.addEventListener("mouseup", end);
    return () => document.removeEventListener("mouseup", end);
  }, []);
  const dragOver = (rowIdx) => {
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
          <InlineEdit value={fullName(g)} placeholder={host ? `+1 de ${fullName(host)}` : "Sans nom"} label="nom de l'invité" width={170} onSave={(v) => dash.update("guests", g.id, splitName(v))} />
          <span className="d-guest-sub">
            {g.age ? <span>{g.age} ans</span> : null}
            {host && !fullName(g) ? <span>À nommer</span> : null}
            <GroupCell guest={g} group={groupById.get(g.group_id)} groups={groups} label={guestLabel(g, byId)} />
          </span>
        </div>
      ),
    },
    ...events.map((ev) => ({ key: `ev:${ev.id}`, label: ev.short_name, event: ev, render: (g, r) => <RsvpCell guest={g} event={ev} status={r[ev.id] || "non_invite"} /> })),
    { key: "diet", label: "Régime", render: (g) => <InlineEdit value={g.diet} label="régime" width={110} onSave={(v) => dash.update("guests", g.id, { diet: v })} className="d-cell-clip" /> },
    { key: "address", label: "Adresse", render: (g) => <InlineEdit value={g.address} label="adresse" width={220} onSave={(v) => dash.update("guests", g.id, { address: v })} className="d-cell-clip" /> },
    { key: "email", label: "Mail", render: (g) => <InlineEdit value={g.email} label="mail" width={180} onSave={(v) => dash.update("guests", g.id, { email: v })} className="d-cell-clip" /> },
    { key: "phone", label: "Téléphone", render: (g) => <InlineEdit value={g.phone} label="téléphone" width={130} onSave={(v) => dash.update("guests", g.id, { phone: v })} className="d-cell-clip" /> },
    ...fields.map((f) => ({
      key: `field:${f.id}`,
      label: f.name,
      custom: true,
      field: f,
      render: (g) => {
        const saveCustom = (v) => {
          const custom = { ...(g.custom || {}) };
          if (v) custom[f.id] = v;
          else delete custom[f.id];
          dash.update("guests", g.id, { custom });
        };
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
    if (c.custom) return <FieldHeader field={c.field} />;
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
            <button type="button" className="d-pop-item" onClick={() => setMoments(true)}>
              <span className="d-pop-label">
                <Icon name="pencil" size={14} sw={2} />
                Modifier les moments
              </span>
            </button>
          }
        />
      );
    }
    const removable = !c.fixed;
    return (
      <ColumnHead
        col={c}
        onRename={(v) => cols.rename(c.key, v)}
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
        <div className="d-table-wrap d-desk-only">
          <table className="d-table d-guests d-cols">
            <thead>
              <tr>
                {cols.columns.map((c) => {
                  const hp = cols.headerProps(c);
                  return (
                    <th key={c.key} {...hp} className={[hp.className, c.custom ? "d-col-custom" : ""].filter(Boolean).join(" ") || undefined} title={c.fixed ? undefined : "Glisser pour déplacer la colonne"}>
                      {headFor(c)}
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
                  <tr key={g.id} className={selected[g.id] ? "d-row-selected" : undefined} onMouseEnter={() => dragOver(rowIdx)}>
                    {cols.columns.map((c) => (
                      <td key={c.key} style={cols.cellStyle(c)} className={c.custom ? "d-col-custom" : undefined}>
                        {c.render(g, r, host, rowIdx)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
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


"use client";

import { useMemo, useState } from "react";
import { useDash } from "@/lib/dash/store";
import { kpiItems, responseIndex, guestLabel } from "@/lib/dash/model";
import { fullName, normalize, uid } from "@/lib/dash/format";
import { PASTEL_KEYS, pastel } from "@/lib/dash/theme";
import { Icon } from "@/components/dash/icons";
import { Btn, Field, GroupChip, InlineEdit, KpiBar, Modal, PageHeader, Popover, RsvpMenu } from "@/components/dash/ui";
import MomentsModal from "@/components/dash/MomentsModal";
import { ResizeHandle, useColumnLayout } from "@/components/dash/Columns";
import { ChoiceCell, ColumnModal, FieldHeader } from "@/components/dash/ColumnModal";

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

// Téléphone : un invité par carte, les réponses sur une ligne, les coordonnées repliées
function GuestCard({ guest: g, events, groups, fields, idx, byId, groupById, selected, onToggle }) {
  const dash = useDash();
  const [open, setOpen] = useState(false);
  const r = idx.get(g.id) || {};
  const host = g.plus_one_of ? byId.get(g.plus_one_of) : null;
  const custom = g.custom || {};
  const saveCustom = (f, v) => {
    const next = { ...custom };
    if (v) next[f.id] = v;
    else delete next[f.id];
    dash.update("guests", g.id, { custom: next });
  };
  return (
    <div className={`d-gcard${selected ? " is-selected" : ""}`}>
      <div className="d-gcard-top">
        <input type="checkbox" className="d-check" checked={!!selected} onChange={onToggle} aria-label={`Sélectionner ${guestLabel(g, byId) || "cet invité"}`} style={{ marginTop: 3 }} />
        <div className="d-gcard-name">
          <InlineEdit value={fullName(g)} placeholder={host ? `+1 de ${fullName(host)}` : "Sans nom"} label="nom de l'invité" onSave={(v) => dash.update("guests", g.id, splitName(v))} />
          <span className="d-guest-sub">
            {g.age ? <span>{g.age} ans</span> : null}
            {host && !fullName(g) ? <span>À nommer</span> : null}
            <GroupCell guest={g} group={groupById.get(g.group_id)} groups={groups} label={guestLabel(g, byId)} />
          </span>
        </div>
        <button type="button" className={`d-gcard-more${open ? " is-open" : ""}`} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? "Masquer les coordonnées" : "Voir les coordonnées"}>
          <Icon name={open ? "chevDown" : "chev"} size={18} sw={2} />
        </button>
      </div>
      <div className="d-gcard-rsvps">
        {events.map((ev) => (
          <span key={ev.id} className="d-gcard-rsvp">
            <small>{ev.short_name}</small>
            <RsvpCell guest={g} event={ev} status={r[ev.id] || "non_invite"} />
          </span>
        ))}
      </div>
      {open ? (
        <div className="d-gcard-details">
          <small>Régime</small>
          <InlineEdit value={g.diet} label="régime" onSave={(v) => dash.update("guests", g.id, { diet: v })} />
          <small>Adresse</small>
          <InlineEdit value={g.address} label="adresse" multiline onSave={(v) => dash.update("guests", g.id, { address: v })} />
          <small>Mail</small>
          <InlineEdit value={g.email} label="mail" onSave={(v) => dash.update("guests", g.id, { email: v })} />
          <small>Téléphone</small>
          <InlineEdit value={g.phone} label="téléphone" onSave={(v) => dash.update("guests", g.id, { phone: v })} />
          {fields.map((f) => (
            <span key={f.id} style={{ display: "contents" }}>
              <small>{f.name}</small>
              {f.kind === "choice" ? <ChoiceCell value={custom[f.id]} options={f.options} label={f.name} onChange={(v) => saveCustom(f, v)} /> : <InlineEdit value={custom[f.id]} label={f.name} onSave={(v) => saveCustom(f, v)} />}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function Invites() {
  const dash = useDash();
  const data = dash.data;
  const { guests, groups, events, fields, wedding } = data;
  const [eventPick, setEventFilter] = useState(null);
  const [moments, setMoments] = useState(false);
  const [groupFilter, setGroupFilter] = useState(null);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [addingCol, setAddingCol] = useState(false);

  // Un moment supprimé ne reste pas sélectionné
  const eventFilter = events.some((e) => e.id === eventPick) ? eventPick : null;
  const idx = useMemo(() => responseIndex(data.responses), [data.responses]);
  const byId = useMemo(() => new Map(guests.map((g) => [g.id, g])), [guests]);
  const groupById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);

  const inEvent = (g) => !eventFilter || ((idx.get(g.id) || {})[eventFilter] || "non_invite") !== "non_invite";
  const base = guests.filter(inEvent);
  const q = normalize(query);
  const shown = base.filter((g) => (!groupFilter || g.group_id === groupFilter) && (!q || normalize(`${guestLabel(g, byId)} ${g.email || ""}`).includes(q)));

  // Sélection : cases à cocher, « Tout sélectionner » (tous les invités affichés, filtres compris)
  const [selected, setSelected] = useState({});
  const [bulkMenu, setBulkMenu] = useState(null); // "groupe" | "moment"
  const toggle = (id) => setSelected((x) => ({ ...x, [id]: !x[id] }));
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

  const stats = kpiItems(data, "invites");

  // Colonnes du tableau : largeur et ordre au choix de chacun (gardés dans le navigateur)
  const columnDefs = [
    {
      key: "select",
      label: "",
      fixed: true,
      noResize: true,
      render: (g) => (
        <input type="checkbox" className="d-check" checked={!!selected[g.id]} onChange={() => toggle(g.id)} aria-label={`Sélectionner ${guestLabel(g, byId) || "cet invité"}`} />
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
      <PageHeader
        title="Invités."
        actions={
          <>
            <Btn kind="lime" icon="link" href="/dashboard/invites/formulaire">
              Formulaire invités
            </Btn>
            <Btn kind="strong" icon="download" href="/dashboard/invites/exporter">
              Exporter
            </Btn>
            <Btn icon="sparkle" href="/dashboard/invites/importer">
              Importer une liste
            </Btn>
          </>
        }
      />

      <KpiBar items={stats} plusHref="/dashboard/indicateurs/invites" />

      <div className="d-col" style={{ gap: 14 }}>
        <div className="d-filters" style={{ justifyContent: "space-between" }}>
          <div className="d-filters d-scroll-x">
            <div className="d-tabs" role="tablist" aria-label="Moments du mariage">
              <button type="button" role="tab" aria-selected={!eventFilter} className={`d-tab${!eventFilter ? " is-on" : ""}`} onClick={() => setEventFilter(null)}>
                Tous
              </button>
              {events.map((ev) => (
                <button key={ev.id} type="button" role="tab" aria-selected={eventFilter === ev.id} className={`d-tab${eventFilter === ev.id ? " is-on" : ""}`} onClick={() => setEventFilter(ev.id)}>
                  {ev.name}
                </button>
              ))}
            </div>
            <button type="button" className="d-pill is-dashed" onClick={() => setMoments(true)} aria-label="Modifier les moments" title="Modifier les moments">
              <Icon name="pencil" size={14} sw={2} />
              <span className="d-desk-only">Modifier les moments</span>
            </button>
          </div>
          <label className="d-search">
            <Icon name="search" size={15} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Chercher un invité" aria-label="Chercher un invité" />
          </label>
        </div>
        <div className="d-filters" style={{ justifyContent: "space-between" }}>
          <div className="d-filters d-scroll-x">
            <button type="button" className={`d-pill${!groupFilter ? " is-on" : ""}`} onClick={() => setGroupFilter(null)}>
              Tous · {base.length}
            </button>
            {groups.map((g) => {
              const p = pastel(g.color);
              const on = groupFilter === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  className="d-group d-group-big"
                  style={{ background: p.bg, color: p.ink, boxShadow: on ? `0 0 0 1.5px ${p.ink}` : undefined, fontWeight: on ? 600 : 500 }}
                  onClick={() => setGroupFilter(on ? null : g.id)}
                  aria-pressed={on}
                >
                  {g.name} · {base.filter((x) => x.group_id === g.id).length}
                </button>
              );
            })}
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
        <div style={{ display: "flex" }}>
          <Btn kind="lime" icon="plus" onClick={() => setAdding(true)}>
            Ajouter des invités
          </Btn>
        </div>
      ) : null}

      {guests.length ? (
        selIds.length ? (
          <div className="d-selbar" role="region" aria-label="Invités sélectionnés">
            <strong>{n(selIds.length, "invité sélectionné", "invités sélectionnés")}</strong>
            <span className="d-selbar-actions" style={{ flexWrap: "wrap" }}>
              {!allSelected ? (
                <button type="button" onClick={selectAll}>
                  Tout sélectionner ({shown.length})
                </button>
              ) : null}
              <span className="d-anchor">
                <button type="button" onClick={() => setBulkMenu((m) => (m === "groupe" ? null : "groupe"))} aria-haspopup="menu">
                  Changer de groupe
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
              <button type="button" onClick={clearSel}>
                Tout désélectionner
              </button>
              <button type="button" className="is-danger" onClick={bulkRemove}>
                <Icon name="trash" size={14} sw={2} />
                {allSelected && shown.length === guests.length ? "Supprimer toute la liste" : selIds.length > 1 ? `Supprimer les ${selIds.length}` : "Supprimer"}
              </button>
            </span>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" className="d-pill" onClick={selectAll} disabled={!shown.length}>
              <Icon name="check" size={14} sw={2.2} />
              Tout sélectionner{shown.length ? ` · ${shown.length}` : ""}
            </button>
          </div>
        )
      ) : null}

      {guests.length ? (
        <div className="d-cards d-mob-only">
          {shown.map((g) => (
            <GuestCard key={g.id} guest={g} events={events} groups={groups} fields={fields} idx={idx} byId={byId} groupById={groupById} selected={!!selected[g.id]} onToggle={() => toggle(g.id)} />
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
              {shown.map((g) => {
                const r = idx.get(g.id) || {};
                const host = g.plus_one_of ? byId.get(g.plus_one_of) : null;
                return (
                  <tr key={g.id} className={selected[g.id] ? "d-row-selected" : undefined}>
                    {cols.columns.map((c) => (
                      <td key={c.key} style={cols.cellStyle(c)} className={c.custom ? "d-col-custom" : undefined}>
                        {c.render(g, r, host)}
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
          <p>Pas encore d'invités. Importez vos listes (Excel, photo d'une liste, notes du téléphone) ou ajoutez-les à la main.</p>
          <div className="d-filters">
            <Btn icon="sparkle" href="/dashboard/invites/importer">
              Importer une liste
            </Btn>
            <Btn kind="ghost" icon="plus" onClick={() => setAdding(true)}>
              Ajouter des invités
            </Btn>
          </div>
        </div>
      )}

      {adding ? <AddGuests onClose={() => setAdding(false)} /> : null}
      {addingCol ? <ColumnModal onClose={() => setAddingCol(false)} /> : null}
      {moments ? <MomentsModal onClose={() => setMoments(false)} /> : null}
    </>
  );
}


"use client";

import { useMemo, useState } from "react";
import { useDash } from "@/lib/dash/store";
import { chosenKpis, kpiContext, responseIndex, guestLabel } from "@/lib/dash/model";
import { fullName, normalize } from "@/lib/dash/format";
import { RSVP_ORDER, pastel } from "@/lib/dash/theme";
import { Icon } from "@/components/dash/icons";
import { Btn, Field, GroupChip, InlineEdit, KpiBar, Modal, PageHeader, Popover, RsvpChip } from "@/components/dash/ui";
import MomentsModal from "@/components/dash/MomentsModal";
import { ResizeHandle, useColumnLayout } from "@/components/dash/Columns";

function splitName(s) {
  const parts = String(s || "").trim().split(/\s+/);
  return { first_name: parts.shift() || "", last_name: parts.join(" ") };
}

function RsvpCell({ guest, event, status }) {
  const dash = useDash();
  const [open, setOpen] = useState(false);
  return (
    <span className="d-anchor">
      <RsvpChip status={status} onClick={() => setOpen((o) => !o)} open={open} title={`${event.name} : modifier la réponse`} />
      <Popover open={open} onClose={() => setOpen(false)}>
        {RSVP_ORDER.map((k) => (
          <button
            key={k}
            type="button"
            className={`d-pop-item${k === status ? " is-on" : ""}`}
            onClick={() => {
              dash.setResponse(guest.id, event.id, k);
              setOpen(false);
            }}
          >
            <RsvpChip status={k} />
            {k === status ? <Icon name="check" size={14} sw={2.2} /> : null}
          </button>
        ))}
      </Popover>
    </span>
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
  return (
    <span className="d-anchor">
      <GroupChip group={group} onClick={() => setOpen((o) => !o)} />
      <Popover open={open} onClose={() => setOpen(false)}>
        {groups.map((g) => (
          <button
            key={g.id}
            type="button"
            className={`d-pop-item${g.id === guest.group_id ? " is-on" : ""}`}
            onClick={() => {
              dash.update("guests", guest.id, { group_id: g.id });
              setOpen(false);
            }}
          >
            <GroupChip group={g} />
            {g.id === guest.group_id ? <Icon name="check" size={14} sw={2.2} /> : null}
          </button>
        ))}
        <span style={{ height: 1, background: "var(--d-line)", margin: "4px 2px" }} />
        <button
          type="button"
          className="d-pop-item"
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

function FieldHeader({ field }) {
  const dash = useDash();
  const [open, setOpen] = useState(false);
  return (
    <span className="d-anchor">
      <button type="button" className="d-link" style={{ textDecoration: "none", fontSize: 12, fontWeight: 500, letterSpacing: "0.04em", color: "inherit" }} onClick={() => setOpen((o) => !o)}>
        {field.name.toUpperCase()}
      </button>
      <Popover open={open} onClose={() => setOpen(false)} align="right">
        <button
          type="button"
          className="d-pop-item"
          onClick={() => {
            const name = window.prompt("Nouveau nom de la colonne", field.name);
            if (name && name.trim()) dash.update("guest_fields", field.id, { name: name.trim() });
            setOpen(false);
          }}
        >
          Renommer
        </button>
        <button
          type="button"
          className="d-pop-item"
          onClick={() => {
            if (window.confirm(`Supprimer la colonne « ${field.name} » et son contenu ?`)) dash.remove("guest_fields", field.id);
            setOpen(false);
          }}
        >
          Supprimer la colonne
        </button>
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

function AddColumn({ onClose }) {
  const dash = useDash();
  const [name, setName] = useState("");
  async function save(e) {
    e.preventDefault();
    if (!name.trim()) return;
    await dash.insert("guest_fields", { name: name.trim(), position: dash.data.fields.length });
    onClose();
  }
  return (
    <Modal
      title="Ajouter une colonne"
      onClose={onClose}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>
            Annuler
          </Btn>
          <Btn onClick={save}>Ajouter</Btn>
        </>
      }
    >
      <form onSubmit={save}>
        <Field label="Nom de la colonne" hint="Hébergement, navette, table, cadeau reçu… Chaque organisateur peut la remplir.">
          <input className="d-input" value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Navette" />
        </Field>
      </form>
    </Modal>
  );
}

// Téléphone : un invité par carte, les réponses sur une ligne, les coordonnées repliées
function GuestCard({ guest: g, events, groups, fields, idx, byId, groupById }) {
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
    <div className="d-gcard">
      <div className="d-gcard-top">
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
              <InlineEdit value={custom[f.id]} label={f.name} onSave={(v) => saveCustom(f, v)} />
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

  const ctx = kpiContext(data);
  const stats = chosenKpis(data, "invites").map((k) => ({ id: k.id, label: k.label, pill: k.pill, ...k.get(ctx) }));

  // Colonnes du tableau : largeur et ordre au choix de chacun (gardés dans le navigateur)
  const columnDefs = [
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
    ...events.map((ev) => ({ key: `ev:${ev.id}`, label: ev.short_name, render: (g, r) => <RsvpCell guest={g} event={ev} status={r[ev.id] || "non_invite"} /> })),
    { key: "diet", label: "Régime", render: (g) => <InlineEdit value={g.diet} label="régime" width={110} onSave={(v) => dash.update("guests", g.id, { diet: v })} className="d-cell-clip" /> },
    { key: "address", label: "Adresse", render: (g) => <InlineEdit value={g.address} label="adresse" width={220} onSave={(v) => dash.update("guests", g.id, { address: v })} className="d-cell-clip" /> },
    { key: "email", label: "Mail", render: (g) => <InlineEdit value={g.email} label="mail" width={180} onSave={(v) => dash.update("guests", g.id, { email: v })} className="d-cell-clip" /> },
    { key: "phone", label: "Téléphone", render: (g) => <InlineEdit value={g.phone} label="téléphone" width={130} onSave={(v) => dash.update("guests", g.id, { phone: v })} className="d-cell-clip" /> },
    ...fields.map((f) => ({
      key: `field:${f.id}`,
      label: f.name,
      custom: true,
      field: f,
      render: (g) => (
        <InlineEdit
          value={(g.custom || {})[f.id]}
          label={f.name}
          width={110}
          onSave={(v) => {
            const custom = { ...(g.custom || {}) };
            if (v) custom[f.id] = v;
            else delete custom[f.id];
            dash.update("guests", g.id, { custom });
          }}
          className="d-cell-clip"
        />
      ),
    })),
    { key: "tools", label: "", fixed: true, noResize: true, render: (g, r, host) => <RowMenu guest={g} label={fullName(g) || (host ? `le +1 de ${fullName(host)}` : "cet invité")} /> },
  ];
  const cols = useColumnLayout(`merry-cols-invites-${wedding.id}`, columnDefs);

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
        <div className="d-cards d-mob-only">
          {shown.map((g) => (
            <GuestCard key={g.id} guest={g} events={events} groups={groups} fields={fields} idx={idx} byId={byId} groupById={groupById} />
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
                      {c.custom ? <FieldHeader field={c.field} /> : c.label}
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
                  <tr key={g.id}>
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
      {addingCol ? <AddColumn onClose={() => setAddingCol(false)} /> : null}
      {moments ? <MomentsModal onClose={() => setMoments(false)} /> : null}
    </>
  );
}


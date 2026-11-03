"use client";

import Link from "next/link";

// Fiche d'un invité, une colonne : son nom et ses actions (relancer, accompagnant, retirer), ses réponses
// par moment, puis une seule liste de tout ce que le tableau sait de lui (contact, adresse, régime, âge,
// colonnes ajoutées), ce qui est renseigné d'abord, et la note pour l'équipe. Chaque champ se modifie en
// cliquant dessus, comme dans le tableau.

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useRef } from "react";
import { useDash } from "@/lib/dash/store";
import { responseIndex, guestLabel } from "@/lib/dash/model";
import { fullName, shortDate } from "@/lib/dash/format";
import { LIST_PATH, listHref } from "@/lib/dash/guestView";
import { Btn, InlineEdit, PageHeader, RsvpMenu } from "@/components/dash/ui";
import GroupCell from "@/components/dash/GroupCell";
import { agoDays } from "@/lib/dash/relance";
import RelanceModal from "@/components/dash/RelanceModal";
import { ChoiceCell } from "@/components/dash/ColumnModal";

function splitName(s) {
  const parts = String(s || "").trim().split(/\s+/);
  return { first_name: parts.shift() || "", last_name: parts.join(" ") };
}

function telHref(phone) {
  return `tel:${String(phone || "").replace(/[^\d+]/g, "")}`;
}

// Âge : un nombre entre 0 et 120, sinon vide
function parseAge(v) {
  const n = parseInt(String(v || "").replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) && n >= 0 && n <= 120 ? n : null;
}

// Note des organisateurs sur l'invité : enregistrée en quittant le champ (ou Cmd+Entrée)
function GuestNote({ guest }) {
  const dash = useDash();
  const [draft, setDraft] = useState(guest.note || "");
  const [editing, setEditing] = useState(false);
  // Une note qui arrive d'ailleurs (autre organisateur, écho) ne remplace pas celle qu'on est en train d'écrire
  useEffect(() => {
    if (!editing) setDraft(guest.note || "");
  }, [guest.id, guest.note, editing]);
  const commit = () => {
    setEditing(false);
    const text = draft.trim();
    if (text === (guest.note || "")) return;
    dash.update("guests", guest.id, { note: text || null });
  };
  if (!dash.data.guestNoteSetup) {
    return (
      <p className="d-small d-muted" style={{ margin: 0 }}>
        Pour garder un mot sur chaque invité, lancez <code>supabase/fiche-et-vues-invites.sql</code> dans Supabase (SQL Editor).
      </p>
    );
  }
  return (
    <textarea
      className="d-textarea d-guest-note"
      value={draft}
      onFocus={() => setEditing(true)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.blur();
      }}
      placeholder="Un mot pour l'équipe : « vient avec sa mère », « allergie à vérifier avec le traiteur »… L'invité ne le voit jamais."
      maxLength={1000}
      aria-label={`Note sur ${guestLabel(guest)}`}
    />
  );
}

export default function FicheInvite() {
  const { id } = useParams();
  const router = useRouter();
  const dash = useDash();
  const { guests, groups, events, responses, fields, form, members, log } = dash.data;
  // Retour à la liste telle qu'on l'a laissée (recherche, filtres, tri)
  const [back, setBack] = useState(LIST_PATH);
  useEffect(() => setBack(listHref()), []);

  const guest = guests.find((g) => g.id === id);
  const idx = useMemo(() => responseIndex(responses), [responses]);
  const byId = useMemo(() => new Map(guests.map((g) => [g.id, g])), [guests]);
  const groupById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);
  const addingPlus = useRef(false);
  const [relancing, setRelancing] = useState(false);

  if (!guest) return <PageHeader back={{ href: back, label: "Invités" }} title="Invité introuvable." />;

  const label = guestLabel(guest, byId) || "Sans nom";
  const r = idx.get(guest.id) || {};
  const host = guest.plus_one_of ? byId.get(guest.plus_one_of) : null;
  const plusOnes = guests.filter((g) => g.plus_one_of === guest.id);
  const pending = events.some((ev) => (r[ev.id] || "non_invite") === "attente");
  const remindedDays = agoDays(guest.reminded_at);
  const answerOf = (evId) => responses.find((x) => x.guest_id === guest.id && x.event_id === evId);
  // Dernière trace de l'historique pour ce moment : « par le formulaire, 8 oct. » ou « par Léa, 12 nov. »
  const traceOf = (evId) => {
    const entries = (log || []).filter((l) => l.guest_id === guest.id && l.event_id === evId);
    const last = entries[entries.length - 1];
    if (!last) return null;
    const who = last.source === "formulaire" ? "par le formulaire" : `par ${members.find((m) => m.id === last.member_id)?.display_name || "un organisateur"}`;
    return `${who}, ${shortDate(new Date(last.created_at))}`;
  };

  async function removeGuest() {
    const extra = plusOnes.length ? ` et ${plusOnes.length > 1 ? `ses ${plusOnes.length} accompagnants` : "son accompagnant"}` : "";
    if (!window.confirm(`Retirer ${label}${extra} de la liste ? ${plusOnes.length ? "Leurs" : "Ses"} réponses seront effacées.`)) return;
    if (await dash.removeGuests([guest.id])) router.push(back);
  }

  // Un accompagnant de plus : même groupe, invité aux mêmes moments que l'invité, à nommer ensuite
  async function addPlusOne() {
    if (addingPlus.current) return;
    addingPlus.current = true;
    try {
      await createPlusOne();
    } finally {
      addingPlus.current = false;
    }
  }
  async function createPlusOne() {
    const created = await dash.insert("guests", [{ first_name: "", last_name: "", group_id: guest.group_id || null, plus_one_of: guest.id, custom: {}, position: guests.length }]);
    if (!created.ok) return;
    const now = new Date().toISOString();
    const rows = created.flatMap((p) => events.map((ev) => ({ guest_id: p.id, event_id: ev.id, status: (r[ev.id] || "non_invite") === "non_invite" ? "non_invite" : "attente", updated_at: now })));
    if (rows.length) await dash.insert("guest_responses", rows);
  }

  const saveCustom = (f, v) => {
    const custom = { ...(guest.custom || {}) };
    if (v) custom[f.id] = v;
    else delete custom[f.id];
    dash.update("guests", guest.id, { custom });
  };

  const info = [
    { key: "phone", label: "Téléphone", value: guest.phone, action: guest.phone ? { href: telHref(guest.phone), label: "Appeler" } : null, onSave: (v) => dash.update("guests", guest.id, { phone: v }) },
    { key: "email", label: "Mail", value: guest.email, action: guest.email ? { href: `mailto:${guest.email}`, label: "Écrire" } : null, onSave: (v) => dash.update("guests", guest.id, { email: v }) },
    { key: "address", label: "Adresse", value: guest.address, multiline: true, onSave: (v) => dash.update("guests", guest.id, { address: v }) },
    { key: "diet", label: "Régime", value: guest.diet, onSave: (v) => dash.update("guests", guest.id, { diet: v }) },
    {
      key: "age",
      label: "Âge",
      value: guest.age !== null && guest.age !== undefined && guest.age !== "" ? String(guest.age) : "",
      display: guest.age !== null && guest.age !== undefined && guest.age !== "" ? `${guest.age} ans` : undefined,
      onSave: (v) => dash.update("guests", guest.id, { age: parseAge(v) }),
    },
    ...fields.map((f) => ({ key: `field:${f.id}`, label: f.name, value: (guest.custom || {})[f.id], field: f })),
  ];
  // Ce qui est renseigné d'abord, puis ce qui reste à remplir, discret
  const filled = info.filter((x) => x.value);
  const empty = info.filter((x) => !x.value);

  const row = (x) => (
    <div key={x.key} className={`d-frow${x.value ? "" : " is-empty"}`}>
      <span className="d-frow-label">{x.label}</span>
      <span className="d-frow-value">
        {x.field?.kind === "choice" ? (
          <ChoiceCell value={x.value} options={x.field.options} label={x.label} onChange={(v) => saveCustom(x.field, v)} />
        ) : (
          <InlineEdit value={x.value} placeholder="Ajouter" label={x.label.toLowerCase()} display={x.display} multiline={x.multiline} onSave={x.field ? (v) => saveCustom(x.field, v) : x.onSave} />
        )}
        {x.action ? (
          <a href={x.action.href} className="d-frow-action">
            {x.action.label}
          </a>
        ) : null}
      </span>
    </div>
  );

  return (
    <div className="d-fiche">
      <PageHeader back={{ href: back, label: "Invités" }} />

      <header className="d-fiche-head">
        <h1 className="d-title">
          <InlineEdit value={fullName(guest)} placeholder={host ? `+1 de ${fullName(host)}` : "Sans nom"} label="nom de l'invité" onSave={(v) => dash.update("guests", guest.id, splitName(v))} />
        </h1>
        <div className="d-fiche-sub">
          <GroupCell guest={guest} group={groupById.get(guest.group_id)} groups={groups} label={label} small={false} />
          {host ? (
            <Link href={`/dashboard/invites/${host.id}`} className="d-fiche-link">
              Accompagne {fullName(host) || "un invité sans nom"}
            </Link>
          ) : null}
          {plusOnes.map((p) => (
            <Link key={p.id} href={`/dashboard/invites/${p.id}`} className="d-fiche-link">
              +1 : {fullName(p) || "à nommer"}
            </Link>
          ))}
          {guest.reminded_at && remindedDays !== null ? <span className="d-muted">{remindedDays === 0 ? "Relancé aujourd'hui" : remindedDays === 1 ? "Relancé hier" : `Relancé il y a ${remindedDays} j`}</span> : null}
        </div>
        <div className="d-fiche-actions">
          {pending && !host ? (
            <Btn icon="send" onClick={() => setRelancing(true)}>
              Relancer
            </Btn>
          ) : null}
          {!host ? (
            <Btn kind="ghost" icon="plus" onClick={addPlusOne}>
              Accompagnant
            </Btn>
          ) : null}
        </div>
      </header>

      <section className="d-fiche-block" aria-label="Réponses par moment">
        {events.length ? (
          events.map((ev) => {
            const a = answerOf(ev.id);
            const st = r[ev.id] || "non_invite";
            const trace = st !== "non_invite" && traceOf(ev.id) ? traceOf(ev.id) : (st === "oui" || st === "non") && a?.updated_at ? `mis à jour le ${shortDate(new Date(a.updated_at))}` : null;
            return (
              <div key={ev.id} className="d-frow is-moment">
                <span className="d-frow-label">
                  {ev.name}
                  {trace ? <small>{trace}</small> : null}
                </span>
                <RsvpMenu status={st} onPick={(k) => dash.setResponse(guest.id, ev.id, k)} title={`${ev.name} : modifier le statut`} />
              </div>
            );
          })
        ) : (
          <p className="d-small d-muted" style={{ margin: 0 }}>
            Pas encore de moment défini.
          </p>
        )}
        {form ? <p className="d-fiche-hint">Les réponses arrivent aussi par le formulaire invités.</p> : null}
      </section>

      <section className="d-fiche-block" aria-label="Informations">
        {filled.map(row)}
        {empty.length ? <div className="d-fiche-empties">{empty.map(row)}</div> : null}
        <div className="d-frow is-note">
          <span className="d-frow-label">Note pour l'équipe</span>
          <GuestNote guest={guest} />
        </div>
      </section>

      <div>
        <button type="button" className="d-link d-fiche-remove" onClick={removeGuest}>
          Retirer {label} de la liste
        </button>
      </div>

      {relancing ? <RelanceModal guests={[guest]} onClose={() => setRelancing(false)} onMarked={(ids) => dash.updateGuests(ids, { reminded_at: new Date().toISOString() })} /> : null}
    </div>
  );
}

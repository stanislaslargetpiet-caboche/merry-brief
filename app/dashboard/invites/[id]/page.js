"use client";

// Fiche d'un invité : tout ce que le tableau sait de lui (réponses par moment, groupe, âge, contact,
// régime, adresse, colonnes ajoutées), ses accompagnants, et une note pour les organisateurs.
// Chaque champ se modifie en cliquant dessus, comme dans le tableau.

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useDash } from "@/lib/dash/store";
import { responseIndex, guestLabel } from "@/lib/dash/model";
import { fullName, shortDate } from "@/lib/dash/format";
import { LIST_PATH, listHref } from "@/lib/dash/guestView";
import { Icon } from "@/components/dash/icons";
import { Btn, InlineEdit, PageHeader, RsvpMenu } from "@/components/dash/ui";
import GroupCell from "@/components/dash/GroupCell";
import { agoDays, inviteLink, mailHref, reminderSubject, reminderText, smsHref, waDigits, waHref } from "@/lib/dash/relance";
import { householdKey, householdLabel, householdsOf } from "@/lib/dash/households";
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
  useEffect(() => setDraft(guest.note || ""), [guest.id, guest.note]);
  const commit = () => {
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
  const { guests, groups, events, responses, fields, form } = dash.data;
  // Retour à la liste telle qu'on l'a laissée (recherche, filtres, tri)
  const [back, setBack] = useState(LIST_PATH);
  useEffect(() => setBack(listHref()), []);

  const guest = guests.find((g) => g.id === id);
  const idx = useMemo(() => responseIndex(responses), [responses]);
  const byId = useMemo(() => new Map(guests.map((g) => [g.id, g])), [guests]);
  const groupById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);

  if (!guest) return <PageHeader back={{ href: back, label: "Invités" }} title="Invité introuvable." />;

  const label = guestLabel(guest, byId) || "Sans nom";
  const r = idx.get(guest.id) || {};
  const host = guest.plus_one_of ? byId.get(guest.plus_one_of) : null;
  const plusOnes = guests.filter((g) => g.plus_one_of === guest.id);
  const household = (householdsOf(guests, byId).get(householdKey(guest, byId)) || []).filter((m) => m.id !== guest.id);
  const pending = events.some((ev) => (r[ev.id] || "non_invite") === "attente");
  const link = inviteLink(dash.data);
  const relText = reminderText(dash.data, link).replace(/^Bonjour !/, guest.first_name ? `Bonjour ${guest.first_name.trim()} !` : "Bonjour !");
  const relSubject = reminderSubject(dash.data);
  const remindedDays = agoDays(guest.reminded_at);
  const answerOf = (evId) => responses.find((x) => x.guest_id === guest.id && x.event_id === evId);

  async function removeGuest() {
    const extra = plusOnes.length ? ` et ${plusOnes.length > 1 ? `ses ${plusOnes.length} accompagnants` : "son accompagnant"}` : "";
    if (!window.confirm(`Retirer ${label}${extra} de la liste ? ${plusOnes.length ? "Leurs" : "Ses"} réponses seront effacées.`)) return;
    if (await dash.removeGuests([guest.id])) router.push(back);
  }

  // Un accompagnant de plus : même groupe, invité aux mêmes moments que l'invité, à nommer ensuite
  async function addPlusOne() {
    const created = await dash.insert("guests", [{ first_name: "", last_name: "", group_id: guest.group_id || null, plus_one_of: guest.id, custom: {}, position: guests.length }]);
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

  return (
    <>
      <PageHeader back={{ href: back, label: "Invités" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: -14 }}>
        <span className="d-avatar" style={{ width: 56, height: 56, background: "#e4e2dc", fontSize: 20 }}>
          {label.charAt(0).toUpperCase()}
        </span>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6, minWidth: 0 }}>
          <h1 className="d-title">
            <InlineEdit value={fullName(guest)} placeholder={host ? `+1 de ${fullName(host)}` : "Sans nom"} label="nom de l'invité" onSave={(v) => dash.update("guests", guest.id, splitName(v))} />
          </h1>
          <span className="d-guest-sub" style={{ fontSize: 13 }}>
            <GroupCell guest={guest} group={groupById.get(guest.group_id)} groups={groups} label={label} small={false} />
            {host ? <span>Accompagne {fullName(host) || "un invité"}</span> : null}
            {guest.age !== null && guest.age !== undefined && guest.age !== "" ? <span>{guest.age} ans</span> : null}
          </span>
        </div>
      </div>

      <div className="d-grid-side" style={{ marginTop: 20 }}>
        <div className="d-col">
          <section className="d-card">
            {/* Les réponses ne gardent pas leur origine : on dit seulement que le formulaire peut les remplir */}
            {form ? (
              <span className="d-fm-tag is-opt d-autofill">
                <Icon name="sparkle" size={12} sw={2.2} />
                Se remplit aussi par le formulaire
              </span>
            ) : null}
            <h2>Réponses par moment</h2>
            {events.length ? (
              <div className="d-col" style={{ gap: 2 }}>
                {events.map((ev) => {
                  const a = answerOf(ev.id);
                  const st = r[ev.id] || "non_invite";
                  return (
                    <div key={ev.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, minHeight: 44, borderTop: "1px solid var(--d-line)" }}>
                      <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 14.5, fontWeight: 500 }}>{ev.name}</span>
                        {(st === "oui" || st === "non") && a?.updated_at ? <small className="d-muted">Mis à jour le {shortDate(a.updated_at.slice(0, 10))}</small> : null}
                      </span>
                      <RsvpMenu status={st} onPick={(k) => dash.setResponse(guest.id, ev.id, k)} title={`${ev.name} : modifier le statut`} />
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="d-small d-muted" style={{ margin: 0 }}>
                Pas encore de moment défini.
              </p>
            )}
          </section>

          <section className="d-card">
            <h2>Accompagnant{plusOnes.length > 1 ? "s" : ""}</h2>
            <div className="d-col" style={{ gap: 2 }}>
              {host ? (
                <a href={`/dashboard/invites/${host.id}`} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44, color: "var(--d-ink)", textDecoration: "none" }}>
                  <Icon name="chev" size={14} sw={2.2} style={{ transform: "rotate(180deg)" }} />
                  Accompagne {fullName(host) || "un invité sans nom"}
                </a>
              ) : null}
              {plusOnes.map((p) => (
                <a key={p.id} href={`/dashboard/invites/${p.id}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, minHeight: 44, color: "var(--d-ink)", textDecoration: "none" }}>
                  <span>{fullName(p) || "Accompagnant à nommer"} (+1)</span>
                  <Icon name="chev" size={14} sw={2.2} />
                </a>
              ))}
              {!host && !plusOnes.length ? (
                <p className="d-small d-muted" style={{ margin: "0 0 8px" }}>
                  Personne pour l'instant. Un accompagnant est un invité à part entière, invité aux mêmes moments.
                </p>
              ) : null}
            </div>
            {!host ? (
              <div>
                <Btn kind="ghost" small icon="plus" onClick={addPlusOne}>
                  Ajouter un accompagnant
                </Btn>
              </div>
            ) : null}
          </section>

          {pending && !host ? (
            <section className="d-card">
              <h2>Relancer</h2>
              <p className="d-small d-muted" style={{ margin: 0 }}>
                {remindedDays === null ? "Jamais relancé." : remindedDays === 0 ? "Relancé aujourd'hui." : remindedDays === 1 ? "Relancé hier." : `Relancé il y a ${remindedDays} jours.`}
                {link ? " Le message reprend le lien pour répondre." : " Créez d'abord le formulaire invités pour avoir un lien à envoyer."}
              </p>
              <div className="d-filters">
                {guest.email ? (
                  <Btn small icon="mail" href={mailHref(guest.email, relSubject, relText)}>
                    Mail
                  </Btn>
                ) : null}
                {waDigits(guest.phone) ? (
                  <Btn small kind="ghost" icon="bubble" href={waHref(guest.phone, relText)} target="_blank">
                    WhatsApp
                  </Btn>
                ) : null}
                {guest.phone ? (
                  <Btn small kind="ghost" icon="phone" href={smsHref(guest.phone, relText)}>
                    SMS
                  </Btn>
                ) : null}
                {dash.data.relancesSetup !== false ? (
                  <button type="button" className="d-pill" onClick={() => dash.update("guests", guest.id, { reminded_at: new Date().toISOString() })}>
                    <Icon name="check" size={14} sw={2.2} />
                    Marquer comme relancé
                  </button>
                ) : null}
              </div>
              {!guest.email && !guest.phone ? (
                <p className="d-small d-muted" style={{ margin: 0 }}>
                  Ni mail ni téléphone : ajoutez-en un dans Contact, ou passez par sa famille.
                </p>
              ) : null}
            </section>
          ) : null}

          {household.length ? (
            <section className="d-card">
              <h2>Foyer</h2>
              <p className="d-small d-muted" style={{ margin: 0 }}>
                Un faire-part, une adresse : {householdLabel([guest, ...household])}.
              </p>
              <div className="d-col" style={{ gap: 2 }}>
                {household.map((m) => (
                  <a key={m.id} href={`/dashboard/invites/${m.id}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, minHeight: 44, color: "var(--d-ink)", textDecoration: "none" }}>
                    <span>{fullName(m) || "Accompagnant à nommer"}</span>
                    <Icon name="chev" size={14} sw={2.2} />
                  </a>
                ))}
              </div>
              {guest.household_id ? (
                <div>
                  <Btn kind="ghost" small onClick={() => dash.update("guests", guest.id, { household_id: null })}>
                    Sortir du foyer
                  </Btn>
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="d-card">
            <h2>Note pour les organisateurs</h2>
            <GuestNote guest={guest} />
          </section>
        </div>

        <div className="d-col">
          <section className="d-card">
            <h2>Contact</h2>
            <div>
              <div className="d-contact-row">
                <Icon name="phone" size={16} style={{ marginTop: 3 }} />
                <div>
                  <small>Téléphone</small>
                  <InlineEdit value={guest.phone} placeholder="Ajouter" label="téléphone" onSave={(v) => dash.update("guests", guest.id, { phone: v })} />
                  {guest.phone ? (
                    <a href={telHref(guest.phone)} className="d-small">
                      Appeler
                    </a>
                  ) : null}
                </div>
              </div>
              <div className="d-contact-row">
                <Icon name="mail" size={16} style={{ marginTop: 3 }} />
                <div>
                  <small>Mail</small>
                  <InlineEdit value={guest.email} placeholder="Ajouter" label="mail" onSave={(v) => dash.update("guests", guest.id, { email: v })} />
                  {guest.email ? (
                    <a href={`mailto:${guest.email}`} className="d-small">
                      Écrire
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          <section className="d-card">
            <h2>Autres informations</h2>
            <div>
              <div className="d-contact-row">
                <Icon name="file" size={16} style={{ marginTop: 3 }} />
                <div>
                  <small>Régime</small>
                  <InlineEdit value={guest.diet} placeholder="Ajouter" label="régime" onSave={(v) => dash.update("guests", guest.id, { diet: v })} />
                </div>
              </div>
              <div className="d-contact-row">
                <Icon name="pin" size={16} style={{ marginTop: 3 }} />
                <div>
                  <small>Adresse</small>
                  <InlineEdit value={guest.address} placeholder="Ajouter" label="adresse" multiline onSave={(v) => dash.update("guests", guest.id, { address: v })} />
                </div>
              </div>
              <div className="d-contact-row">
                <Icon name="users" size={16} style={{ marginTop: 3 }} />
                <div>
                  <small>Âge (pour les enfants)</small>
                  <InlineEdit value={guest.age !== null && guest.age !== undefined ? String(guest.age) : ""} placeholder="Ajouter" label="âge" display={guest.age !== null && guest.age !== undefined && guest.age !== "" ? `${guest.age} ans` : undefined} onSave={(v) => dash.update("guests", guest.id, { age: parseAge(v) })} />
                </div>
              </div>
            </div>
          </section>

          {fields.length ? (
            <section className="d-card">
              <h2>Vos colonnes</h2>
              <div>
                {fields.map((f) => (
                  <div key={f.id} className="d-contact-row">
                    <Icon name={f.source === "invites" ? "sparkle" : "list"} size={16} style={{ marginTop: 3 }} />
                    <div>
                      <small>{f.name}</small>
                      {f.kind === "choice" ? <ChoiceCell value={(guest.custom || {})[f.id]} options={f.options} label={f.name} onChange={(v) => saveCustom(f, v)} /> : <InlineEdit value={(guest.custom || {})[f.id]} placeholder="Ajouter" label={f.name} onSave={(v) => saveCustom(f, v)} />}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <Btn kind="ghost" icon="trash" onClick={removeGuest}>
            Retirer de la liste
          </Btn>
        </div>
      </div>
    </>
  );
}

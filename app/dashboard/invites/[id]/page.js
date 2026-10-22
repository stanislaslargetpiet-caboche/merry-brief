"use client";

import { useParams, useRouter } from "next/navigation";
import { useMemo } from "react";
import { useDash } from "@/lib/dash/store";
import { responseIndex, guestLabel } from "@/lib/dash/model";
import { fullName } from "@/lib/dash/format";
import { Icon } from "@/components/dash/icons";
import { Btn, GroupChip, InlineEdit, PageHeader, RsvpMenu } from "@/components/dash/ui";

function splitName(s) {
  const parts = String(s || "").trim().split(/\s+/);
  return { first_name: parts.shift() || "", last_name: parts.join(" ") };
}

function telHref(phone) {
  return `tel:${String(phone || "").replace(/[^\d+]/g, "")}`;
}

export default function FicheInvite() {
  const { id } = useParams();
  const router = useRouter();
  const dash = useDash();
  const { guests, groups, events, responses } = dash.data;

  const guest = guests.find((g) => g.id === id);
  const idx = useMemo(() => responseIndex(responses), [responses]);
  const byId = useMemo(() => new Map(guests.map((g) => [g.id, g])), [guests]);
  const groupById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);

  if (!guest) return <PageHeader back={{ href: "/dashboard/invites", label: "Invités" }} title="Invité introuvable." />;

  const label = guestLabel(guest, byId) || "Sans nom";
  const r = idx.get(guest.id) || {};
  const host = guest.plus_one_of ? byId.get(guest.plus_one_of) : null;
  const plusOnes = guests.filter((g) => g.plus_one_of === guest.id);

  async function removeGuest() {
    if (!window.confirm(`Retirer ${label} de la liste ?`)) return;
    if (await dash.removeGuests([guest.id])) router.push("/dashboard/invites");
  }

  return (
    <>
      <PageHeader back={{ href: "/dashboard/invites", label: "Invités" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: -14 }}>
        <span className="d-avatar" style={{ width: 56, height: 56, background: "#e4e2dc", fontSize: 20 }}>
          {label.charAt(0).toUpperCase()}
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
          <h1 className="d-title">
            <InlineEdit value={fullName(guest)} placeholder={host ? `+1 de ${fullName(host)}` : "Sans nom"} label="nom de l'invité" onSave={(v) => dash.update("guests", guest.id, splitName(v))} />
          </h1>
          <GroupChip group={groupById.get(guest.group_id)} />
        </div>
      </div>

      <div className="d-grid-side" style={{ marginTop: 20 }}>
        <div className="d-col">
          <section className="d-card">
            <h2>Réponses par moment</h2>
            {events.length ? (
              <div className="d-col" style={{ gap: 2 }}>
                {events.map((ev) => (
                  <div key={ev.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, minHeight: 44, borderTop: "1px solid var(--d-line)" }}>
                    <span style={{ fontSize: 14.5, fontWeight: 500 }}>{ev.name}</span>
                    <RsvpMenu status={r[ev.id] || "non_invite"} onPick={(k) => dash.setResponse(guest.id, ev.id, k)} title={`${ev.name} : modifier le statut`} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="d-small d-muted" style={{ margin: 0 }}>
                Pas encore de moment défini.
              </p>
            )}
            <p className="d-small d-muted" style={{ margin: 0 }}>Chaque moment a sa propre réponse : un invité peut venir au dîner sans rester au brunch.</p>
          </section>

          {host || plusOnes.length ? (
            <section className="d-card">
              <h2>Accompagnant{plusOnes.length > 1 ? "s" : ""}</h2>
              <div className="d-col" style={{ gap: 2 }}>
                {host ? (
                  <a href={`/dashboard/invites/${host.id}`} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44, color: "var(--d-ink)", textDecoration: "none" }}>
                    <Icon name="chev" size={14} sw={2.2} style={{ transform: "rotate(180deg)" }} />
                    Accompagne {fullName(host)}
                  </a>
                ) : null}
                {plusOnes.map((p) => (
                  <a key={p.id} href={`/dashboard/invites/${p.id}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, minHeight: 44, color: "var(--d-ink)", textDecoration: "none" }}>
                    <span>{fullName(p) || "Accompagnant à nommer"} (+1)</span>
                    <Icon name="chev" size={14} sw={2.2} />
                  </a>
                ))}
              </div>
            </section>
          ) : null}
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
            </div>
          </section>

          <Btn kind="ghost" icon="trash" onClick={removeGuest}>
            Retirer de la liste
          </Btn>
        </div>
      </div>
    </>
  );
}

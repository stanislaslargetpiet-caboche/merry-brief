"use client";

// Accueil de l'espace prestataire (maquettes V1 et V1m)

import Link from "next/link";
import { usePro } from "@/lib/pro/store";
import { completeness, dateLong, firstName, guestsText, monthName, since, todayIsoLocal, todayLabel, weddingWhen } from "@/lib/pro/format";
import { dayMonth, shortDate, today } from "@/lib/dash/format";
import { ProIcon } from "@/components/pro/icons";
import { Face } from "@/components/pro/ui";

export default function ProHome() {
  const pro = usePro();
  const d = pro.data;
  const v = d.vendor;
  const fill = completeness(d);
  const clients = d.clients || [];
  const byId = new Map(clients.map((c) => [c.id, c]));
  const todo = (d.requests || []).filter((r) => !r.answered).slice(0, 3);
  const now = todayIsoLocal();
  const chase = clients.filter((c) => ["devis", "visite", "reserve"].includes(c.stage) && c.next_action_on && c.next_action_on <= now).slice(0, 4);
  const booked = (d.dates || [])
    .filter((x) => x.status === "reserve" && x.day >= now)
    .sort((a, b) => a.day.localeCompare(b.day))
    .slice(0, 3);
  const plan = (d.offer?.plans || []).find((p) => p.key === d.pro?.plan);
  const credits = d.pro?.credits ?? 0;

  return (
    <>
      <div className="p-head">
        <div className="p-head-text">
          <h1 className="p-h1">Bonjour {v.name}</h1>
          <p className="p-lead">{todayLabel()}</p>
        </div>
        <Link href="/pro/fiche?apercu=1" className="p-btn p-btn-ghost p-desk-only">
          Voir ma fiche publique
        </Link>
      </div>

      <section className="p-fill">
        <div className="p-fill-head">
          <h2>{fill.pct === 100 ? "Votre fiche est complète" : `Votre fiche est complète à ${fill.pct} %`}</h2>
          <Link href="/pro/fiche" className="p-link is-small">
            Voir ma fiche
          </Link>
        </div>
        <div role="progressbar" aria-label="Fiche complète" aria-valuemin={0} aria-valuemax={100} aria-valuenow={fill.pct} className="p-bar">
          <span style={{ width: `${fill.pct}%` }} />
        </div>
        {fill.next ? (
          <div className="p-fill-next">
            <span>
              <span className="p-muted">Prochaine étape :</span> {fill.next.label}
            </span>
            <Link href={fill.next.href || `/pro/fiche#${fill.next.anchor}`} className="p-link">
              {fill.next.action}
              <ProIcon name="arrow" size={16} sw={2} />
            </Link>
          </div>
        ) : null}
      </section>

      <div className="p-home-grid">
        <div className="p-col">
          <section className="p-card p-todo">
            <div className="p-card-head">
              <h2>Demandes à traiter</h2>
              <Link href="/pro/demandes" className="p-link is-small">
                Toutes les demandes
              </Link>
            </div>
            {todo.length ? (
              <ul className="p-rows">
                {todo.map((r) => {
                  const c = byId.get(r.client_id) || {};
                  return (
                    <li key={r.client_id} className="p-todo-row">
                      <Face names={r.names} />
                      <div className="p-who">
                        <span className="p-who-name">{r.names}</span>
                        <span className="p-who-meta">{[weddingWhen({ ...c, wedding_date: c.wedding_date || r.wedding_date }), guestsText(c.guests)].filter(Boolean).join(" · ")}</span>
                        <span className="p-who-when p-phone-block">{since(r.requested_at)}</span>
                      </div>
                      <span className="p-who-when p-desk-only">{since(r.requested_at)}</span>
                      <Link href={`/pro/demandes?demande=${r.client_id}`} className="p-btn p-btn-primary is-40">
                        Répondre
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="p-empty-line">Aucune demande en attente. Les demandes des couples arrivent ici, gratuitement.</p>
            )}
          </section>

          {chase.length ? (
            <section className="p-block">
              <h2 className="p-h2">À relancer aujourd’hui</h2>
              <ul className="p-chase">
                {chase.map((c) => (
                  <li key={c.id}>
                    <div className="p-chase-who">
                      <Face names={c.names} size={40} />
                      <div className="p-who">
                        <span className="p-who-name">{c.names}</span>
                        <span className="p-who-meta is-small">{[weddingWhen(c), guestsText(c.guests)].filter(Boolean).join(" · ")}</span>
                      </div>
                    </div>
                    <p>{chaseText(c)}</p>
                    <div className="p-chase-actions">
                      <Link href={`/pro/clients?client=${c.id}&ecrire=1`} className="p-btn p-btn-ghost is-40">
                        {c.stage === "reserve" ? "Envoyer un rappel" : `Relancer ${firstName(c.names)}`}
                      </Link>
                      <Link href={`/pro/clients?client=${c.id}`} className="p-link is-small is-muted">
                        Voir le dossier
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <div className="p-col is-side">
          <section className="p-card p-booked">
            <div className="p-card-head">
              <h2>Prochaines dates réservées</h2>
            </div>
            {booked.length ? (
              <ul className="p-rows">
                {booked.map((x) => (
                  <li key={x.id} className="p-booked-row">
                    <span className="p-booked-day">{dateLong(x.day)}</span>
                    <span className="p-booked-who">{byId.get(x.client_id)?.names || x.label || "Réservé"}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-empty-line">Aucune date réservée pour l’instant.</p>
            )}
            <Link href="/pro/disponibilites" className="p-link is-small">
              Voir le calendrier
              <ProIcon name="arrow" size={16} sw={2} />
            </Link>
          </section>

          <section className="p-block is-tight">
            <div className="p-month-head">
              <h2>Ce mois-ci</h2>
              <span>{monthName(today())}</span>
            </div>
            <div className="p-stats">
              <div>
                <span className="p-stat">{d.stats?.views ?? 0}</span>
                <span className="p-stat-label">Vues de votre fiche</span>
              </div>
              <div>
                <span className="p-stat">{d.stats?.picks ?? 0}</span>
                <span className="p-stat-label">Ajouts aux sélections</span>
              </div>
              <div>
                <span className="p-stat">{d.stats?.requests ?? 0}</span>
                <span className="p-stat-label">Demandes de devis</span>
              </div>
            </div>
          </section>

          <section className="p-credits-card">
            <h2>Vos crédits</h2>
            <span className="p-credits-big">
              {credits} crédit{credits > 1 ? "s" : ""}
            </span>
            <div className="p-credits-plan">
              <span>Formule {plan?.name || "Essentiel"}</span>
              {d.pro?.renews_on ? <span className="p-muted">Renouvellement le {dayMonth(d.pro.renews_on)}</span> : null}
            </div>
            <Link href="/pro/credits" className="p-link">
              Acheter des crédits
              <ProIcon name="arrow" size={16} sw={2} />
            </Link>
          </section>
        </div>
      </div>

      <Link href="/pro/fiche?apercu=1" className="p-btn p-btn-ghost p-phone-only p-full">
        Voir ma fiche publique
      </Link>
    </>
  );
}

// Ce qui attend le prestataire pour ce couple
function chaseText(c) {
  if (c.stage === "devis") return c.answered_at ? `Devis envoyé le ${shortDate(String(c.answered_at).slice(0, 10))}, pas encore de réponse.` : `${c.next_action || "Relancer"}.`;
  if (c.stage === "reserve" && c.notes) return c.notes;
  return `${c.next_action || "À relancer"}${c.next_action_on ? `, prévu le ${dayMonth(c.next_action_on)}` : ""}.`;
}

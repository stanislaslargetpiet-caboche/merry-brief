"use client";

// Accueil de l'espace prestataire (maquettes Vendor-Accueil / -Tel). Refait le 3 nov. 2026 pour
// suivre le canvas de près, à la demande de Stan : bandeau de 4 chiffres, puis 3 cartes (Crédits,
// Temps de réponse, Fiche complète) sur ordinateur — une ligne de 3 chiffres sur téléphone — puis un
// seul flux « Demandes » (nouveaux leads et demandes déjà répondues), à la place des sections séparées
// (à traiter, à relancer, prochaines dates, ce mois-ci, vos performances, vos crédits) de l'ancienne
// maquette V1. « Leads intrants » = demandes non répondues reçues dans les 7 derniers jours ;
// « Demandes live » = clients en cours de discussion (devis ou visite) — le canvas ne précise pas ces
// deux définitions, ce sont les plus proches de ce que les données existantes permettent de calculer.

import Link from "next/link";
import { usePro } from "@/lib/pro/store";
import { completeness, creditsRoi, guestsText, responseStats, since, weddingWhen } from "@/lib/pro/format";
import { Face } from "@/components/pro/ui";

const WEEK_MS = 7 * 24 * 3600 * 1000;

export default function ProHome() {
  const pro = usePro();
  const d = pro.data;
  const v = d.vendor;
  const fill = completeness(d);
  const clients = d.clients || [];
  const byId = new Map(clients.map((c) => [c.id, c]));
  const requests = d.requests || [];
  const answered = requests.filter((r) => r.answered);
  const now = Date.now();
  const incoming = requests.filter((r) => !r.answered && now - new Date(r.requested_at).getTime() < WEEK_MS);
  const live = clients.filter((c) => ["devis", "visite"].includes(c.stage));
  const credits = d.pro?.credits ?? 0;
  const resp = responseStats(d);
  const roi = creditsRoi(d);
  // Les demandes les plus récentes, nouvelles ou déjà répondues, comme un fil d'activité
  const feed = [...requests].sort((a, b) => new Date(b.requested_at) - new Date(a.requested_at)).slice(0, 5);

  return (
    <>
      <div className="p-head">
        <h1 className="p-h1 is-page">Dashboard.</h1>
        <Link href="/pro/demandes" className="p-btn p-btn-ghost">
          Toutes les demandes
        </Link>
      </div>

      <div className="p-acc-stats">
        <div>
          <b>{requests.length}</b>
          <span>Demandes reçues</span>
        </div>
        <div>
          <b>{live.length}</b>
          <span>Demandes live</span>
        </div>
        <div>
          <b className="is-amber">{incoming.length}</b>
          <span>Leads intrants</span>
        </div>
        <div>
          <b>{answered.length}</b>
          <span>Répondues</span>
        </div>
      </div>

      <div className="p-acc-cards p-desk-only">
        <div className="p-acc-card">
          <div className="p-acc-card-head">
            <span>Crédits</span>
            <Link href="/pro/credits" className="p-link is-small">
              Détail
            </Link>
          </div>
          <span className="p-acc-card-n">
            {credits} <small>/ 100</small>
          </span>
          <span className="p-acc-bar">
            <span style={{ width: `${Math.min(100, credits)}%` }} />
          </span>
        </div>
        <div className="p-acc-card">
          <span className="p-acc-card-label">Temps de réponse</span>
          <span className="p-acc-resp">
            <span className="p-acc-card-n">{resp ? `${resp.avgHours} h` : "—"}</span>
            {resp && resp.avgHours <= 4 ? <span className="p-chip-fast">Répond vite</span> : null}
          </span>
        </div>
        <div className="p-acc-card">
          <div className="p-acc-card-head">
            <span>Fiche complète</span>
            <Link href="/pro/fiche" className="p-link is-small">
              Compléter
            </Link>
          </div>
          <span className="p-acc-card-n">{fill.pct} %</span>
          <span className="p-acc-bar is-ink">
            <span style={{ width: `${fill.pct}%` }} />
          </span>
        </div>
      </div>

      <div className="p-acc-perf p-phone-only">
        <div>
          <span>Temps de réponse</span>
          <b>{resp ? `${resp.avgHours} h` : "—"}</b>
        </div>
        <div>
          <span>Coût / résa</span>
          <b>{roi.perBooking !== null ? `${roi.perBooking} crédits` : "—"}</b>
        </div>
        <div>
          <span>Note Google</span>
          <b>{v.google_rating ? `${v.google_rating.toLocaleString("fr-FR")}${v.google_review_count ? ` · ${v.google_review_count} avis` : ""}` : "—"}</b>
        </div>
      </div>

      <section className="p-card p-acc-feed" aria-label="Demandes">
        <h2 className="p-h2">Demandes</h2>
        {feed.length ? (
          <ul className="p-rows">
            {feed.map((r) => {
              const c = byId.get(r.client_id) || {};
              return (
                <li key={r.client_id} className="p-acc-row">
                  <Face names={r.names} />
                  <div className="p-who">
                    <span className="p-who-name">{r.names}</span>
                    <span className="p-who-meta">{[weddingWhen({ ...c, wedding_date: c.wedding_date || r.wedding_date }), guestsText(c.guests), since(r.requested_at)].filter(Boolean).join(" · ")}</span>
                  </div>
                  <span className={`p-chip ${r.answered ? "is-answered" : "is-live"}`}>{r.answered ? "Répondue" : "Nouveau lead"}</span>
                  <Link href={`/pro/demandes?demande=${r.client_id}`} className={`p-btn ${r.answered ? "p-btn-ghost" : "p-btn-primary"} is-40`}>
                    {r.answered ? "Voir" : "Répondre"}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="p-empty-line">Aucune demande en attente. Les demandes des couples arrivent ici, gratuitement.</p>
        )}
        <Link href="/pro/demandes" className="p-link p-phone-only p-acc-more">
          Voir toutes les demandes
        </Link>
      </section>
    </>
  );
}

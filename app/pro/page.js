"use client";

// Dashboard de l'espace prestataire (maquettes Vendor-Accueil / -Tel, revu après l'audit du 3 nov. 2026) :
// 3 chiffres qui parlent d'eux-mêmes (à traiter, répondues, réservées), 3 cartes (temps de réponse, coût
// moyen par réservation, fiche complète) sur ordinateur comme sur téléphone, puis le fil des dernières
// demandes. Le solde de crédits n'est plus répété ici : il est déjà dans la barre latérale (ou l'en-tête
// sur téléphone).

import Link from "next/link";
import { usePro } from "@/lib/pro/store";
import { completeness, guestsText, isPastClient, since, weddingWhen } from "@/lib/pro/format";
import { CreditsCoins, ProIcon } from "@/components/pro/icons";
import { Face } from "@/components/pro/ui";

export default function ProHome() {
  const pro = usePro();
  const d = pro.data;
  const fill = completeness(d);
  const clients = d.clients || [];
  const byId = new Map(clients.map((c) => [c.id, c]));
  const requests = d.requests || [];
  const answered = requests.filter((r) => r.answered);
  const todo = requests.filter((r) => !r.answered);
  const booked = clients.filter((c) => c.stage === "reserve" && !isPastClient(c));
  const credits = d.pro?.credits ?? 0;
  const views7d = d.stats?.views_7d ?? 0;
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
          <span className="p-acc-top">À traiter</span>
          <span className="p-acc-value">
            <ProIcon name="a_traiter" size={20} />
            <b className={todo.length ? "is-amber" : ""}>{todo.length}</b>
          </span>
        </div>
        <div>
          <span className="p-acc-top">Répondues</span>
          <span className="p-acc-value">
            <ProIcon name="messagerie" size={20} />
            <b>{answered.length}</b>
          </span>
        </div>
        <div>
          <span className="p-acc-top">Réservées</span>
          <span className="p-acc-value">
            <ProIcon name="confirmer" size={20} />
            <b>{booked.length}</b>
          </span>
        </div>
      </div>

      <div className="p-acc-cards">
        <div className="p-acc-card">
          <span className="p-acc-card-label">Vues de la fiche (7 jours)</span>
          <span className="p-acc-card-bottom">
            <span className="p-acc-card-n">{views7d} vues</span>
          </span>
        </div>
        <div className="p-acc-card">
          <span className="p-acc-card-label">Nombre de crédits restants</span>
          <span className="p-acc-card-bottom">
            <span className="p-acc-card-n p-acc-card-n-credits">
              <CreditsCoins size={22} />
              {credits} crédits
            </span>
          </span>
        </div>
        <div className="p-acc-card">
          <div className="p-acc-card-head">
            <span>Fiche complète</span>
            {fill.pct < 100 ? (
              <Link href="/pro/fiche" className="p-link is-small">
                Compléter
              </Link>
            ) : null}
          </div>
          <span className="p-acc-card-bottom">
            <span className="p-acc-card-n">{fill.pct} %</span>
            <span className="p-acc-bar is-ink">
              <span style={{ width: `${fill.pct}%` }} />
            </span>
          </span>
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
                    <span className="p-who-meta">{[weddingWhen({ ...c, wedding_date: c.wedding_date || r.wedding_date }), guestsText(c.guests), since(r.requested_at).toLowerCase()].filter(Boolean).join(" · ")}</span>
                  </div>
                  <span className={`p-chip ${r.answered ? "is-answered" : "is-live"}`}>{r.answered ? "Répondue" : "À traiter"}</span>
                  <Link href={`/pro/demandes?demande=${r.client_id}`} className={`p-btn ${r.answered ? "p-btn-ghost" : "p-btn-primary"} is-40`}>
                    {r.answered ? "Voir" : "Répondre"}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="p-empty-line">Aucune demande pour l’instant.</p>
        )}
      </section>
    </>
  );
}

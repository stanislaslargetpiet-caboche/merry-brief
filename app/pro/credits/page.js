"use client";

// Crédits : ce que les crédits ont rapporté, ce que coûte une réponse selon le métier, et l'historique.
// Modèle à crédits façon Bark (27 oct. 2026) : la première réponse à une demande débite le coût du métier
// (pro_send en base, REPLY_COSTS à l'écran). L'achat de crédits est désactivé pour l'instant (décision de
// Stan le 3 nov. 2026) : pas de packs ni de formulaire de paiement tant que le paiement n'est pas branché.

import { usePro } from "@/lib/pro/store";
import { creditsRoi } from "@/lib/pro/format";
import { shortDate } from "@/lib/dash/format";
import { CreditsCoins } from "@/components/pro/icons";
import { ProSubnav } from "@/components/pro/ui";
import { PRO_PROFIL_TABS } from "@/components/pro/Shell";

const count = (n) => `${n} crédit${n > 1 ? "s" : ""}`;
const delta = (n) => (n > 0 ? `+${n}` : `−${Math.abs(n)}`);

export default function Credits() {
  const pro = usePro();
  const d = pro.data;
  const roi = creditsRoi(d);
  const credits = d.pro?.credits ?? 0;
  const active = roi.used > 0 || roi.answered > 0;

  return (
    <div className="p-credits">
      <h1 className="p-h1 is-page">Crédits.</h1>
      <ProSubnav items={PRO_PROFIL_TABS} label="Sections de Mon profil" />

      <section className="p-credits-card">
        <h2>Crédits disponibles</h2>
        <span className="p-credits-big">
          {credits}
          <CreditsCoins size={30} />
        </span>
      </section>

      {active ? (
        <section className="p-block is-tight">
          <div className="p-month-head">
            <h2>Ce que vos crédits ont rapporté</h2>
          </div>
          <div className="p-stats is-4">
            <div>
              <span className="p-stat">{roi.used}</span>
              <span className="p-stat-label">Crédits dépensés</span>
            </div>
            <div>
              <span className="p-stat">{roi.answered}</span>
              <span className="p-stat-label">Demandes répondues</span>
            </div>
            <div>
              <span className="p-stat">{roi.bookings}</span>
              <span className="p-stat-label">Réservations</span>
            </div>
            <div>
              <span className="p-stat is-amber">{roi.perBooking !== null ? count(roi.perBooking) : "—"}</span>
              <span className="p-stat-label">Coût moyen par réservation</span>
            </div>
          </div>
        </section>
      ) : null}

      <section className="p-block is-6">
        <h2 className="p-h2 is-20">Historique</h2>
        {d.ledger?.length ? (
          <>
            <table className="p-ledger">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Libellé</th>
                  <th scope="col">Crédits</th>
                  <th scope="col">Solde</th>
                </tr>
              </thead>
              <tbody>
                {d.ledger.map((l) => (
                  <tr key={l.id}>
                    <td className="p-muted">{shortDate(String(l.at).slice(0, 10))}</td>
                    <td className="p-ledger-label">{l.label}</td>
                    <td className="p-ledger-n">{delta(l.delta)}</td>
                    <td className="p-ledger-b">{l.balance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="p-rows p-ledger-list">
              {d.ledger.map((l) => (
                <li key={l.id}>
                  <span>
                    <span className="p-ledger-label">{l.label}</span>
                    <span className="p-muted">
                      {shortDate(String(l.at).slice(0, 10))} · solde {l.balance}
                    </span>
                  </span>
                  <span className="p-ledger-n">{delta(l.delta)}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="p-empty-line">Aucun mouvement pour l’instant.</p>
        )}
      </section>
    </div>
  );
}

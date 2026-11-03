"use client";

// Crédits (maquettes V8, V8b et V8m) : solde, packs de crédits, coût par métier et historique.
// Modèle à crédits façon Bark, sans abonnement (décision de Stan le 27 oct. 2026, notes/projet.md) :
// 1 crédit = 0,90 €, packs de 50/150/400, 100 crédits offerts à l'inscription, coût d'une réponse
// selon le métier (indicatif, modulé par le budget du couple), Garantie Merry si aucune réservation.
// Prix et nombres de crédits viennent de pro_offer (à remplir par Merry) avec ce repli par défaut.
// Le paiement n'est pas encore branché : les champs de carte restent inactifs, rien n'est saisi ni envoyé.

import { useState } from "react";
import { usePro } from "@/lib/pro/store";
import { creditsRoi } from "@/lib/pro/format";
import { euros, shortDate } from "@/lib/dash/format";
import { ProIcon } from "@/components/pro/icons";
import { ProSubnav, Sheet } from "@/components/pro/ui";
import { PRO_PROFIL_TABS } from "@/components/pro/Shell";
import { CloseBtn } from "@/components/pro/FeatureDialog";

const CREDIT_PRICE_LABEL = "0,90 €";
const DEFAULT_PACKS = [
  { credits: 50, price: 45 },
  { credits: 150, price: 135 },
  { credits: 400, price: 360 },
];
// Coût indicatif d'une réponse par métier (notes/projet.md, décision du 27 oct.) : varie aussi selon
// le budget du couple pour ce poste, non modélisé ici.
const METIERS = [
  { label: "Lieu de réception", icon: "fiche", cost: 25 },
  { label: "Traiteur", icon: "fork", cost: 20 },
  { label: "Photographe", icon: "camera", cost: 15 },
  { label: "DJ, animation", icon: "headphones", cost: 10 },
  { label: "Fleuriste", icon: "flower", cost: 8 },
];
const METIER_MAX = METIERS[0].cost;

const money = (n) => (n === null || n === undefined ? "Prix à définir" : euros(n));
const count = (n) => (n === null || n === undefined ? "Crédits à définir" : `${n} crédit${n > 1 ? "s" : ""}`);

export default function Credits() {
  const pro = usePro();
  const d = pro.data;
  const offer = d.offer || {};
  const [buying, setBuying] = useState(null);
  const credits = d.pro?.credits ?? 0;
  const packs = offer.packs?.length && offer.packs.every((p) => p.credits && p.price) ? offer.packs : DEFAULT_PACKS;
  const roi = creditsRoi(d);

  return (
    <div className="p-credits">
      <div className="p-credits-head">
        <h1 className="p-h1 is-48">
          {credits} crédit{credits > 1 ? "s" : ""}
        </h1>
        <p className="p-lead">{CREDIT_PRICE_LABEL} le crédit · sans abonnement</p>
      </div>
      <ProSubnav items={PRO_PROFIL_TABS} label="Sections de Mon profil" />

      <section className="p-block is-tight">
        <div className="p-month-head">
          <h2>Ce que vos crédits ont rapporté</h2>
        </div>
        <div className="p-roi-stats">
          <div className="p-roi-stat">
            <span className="p-roi-stat-icon">
              <ProIcon name="credits" size={16} />
            </span>
            <span className="p-roi-stat-n">{roi.used}</span>
            <span className="p-roi-stat-label">Crédits dépensés</span>
          </div>
          <div className="p-roi-stat">
            <span className="p-roi-stat-icon">
              <ProIcon name="demandes" size={16} />
            </span>
            <span className="p-roi-stat-n">{roi.answered}</span>
            <span className="p-roi-stat-label">Demandes répondues</span>
          </div>
          <div className="p-roi-stat">
            <span className="p-roi-stat-icon">
              <ProIcon name="calendar" size={16} />
            </span>
            <span className="p-roi-stat-n">{roi.bookings}</span>
            <span className="p-roi-stat-label">Réservations</span>
          </div>
          <div className="p-roi-stat">
            <span className="p-roi-stat-icon">
              <ProIcon name="credits" size={16} />
            </span>
            <span className="p-roi-stat-n is-amber">{roi.perBooking !== null ? `${roi.perBooking} crédits` : "—"}</span>
            <span className="p-roi-stat-label">Coût moyen par réservation</span>
          </div>
        </div>
      </section>

      <section className="p-block is-14">
        <h2 className="p-h2 is-20">Acheter des crédits</h2>
        <ul className="p-packs">
          {packs.map((k, i) => (
            <li key={i}>
              <div className="p-pack-top">
                <span className="p-pack-icon">
                  <ProIcon name="credits" size={16} />
                </span>
                <div>
                  <span className="p-pack-n">{count(k.credits)}</span>
                  <span className="p-pack-p">{money(k.price)}</span>
                </div>
              </div>
              <button type="button" className="p-btn p-btn-ghost p-start" onClick={() => setBuying(i)}>
                Acheter
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="p-card p-explain">
        <h2>Combien de crédits par demande</h2>
        <div className="p-metiers">
          {METIERS.map((m) => (
            <div key={m.label} className="p-metier-row">
              <span className="p-metier-icon">
                <ProIcon name={m.icon} size={17} />
              </span>
              <span className="p-metier-name">{m.label}</span>
              <span className="p-metier-bar">
                <span style={{ width: `${Math.round((m.cost / METIER_MAX) * 100)}%` }} />
              </span>
              <span className="p-metier-cost">{count(m.cost)}</span>
            </div>
          ))}
        </div>
        <p className="p-hint">Nombre moyen de crédits par demande. Il varie aussi selon le budget du couple pour ce poste.</p>
        <div className="p-guarantee">
          <span className="p-guarantee-icon">
            <ProIcon name="shield" size={20} />
          </span>
          <p>
            <b>Garantie Merry.</b> Aucune réservation avec vos 100 crédits offerts&nbsp;? Nous vous les recréditons.
          </p>
        </div>
      </section>

      <section className="p-block is-6">
        <div className="p-sec-row">
          <h2 className="p-h2 is-20">Historique</h2>
          <button type="button" className="p-link" onClick={() => pro.setToast({ kind: "ok", text: "Vos factures apparaîtront ici après votre premier paiement." })}>
            <ProIcon name="file" size={16} />
            Factures
          </button>
        </div>
        {d.ledger?.length ? (
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
                  <td className="p-ledger-n">{l.delta > 0 ? `+${l.delta}` : `−${Math.abs(l.delta)}`}</td>
                  <td className="p-ledger-b">{l.balance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        {d.ledger?.length ? (
          <ul className="p-rows p-ledger-list">
            {d.ledger.map((l) => (
              <li key={l.id}>
                <span>
                  <span className="p-ledger-label">{l.label}</span>
                  <span className="p-muted">
                    {shortDate(String(l.at).slice(0, 10))} · solde {l.balance}
                  </span>
                </span>
                <span className="p-ledger-n">{l.delta > 0 ? `+${l.delta}` : `−${Math.abs(l.delta)}`}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-empty-line">Aucun mouvement pour l’instant.</p>
        )}
      </section>

      {buying !== null ? <BuyDialog packs={packs} initial={buying} onClose={() => setBuying(null)} /> : null}
    </div>
  );
}

function BuyDialog({ packs, initial, onClose }) {
  const [pick, setPick] = useState(initial);
  const total = packs[pick]?.price;
  return (
    <Sheet labelledBy="achat-titre" onClose={onClose} className="p-buy">
      <div className="p-sheet-head is-center">
        <h2 id="achat-titre">Acheter des crédits</h2>
        <CloseBtn onClose={onClose} />
      </div>
      <p className="p-hint">
        Choisissez un montant. {CREDIT_PRICE_LABEL} par crédit, sans abonnement.
      </p>
      <div role="radiogroup" aria-label="Pack de crédits" className="p-buy-packs">
        {packs.map((k, i) => (
          <label key={i} className={`p-buy-pack${pick === i ? " is-on" : ""}`}>
            <span>
              <input type="radio" name="pack" checked={pick === i} onChange={() => setPick(i)} />
              <span className="p-buy-n">{count(k.credits)}</span>
            </span>
            <span className="p-muted">{money(k.price)}</span>
          </label>
        ))}
      </div>
      <fieldset className="p-card-fields" disabled aria-describedby="pay-soon">
        <label htmlFor="cc">Carte bancaire</label>
        <div className="p-input p-unit">
          <ProIcon name="card" size={16} stroke="#6b6a63" />
          <input id="cc" type="text" inputMode="numeric" className="p-unit-input" placeholder="1234 1234 1234 1234" autoComplete="off" />
        </div>
        <div className="p-grid2">
          <label htmlFor="exp" className="p-sr">
            Date d’expiration
          </label>
          <input id="exp" type="text" className="p-input" placeholder="MM / AA" autoComplete="off" />
          <label htmlFor="cvc" className="p-sr">
            Cryptogramme
          </label>
          <input id="cvc" type="text" inputMode="numeric" className="p-input" placeholder="CVC" autoComplete="off" />
        </div>
        <p id="pay-soon" className="p-hint">
          Le paiement en ligne arrive bientôt : il passera par notre prestataire de paiement sécurisé.
        </p>
      </fieldset>
      <div className="p-buy-total">
        <span>Total</span>
        <span>{money(total)}</span>
      </div>
      <button type="button" className="p-btn p-btn-primary is-big p-full" disabled>
        Payer {total === null || total === undefined ? "" : euros(total)}
      </button>
    </Sheet>
  );
}

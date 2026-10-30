"use client";

// Crédits (maquettes V8, V8b et V8m) : solde, formules d'abonnement, packs de crédits et historique.
// Prix et nombres de crédits viennent de pro_offer (à remplir par Merry). Le paiement n'est pas encore
// branché : les champs de carte restent inactifs, rien n'est saisi ni envoyé.

import { useState } from "react";
import { usePro } from "@/lib/pro/store";
import { dayMonth, euros, shortDate } from "@/lib/dash/format";
import { ProIcon } from "@/components/pro/icons";
import { Sheet } from "@/components/pro/ui";
import { CloseBtn } from "@/components/pro/FeatureDialog";

const PERKS = {
  essentiel: ["Votre fiche sur Merry", "Les demandes des couples", "Agenda et suivi des clients"],
  confort: ["Tout ce qu’offre Essentiel", "Les projets de mariage de votre région", "Vos devis depuis vos formules"],
  pro: ["Tout ce qu’offre Confort", "Plusieurs comptes pour votre équipe", "Un interlocuteur dédié chez Merry"],
};
const SOON = "Le paiement en ligne arrive bientôt : il passera par notre prestataire de paiement sécurisé.";

const money = (n) => (n === null || n === undefined ? "Prix à définir" : euros(n));
const count = (n) => (n === null || n === undefined ? "Crédits à définir" : `${n} crédit${n > 1 ? "s" : ""}`);

export default function Credits() {
  const pro = usePro();
  const d = pro.data;
  const offer = d.offer || {};
  const plans = offer.plans?.length ? offer.plans : [{ key: "essentiel", name: "Essentiel" }, { key: "confort", name: "Confort" }, { key: "pro", name: "Pro" }];
  const mine = plans.find((p) => p.key === d.pro?.plan) || plans[0];
  const [billing, setBilling] = useState(d.pro?.billing || "mensuel");
  const [buying, setBuying] = useState(null);
  const credits = d.pro?.credits ?? 0;
  const packs = offer.packs?.length ? offer.packs : [];

  return (
    <div className="p-credits">
      <div className="p-credits-head">
        <span className="p-eyebrow">Vos crédits</span>
        <h1 className="p-h1 is-48">
          {credits} crédit{credits > 1 ? "s" : ""}
        </h1>
        <p className="p-lead">
          Formule {mine.name}
          {d.pro?.renews_on ? ` · Renouvellement le ${dayMonth(d.pro.renews_on)}` : ""}
        </p>
      </div>

      <section className="p-block is-16">
        <h2 className="p-h2 is-20">Abonnement</h2>
        <div>
          <div role="radiogroup" aria-label="Facturation" className="p-seg">
            <button type="button" role="radio" aria-checked={billing === "mensuel"} className={billing === "mensuel" ? "is-on" : ""} onClick={() => setBilling("mensuel")}>
              Mensuel
            </button>
            <button type="button" role="radio" aria-checked={billing === "annuel"} className={billing === "annuel" ? "is-on" : ""} onClick={() => setBilling("annuel")}>
              Annuel
              <span className="p-seg-tag">2 mois offerts</span>
            </button>
          </div>
        </div>
        <ul className="p-plans">
          {plans.map((p) => {
            const current = p.key === mine.key;
            const price = billing === "annuel" ? p.yearly : p.monthly;
            return (
              <li key={p.key} className={`p-plan${current ? " is-current" : ""}`}>
                <div className="p-plan-top">
                  <h3>{p.name}</h3>
                  {current ? <span className="p-chip is-live">Votre formule</span> : null}
                </div>
                <div className="p-plan-price">
                  <span className="p-plan-amount">
                    {money(price)} <span>{price === null || price === undefined ? "" : billing === "annuel" ? "par an" : "par mois"}</span>
                  </span>
                  <span className="p-plan-credits">{p.credits === null || p.credits === undefined ? "Crédits par mois à définir" : `${p.credits} crédits par mois`}</span>
                </div>
                <ul className="p-checks is-plan">
                  {(PERKS[p.key] || []).map((t) => (
                    <li key={t}>
                      <ProIcon name="check" size={15} sw={2.4} stroke="#8a3f1c" style={{ flex: "none", marginTop: 2 }} />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
                <div className="p-plan-foot">
                  {current ? (
                    <span className="p-plan-now">Formule actuelle</span>
                  ) : (
                    <button type="button" className="p-btn p-btn-ghost" onClick={() => pro.setToast({ kind: "ok", text: SOON })}>
                      Choisir {p.name}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="p-block is-14">
        <h2 className="p-h2 is-20">Crédits supplémentaires</h2>
        <ul className="p-packs">
          {(packs.length ? packs : [{}, {}, {}]).map((k, i) => (
            <li key={i}>
              <div>
                <span className="p-pack-n">{count(k.credits)}</span>
                <span className="p-pack-p">{money(k.price)}</span>
              </div>
              <button type="button" className="p-btn p-btn-ghost p-start" onClick={() => setBuying(i)}>
                Acheter
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="p-card p-explain">
        <h2>Comment sont utilisés les crédits</h2>
        <p>{offer.explainer || "Les demandes des couples restent gratuites. Les crédits servent à débloquer les projets de mariage de votre région : vous voyez alors le couple, son brief complet et son message, et vous pouvez lui écrire."}</p>
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

      {buying !== null ? <BuyDialog packs={packs.length ? packs : [{}, {}, {}]} initial={buying} onClose={() => setBuying(null)} /> : null}
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
          {SOON}
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

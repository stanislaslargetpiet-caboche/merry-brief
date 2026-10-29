"use client";

// Onglet « Répartition » du budget (artboard 2b) : le total payé, qui a payé combien, la règle de répartition
// que le couple choisit (une jauge, un curseur par personne), puis les virements qui remettent chacun à sa part.
// La règle est commune aux organisateurs (weddings.layouts.partage.shares, en pourcentages).

import { useEffect, useState } from "react";
import { pastel } from "@/lib/dash/theme";
import { useDash } from "@/lib/dash/store";
import { paidByPayer } from "@/lib/dash/model";
import { euros, pctLabel } from "@/lib/dash/format";
import { Icon } from "@/components/dash/icons";
import { Avatar, Btn, Section } from "@/components/dash/ui";
import BudgetHeader from "@/components/dash/BudgetTabs";
import DepenseModal from "@/components/dash/DepenseModal";

// Virements qui remettent chacun à sa part : le plus gros débiteur paie le plus gros créancier, et ainsi de suite
function settle(balances) {
  const debt = balances.filter((x) => x.diff < -0.5).map((x) => ({ ...x, left: -x.diff })).sort((a, z) => z.left - a.left);
  const credit = balances.filter((x) => x.diff > 0.5).map((x) => ({ ...x, left: x.diff })).sort((a, z) => z.left - a.left);
  const out = [];
  let i = 0;
  let j = 0;
  while (i < debt.length && j < credit.length) {
    const amount = Math.min(debt[i].left, credit[j].left);
    if (amount >= 1) out.push({ from: debt[i].member, to: credit[j].member, amount: Math.round(amount) });
    debt[i].left -= amount;
    credit[j].left -= amount;
    if (debt[i].left < 0.5) i++;
    if (credit[j].left < 0.5) j++;
  }
  return out;
}

// Règle de départ : celle enregistrée, sinon une part égale entre ceux qui ont déjà payé
function startShares(saved, byPayer) {
  if (saved && Object.keys(saved).length) return byPayer.reduce((o, x) => ({ ...o, [x.member.id]: Math.round(saved[x.member.id] || 0) }), {});
  const payers = byPayer.filter((x) => x.amount > 0);
  const list = payers.length ? payers : byPayer;
  const out = byPayer.reduce((o, x) => ({ ...o, [x.member.id]: 0 }), {});
  list.forEach((x, i) => (out[x.member.id] = Math.floor(100 / list.length) + (i < 100 % list.length ? 1 : 0)));
  return out;
}

// Un curseur bouge : les autres se partagent le reste à proportion de leurs parts (à parts égales s'ils sont tous à 0)
function rebalance(shares, ids, id, value) {
  const others = ids.filter((x) => x !== id);
  const left = 100 - value;
  const sum = others.reduce((a, x) => a + (shares[x] || 0), 0);
  const out = { ...shares, [id]: value };
  let given = 0;
  others.forEach((x, i) => {
    const v = i === others.length - 1 ? left - given : Math.round(sum ? ((shares[x] || 0) * left) / sum : left / others.length);
    out[x] = Math.max(0, v);
    given += out[x];
  });
  return out;
}

export default function Repartition() {
  const dash = useDash();
  const data = dash.data;
  const [adding, setAdding] = useState(false);
  const byPayer = paidByPayer(data);
  const total = byPayer.reduce((a, x) => a + x.amount, 0);
  const ids = byPayer.map((x) => x.member.id);
  const saved = data.wedding.layouts?.partage?.shares;
  const [shares, setShares] = useState(() => startShares(saved, byPayer));
  useEffect(() => {
    if (saved) setShares(startShares(saved, byPayer));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(saved), ids.join()]);
  const transfers = settle(byPayer.map((x) => ({ member: x.member, diff: x.amount - (total * (shares[x.member.id] || 0)) / 100 })));

  const move = (id, value) => setShares((s) => rebalance(s, ids, id, value));
  const commit = () => dash.saveLayout("partage", { shares });

  return (
    <>
      <BudgetHeader
        tab="repartition"
        actions={
          <span className="d-desk-only-flex">
            <Btn icon="plus" onClick={() => setAdding(true)}>
              Ajouter une dépense
            </Btn>
          </span>
        }
      />

      <div className="d-split-stats">
        <span>
          <strong>{euros(total)}</strong>
          <small>dépensés à ce jour</small>
        </span>
      </div>

      <div className="d-split-grid">
        <div className="d-col" style={{ gap: 12 }}>
          <Section title="Par personne" />
          <div className="d-card d-split-list">
            {byPayer.map((x) => (
              <div key={x.member.id} className="d-split-row">
                <Avatar member={x.member} size={34} />
                <span className="d-split-text">
                  <strong>{x.member.display_name}</strong>
                  <small>{pctLabel(x.amount, total)} du total</small>
                </span>
                <strong className="d-split-amount">{euros(x.amount)}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="d-col" style={{ gap: 12 }}>
          <Section title="Votre règle de répartition" />
          <div className="d-card d-rule">
            <div className="d-rule-gauge" aria-hidden="true">
              {byPayer.map((x) =>
                shares[x.member.id] ? (
                  <span key={x.member.id} style={{ width: `${shares[x.member.id]}%`, background: pastel(x.member.color).mid }}>
                    {shares[x.member.id] >= 12 ? `${shares[x.member.id]} %` : ""}
                  </span>
                ) : null,
              )}
            </div>
            <ul className="d-rule-list">
              {byPayer.map((x) => (
                <li key={x.member.id}>
                  <Avatar member={x.member} size={28} />
                  <span className="d-rule-name">{x.member.display_name}</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={shares[x.member.id] || 0}
                    aria-label={`Part de ${x.member.display_name}`}
                    style={{ "--rule-color": pastel(x.member.color).mid, "--rule-pct": `${shares[x.member.id] || 0}%` }}
                    onChange={(e) => move(x.member.id, Number(e.target.value))}
                    onPointerUp={commit}
                    onKeyUp={commit}
                    onBlur={commit}
                  />
                  <span className="d-rule-pct">
                    <strong>{shares[x.member.id] || 0} %</strong>
                    <small>{euros((total * (shares[x.member.id] || 0)) / 100)}</small>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <Section title="Pour équilibrer les comptes" />
          <div className="d-card d-balance">
            {transfers.length ? (
              <ul className="d-balance-list">
                {transfers.map((t) => (
                  <li key={`${t.from.id}-${t.to.id}`}>
                    <span className="d-balance-people">
                      <Avatar member={t.from} size={30} />
                      <Icon name="arrowRight" size={16} sw={2} />
                      <Avatar member={t.to} size={30} />
                    </span>
                    <span className="d-balance-text">
                      <strong>{t.from.display_name}</strong> verse à <strong>{t.to.display_name}</strong>
                    </span>
                    <strong className="d-split-amount">{euros(t.amount)}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="d-balance-ok">
                <Icon name="check" size={16} sw={2.4} />
                {total ? "Les comptes sont équilibrés." : "Aucune dépense pour l'instant."}
              </p>
            )}
          </div>
        </div>
      </div>

      <button type="button" className="d-fab" aria-label="Ajouter une dépense" onClick={() => setAdding(true)}>
        <Icon name="plus" size={22} sw={2.4} />
      </button>

      {adding ? <DepenseModal onClose={() => setAdding(false)} /> : null}
    </>
  );
}

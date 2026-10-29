"use client";

// Onglet « Répartition » du budget (artboard 2b) : le total payé, qui a payé combien, puis comment équilibrer
// les comptes entre ceux qui partagent les dépenses. Chacun choisit qui partage (pas de parts imposées) ;
// le choix est commun aux organisateurs (weddings.layouts.partage).

import { useState } from "react";
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

export default function Repartition() {
  const dash = useDash();
  const data = dash.data;
  const [adding, setAdding] = useState(false);
  const byPayer = paidByPayer(data);
  const total = byPayer.reduce((a, x) => a + x.amount, 0);
  const saved = data.wedding.layouts?.partage?.members;
  const sharing = new Set(saved?.length ? saved : byPayer.filter((x) => x.amount > 0).map((x) => x.member.id));
  const part = sharing.size ? total / sharing.size : 0;
  const transfers = settle(byPayer.filter((x) => sharing.has(x.member.id) || x.amount > 0).map((x) => ({ member: x.member, diff: x.amount - (sharing.has(x.member.id) ? part : 0) })));

  const toggle = (id) => {
    const next = new Set(sharing);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    dash.saveLayout("partage", { members: [...next] });
  };

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
          <Section title="Pour équilibrer les comptes" />
          <div className="d-card d-balance">
            <div className="d-balance-who" role="group" aria-label="Qui partage les dépenses">
              <span>Qui partage les dépenses ?</span>
              <div className="d-filters">
                {byPayer.map((x) => (
                  <button key={x.member.id} type="button" className={`d-pill d-pill-person${sharing.has(x.member.id) ? " is-on" : ""}`} aria-pressed={sharing.has(x.member.id)} onClick={() => toggle(x.member.id)}>
                    <Avatar member={x.member} size={22} />
                    {x.member.display_name}
                  </button>
                ))}
              </div>
              {sharing.size ? (
                <span className="d-balance-part">
                  <strong>{euros(part)}</strong> chacun
                </span>
              ) : null}
            </div>
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
                {sharing.size ? "Les comptes sont équilibrés." : "Choisissez qui partage les dépenses."}
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

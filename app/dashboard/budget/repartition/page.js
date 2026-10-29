"use client";

// Onglet « Répartition » du budget (artboard 2b) : le total payé, qui a payé combien, la règle de répartition
// du couple en une jauge (le bouton ouvre la page de la règle, 2b2 à 2b4), puis les virements qui remettent
// chacun à ce que la règle lui donne à payer.

import Link from "next/link";
import { useState } from "react";
import { useDash } from "@/lib/dash/store";
import { paidByPayer } from "@/lib/dash/model";
import { MODES, ruleOf, ruleSummary, settle, targetsOf } from "@/lib/dash/partage";
import { euros, pctLabel } from "@/lib/dash/format";
import { Icon } from "@/components/dash/icons";
import { Avatar, Btn, Section } from "@/components/dash/ui";
import BudgetHeader from "@/components/dash/BudgetTabs";
import DepenseModal from "@/components/dash/DepenseModal";
import RuleGauge from "@/components/dash/RuleGauge";

export default function Repartition() {
  const dash = useDash();
  const data = dash.data;
  const [adding, setAdding] = useState(false);
  const byPayer = paidByPayer(data);
  const total = byPayer.reduce((a, x) => a + x.amount, 0);
  const rule = ruleOf(data);
  const targets = targetsOf(rule, data, byPayer);
  const transfers = settle(byPayer.map((x) => ({ member: x.member, diff: x.amount - (targets[x.member.id] || 0) })));

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
            <RuleGauge byPayer={byPayer} targets={targets} total={total} />
            <div className="d-rule-summary">
              <span>
                <strong>{MODES.find((m) => m.key === rule.mode).label}</strong>
                <small>{ruleSummary(rule, byPayer)}</small>
              </span>
              <Link href="/dashboard/budget/repartition/regle" className="d-btn d-btn-ghost">
                Définir la règle
              </Link>
            </div>
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

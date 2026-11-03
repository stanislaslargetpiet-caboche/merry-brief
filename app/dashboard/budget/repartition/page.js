"use client";

// Onglet « Répartition » du budget (artboard 2b) : le total payé, qui a payé combien, la règle de répartition
// du couple en une jauge (le bouton ouvre la page de la règle, 2b2 à 2b4), puis les virements qui remettent
// chacun à ce que la règle lui donne à payer.

import Link from "next/link";
import { useState } from "react";
import { useDash } from "@/lib/dash/store";
import { paidByPayer, posteName, unassignedPayments } from "@/lib/dash/model";
import { MODES, foldByGroup, groupLabel, groupedPayers, groupsOf, ruleOf, settle, targetsOf } from "@/lib/dash/partage";
import { euros, pctLabel, shortDate } from "@/lib/dash/format";
import { Icon } from "@/components/dash/icons";
import { Avatar, Btn, Faces, Section } from "@/components/dash/ui";
import BudgetHeader from "@/components/dash/BudgetTabs";
import DepenseModal from "@/components/dash/DepenseModal";
import PayerGroupsModal from "@/components/dash/PayerGroupsModal";
import RuleGauge from "@/components/dash/RuleGauge";

export default function Repartition() {
  const dash = useDash();
  const data = dash.data;
  const [adding, setAdding] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const byPayer = paidByPayer(data);
  const total = byPayer.reduce((a, x) => a + x.amount, 0);
  const rule = ruleOf(data);
  const targets = targetsOf(rule, data, byPayer);
  // Des organisateurs d'une même famille, réunis pour ne pas se virer de l'argent entre eux
  const groups = groupsOf(data, byPayer);
  const rows = groupedPayers(byPayer, groups);
  const foldedTargets = foldByGroup(targets, rows);
  // Payé sans payeur indiqué (anciennes lignes ajoutées dans un poste, échéances marquées payées…) :
  // hors du partage tant qu'on n'a pas dit qui a payé
  const unassigned = unassignedPayments(data);
  const itemById = new Map(data.items.map((i) => [i.id, i]));
  const transfers = settle(
    rows.map((r) => ({ member: { id: r.key, display_name: groupLabel(r), color: r.members[0].color, initial: r.members.length > 1 ? undefined : r.members[0].initial }, diff: r.amount - (foldedTargets[r.key] || 0) })),
  );

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

      <Link href="/dashboard/budget/repartition/regle" className="d-btn d-btn-lime d-rule-cta">
        Définir la règle
      </Link>

      <div className="d-split-grid">
        <div className="d-col" style={{ gap: 12 }}>
          <Section
            title="Par personne"
            right={
              byPayer.length > 1 ? (
                <button type="button" className="d-btn d-btn-ghost" onClick={() => setGroupsOpen(true)}>
                  Regrouper
                </button>
              ) : null
            }
          />
          <div className="d-card d-split-list">
            {rows.map((r) => (
              <div key={r.key} className="d-split-row">
                {r.members.length > 1 ? <Faces members={r.members} size={34} /> : <Avatar member={r.members[0]} size={34} />}
                <span className="d-split-text">
                  <strong>{groupLabel(r)}</strong>
                  <small>{pctLabel(r.amount, total)} du total</small>
                </span>
                <strong className="d-split-amount">{euros(r.amount)}</strong>
              </div>
            ))}
          </div>

          {unassigned.length ? (
            <>
              <Section title="Qui a payé ?" count={unassigned.length} />
              <div className="d-card d-unassigned">
                <p className="d-small d-muted" style={{ margin: 0 }}>
                  {euros(unassigned.reduce((a, p) => a + Number(p.amount || 0), 0))} payés sans payeur indiqué ne comptent pas encore dans la répartition.
                </p>
                <ul className="d-pay-list">
                  {unassigned.map((p) => (
                    <li key={p.id}>
                      <span className="d-pay-text">
                        <strong>
                          {posteName(itemById.get(p.budget_item_id))} · {euros(p.amount)}
                        </strong>
                        <small>
                          {p.label}
                          {p.paid_at ? ` · le ${shortDate(p.paid_at)}` : ""}
                        </small>
                      </span>
                      <span className="d-filters">
                        {data.members.map((m) => (
                          <button key={m.id} type="button" className="d-pill d-pill-person" onClick={() => dash.update("payments", p.id, { payer_id: m.id })}>
                            <Avatar member={m} size={22} />
                            {m.display_name}
                          </button>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : null}
        </div>

        <div className="d-col" style={{ gap: 12 }}>
          <Section
            title="Votre règle de répartition"
            right={
              <Link href="/dashboard/budget/repartition/regle" className="d-btn d-btn-primary">
                Modifier la règle
              </Link>
            }
          />
          <div className="d-card d-rule">
            <RuleGauge byPayer={byPayer} targets={targets} total={total} />
            <div className="d-rule-summary">
              <span>
                <strong>{MODES.find((m) => m.key === rule.mode).label}</strong>
              </span>
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
      {groupsOpen ? <PayerGroupsModal byPayer={byPayer} groups={groups} onClose={() => setGroupsOpen(false)} /> : null}
    </>
  );
}

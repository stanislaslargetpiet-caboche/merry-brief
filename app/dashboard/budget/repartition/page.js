"use client";

// Onglet « Répartition » du budget (artboard 2b) : le total payé, qui a payé combien, puis le détail des dépenses effectuées.
// Pas de partage imposé (à parts égales ou autre) : chaque famille s'organise comme elle veut.

import { useState } from "react";
import { useDash } from "@/lib/dash/store";
import { paidByPayer, posteName } from "@/lib/dash/model";
import { euros, pctLabel, shortDate } from "@/lib/dash/format";
import { Icon } from "@/components/dash/icons";
import { Avatar, Btn, Section } from "@/components/dash/ui";
import BudgetHeader from "@/components/dash/BudgetTabs";
import DepenseModal from "@/components/dash/DepenseModal";

export default function Repartition() {
  const data = useDash().data;
  const [adding, setAdding] = useState(false);
  const byPayer = paidByPayer(data);
  const total = byPayer.reduce((a, x) => a + x.amount, 0);
  const memberById = new Map(data.members.map((m) => [m.id, m]));
  const itemById = new Map(data.items.map((i) => [i.id, i]));
  const paid = data.payments.filter((p) => p.paid_at).sort((a, b) => String(b.paid_at).localeCompare(String(a.paid_at)));

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

        {paid.length ? (
          <div className="d-col" style={{ gap: 12 }}>
            <Section title="Le détail" />
            <div className="d-card d-split-list">
              {paid.map((p) => {
                const it = itemById.get(p.budget_item_id);
                const who = memberById.get(p.payer_id);
                const what = [it ? posteName(it) : null, p.label ? String(p.label).toLowerCase() : null].filter(Boolean).join(" · ");
                return (
                  <div key={p.id} className="d-split-row">
                    <span className="d-split-text">
                      <strong>{what || "Dépense"}</strong>
                      <small className="d-split-who">
                        {who ? <Avatar member={who} size={16} /> : null}
                        {[who?.display_name, shortDate(String(p.paid_at).slice(0, 10))].filter(Boolean).join(" · ")}
                      </small>
                    </span>
                    <strong className="d-split-amount">{euros(p.amount)}</strong>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      <div className="d-mob-only">
        <button type="button" className="d-pill is-dashed" style={{ width: "100%", justifyContent: "center" }} onClick={() => setAdding(true)}>
          <Icon name="plus" size={14} sw={2} />
          Ajouter une dépense
        </button>
      </div>

      {adding ? <DepenseModal onClose={() => setAdding(false)} /> : null}
    </>
  );
}

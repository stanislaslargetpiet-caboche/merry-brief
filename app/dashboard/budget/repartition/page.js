"use client";

// Onglet « Répartition » du budget (artboard 2b) : seulement les dépenses déjà effectuées,
// partagées à parts égales entre les organisateurs, puis qui rembourse qui, à la manière de Tricount.

import { useState } from "react";
import { useDash } from "@/lib/dash/store";
import { paidByPayer, settleUp } from "@/lib/dash/model";
import { euros } from "@/lib/dash/format";
import { Icon } from "@/components/dash/icons";
import { Avatar, Btn, Section } from "@/components/dash/ui";
import BudgetHeader from "@/components/dash/BudgetTabs";
import DepenseModal from "@/components/dash/DepenseModal";

function Balance({ value }) {
  const v = Math.round(value);
  return <span className={`d-balance${v > 0 ? " is-plus" : v < 0 ? " is-minus" : ""}`}>{v === 0 ? "0 €" : euros(v, { signed: true })}</span>;
}

export default function Repartition() {
  const data = useDash().data;
  const [adding, setAdding] = useState(false);
  const byPayer = paidByPayer(data);
  const total = byPayer.reduce((a, x) => a + x.amount, 0);
  const share = byPayer.length ? total / byPayer.length : 0;
  const rows = byPayer.map((x) => ({ ...x, balance: x.amount - share }));
  const transfers = settleUp(rows);
  const toSettle = transfers.reduce((a, t) => a + t.amount, 0);

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
        <span>
          <strong>{euros(share)}</strong>
          <small>la part de chacun (÷ {byPayer.length || 1})</small>
        </span>
        <span>
          <strong>{euros(toSettle)}</strong>
          <small>à se rembourser</small>
        </span>
      </div>

      <div className="d-split-grid">
        <div className="d-col" style={{ gap: 12 }}>
          <Section title="Dépenses effectuées" />
          <div className="d-card d-split-list">
            {rows.map((x) => (
              <div key={x.member.id} className="d-split-row">
                <Avatar member={x.member} size={34} />
                <span className="d-split-text">
                  <strong>{x.member.display_name}</strong>
                  <small>
                    a payé {euros(x.amount)} · sa part {euros(share)}
                  </small>
                </span>
                <Balance value={x.balance} />
              </div>
            ))}
          </div>
        </div>

        {transfers.length ? (
          <div className="d-col" style={{ gap: 12 }}>
            <Section title="Qui rembourse qui" />
            <div className="d-card d-split-list">
              {transfers.map((t) => (
                <div key={`${t.from.id}-${t.to.id}`} className="d-split-row">
                  <Avatar member={t.from} size={28} />
                  <Icon name="arrowRight" size={15} sw={2.2} />
                  <Avatar member={t.to} size={28} />
                  <span className="d-split-text">
                    <span>
                      <strong>{t.from.display_name}</strong> doit <strong>{euros(t.amount)}</strong> à {t.to.display_name}
                    </span>
                  </span>
                </div>
              ))}
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

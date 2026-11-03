"use client";

import { pastel } from "@/lib/dash/theme";

// La jauge : ce que chacun prend en charge selon la règle, en couleurs.
// % de la somme des montants pris en charge, pas du total déjà dépensé : en montant fixe, cette somme
// peut dépasser (ou ne pas couvrir) ce qui a été payé jusqu'ici, sans quoi la barre dépasserait 100 %.
export default function RuleGauge({ byPayer, targets }) {
  const sum = byPayer.reduce((a, x) => a + (targets[x.member.id] || 0), 0);
  return (
    <div className="d-rule-gauge" aria-hidden="true">
      {byPayer.map((x) => {
        const pct = sum ? Math.round(((targets[x.member.id] || 0) / sum) * 100) : 0;
        return pct ? (
          <span key={x.member.id} style={{ width: `${pct}%`, background: pastel(x.member.color).mid }}>
            {pct >= 12 ? `${pct} %` : ""}
          </span>
        ) : null;
      })}
    </div>
  );
}

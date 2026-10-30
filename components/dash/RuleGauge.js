"use client";

import { pastel } from "@/lib/dash/theme";

// La jauge : ce que chacun prend en charge selon la règle, en couleurs
export default function RuleGauge({ byPayer, targets, total }) {
  return (
    <div className="d-rule-gauge" aria-hidden="true">
      {byPayer.map((x) => {
        const pct = total ? Math.round(((targets[x.member.id] || 0) / total) * 100) : 0;
        return pct ? (
          <span key={x.member.id} style={{ width: `${pct}%`, background: pastel(x.member.color).mid }}>
            {pct >= 12 ? `${pct} %` : ""}
          </span>
        ) : null;
      })}
    </div>
  );
}

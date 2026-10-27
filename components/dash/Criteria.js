"use client";

// Icônes des critères et étiquettes des faits d'un lieu (cartes, fiche). Les critères eux-mêmes se règlent
// dans le panneau Filtres (components/dash/Filtres.js).

import { CRIT_ICON } from "@/lib/dash/criteria";
import { DuoIcon, Icon } from "./icons";

export function CritIcon({ k, size = 16, tint }) {
  const [set, name] = CRIT_ICON[k] || CRIT_ICON.words;
  if (set === "duo") return <DuoIcon name={name} size={size} fill={tint ? "#cbff75" : "var(--d-lime)"} stroke={tint ? "#35520a" : "#1c1c1a"} />;
  return <Icon name={name} size={size} sw={1.8} stroke={tint ? "#35520a" : "#1c1c1a"} />;
}

// Faits d'un lieu en petites étiquettes (cartes) : teinte lime quand ils répondent à un critère
export function FactChips({ facts, className = "" }) {
  if (!facts.length) return null;
  return (
    <ul className={`d-pr-facttags ${className}`} aria-label="Ce que propose le lieu">
      {facts.map((f) => (
        <li key={f.key} className={f.match ? "is-match" : ""}>
          <CritIcon k={f.key} size={15} tint={f.match} />
          <span>{f.text}</span>
          {f.match ? <span className="d-sr"> (répond à vos critères)</span> : null}
        </li>
      ))}
    </ul>
  );
}

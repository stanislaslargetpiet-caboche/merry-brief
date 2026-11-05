"use client";

// Bienvenue (maquettes V0-Onb5 et V0-Rev4) : dernier écran après la préparation, avant le tableau de
// bord. La coche, le titre, la barre de complétude et les boutons arrivent l'un après l'autre (audit du
// 4 nov. 2026). Création : un seul bouton vers le dashboard. Revendication : « Compléter ma fiche » en
// avant, « Accéder au dashboard » en retrait. fill = complétude de la fiche en %, quand elle est connue.

import { ProIcon } from "./icons";

export default function Welcome({ name, fill, primary, secondary }) {
  const pct = typeof fill === "number" ? Math.max(0, Math.min(100, Math.round(fill))) : null;
  return (
    <div className="p-welcome">
      <div className="p-welcome-blob" aria-hidden="true" />
      <span className="p-brand-logo p-welcome-logo">Merry</span>
      <div className="p-welcome-body">
        <span className="p-welcome-check p-welcome-in" aria-hidden="true">
          <ProIcon name="check" size={28} sw={2.6} stroke="#ffffff" />
        </span>
        <h1 className="p-welcome-h1 p-welcome-in">Bienvenue, {name}.</h1>
        {pct !== null ? (
          <div className="p-welcome-fill p-welcome-in">
            <span className="p-welcome-bar" role="progressbar" aria-label="Fiche complète" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
              <span style={{ width: `${pct}%` }} />
            </span>
            <span className="p-welcome-fill-label">Votre fiche est complète à {pct} %</span>
          </div>
        ) : null}
        <div className="p-welcome-actions p-welcome-in">
          <button type="button" className="p-claim-submit" onClick={primary.onClick}>
            {primary.label}
          </button>
          {secondary ? (
            <button type="button" className="p-claim-link" onClick={secondary.onClick}>
              {secondary.label}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

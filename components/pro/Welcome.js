"use client";

// Bienvenue (maquettes V0-Onb5 et V0-Rev4) : dernier écran après la préparation, avant le tableau de
// bord. Création : un seul bouton vers le dashboard (qui porte déjà la bannière « fiche complète »).
// Revendication : « Compléter ma fiche » en avant, « Accéder au dashboard » en retrait.

import { ProIcon } from "./icons";

export default function Welcome({ name, primary, secondary }) {
  return (
    <div className="p-welcome">
      <div className="p-welcome-blob" aria-hidden="true" />
      <span className="p-brand-logo p-welcome-logo">Merry</span>
      <div className="p-welcome-body">
        <span className="p-welcome-check" aria-hidden="true">
          <ProIcon name="check" size={28} sw={2.6} stroke="#ffffff" />
        </span>
        <h1 className="p-welcome-h1">Bienvenue, {name}.</h1>
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
  );
}

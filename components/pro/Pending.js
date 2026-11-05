"use client";

// Fiche en attente de vérification (canvas V0h3) : tant que la demande d'accès n'est pas validée (pilotage >
// Demandes), le prestataire ne voit ni le dashboard ni rien de son espace, seulement cet écran. Il se met à jour
// tout seul : dès la validation, le dashboard s'ouvre. Décision de Stan le 5 nov. 2026 : un compte « vérifié
// plus tard » qui entrerait quand même dans son espace n'aurait aucun sens.

import { useEffect } from "react";
import { usePro } from "@/lib/pro/store";

const POLL_MS = 30000;

export function PendingScreen({ name, city, onSignOut }) {
  const meta = city || "";
  return (
    <div className="p-claim">
      <header className="p-claim-header">
        <span className="p-brand-logo">Merry</span>
        <a href="https://www.withmerry.com">Retour au site</a>
      </header>
      <div className="p-claim-stage">
        <div className="p-claim-band">
          <div className="p-claim-top is-hidden">
            <span className="p-claim-back is-empty" />
          </div>
          <div className="p-claim-band-title">
            <span className="p-claim-eyebrow">Votre demande</span>
            <h1 className="p-claim-h1">Votre demande est prise en compte.</h1>
          </div>
        </div>
        <div className="p-claim-card">
          <div className="p-claim-eyebrow p-desk-only">Votre demande</div>
          <h1 className="p-claim-h1 p-desk-only">Votre demande est prise en compte.</h1>
          <div className="p-claim-screen">
            <p className="p-claim-lead">Nous vérifions que la fiche est bien à vous. Nous vous joignons par mail ou par téléphone dans l’heure.</p>
            <div className="p-claim-row-fiche">
              <span className="p-claim-name">{name}</span>
              {meta ? <span className="p-claim-meta">{meta}</span> : null}
            </div>
            <p className="p-claim-help">Votre espace s’ouvre dès que la vérification est faite. Cette page se met à jour toute seule.</p>
            <div className="p-claim-stack">
              <button type="button" className="p-claim-link" onClick={onSignOut}>
                Me déconnecter
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Pending() {
  const pro = usePro();
  useEffect(() => {
    const t = setInterval(() => pro.reload(), POLL_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const v = pro.data?.vendor || {};
  return <PendingScreen name={v.name || "Votre fiche"} city={v.city} onSignOut={() => pro.signOut("/pro")} />;
}

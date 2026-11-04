"use client";

// « Changer mon mot de passe » : rien à saisir tant que l'interrupteur est éteint. Réglages du couple,
// Compte du prestataire.

import { Field } from "@/components/dash/ui";

export default function PasswordFields({ on, setOn, password, setPassword, again, setAgain }) {
  return (
    <>
      <button type="button" className="d-fm-switch-row d-password-switch" role="switch" aria-checked={on} onClick={() => setOn(!on)}>
        <strong>Changer mon mot de passe</strong>
        <span className={`d-fm-switch${on ? " is-on" : ""}`} aria-hidden="true" />
      </button>
      {on ? (
        <div className="d-form-grid d-password-fields">
          <Field label="Nouveau mot de passe">
            <input className="d-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          </Field>
          <Field label="Confirmer le mot de passe">
            <input className="d-input" type="password" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" />
          </Field>
        </div>
      ) : null}
    </>
  );
}

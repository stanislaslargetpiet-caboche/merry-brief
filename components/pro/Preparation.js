"use client";

// Écran de préparation (canvas Vendor-Prep2-Etapes, validé le 4 nov. 2026) : entre le code validé et
// Bienvenue, trois étapes réelles se cochent l'une après l'autre, le halo grandit à chaque coche. Le
// serveur a déjà tout fait quand l'écran s'affiche : le rythme est là pour que chaque étape se lise,
// pas pour simuler un travail. 3,2 s en tout, un clic sur la scène passe à la suite.

import { useEffect } from "react";
import { ProIcon } from "./icons";

const STEP_AT = [300, 1300, 2300];
const DONE_AT = 3200;

export default function Preparation({ steps, line, onDone }) {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(onDone, reduced ? 1200 : DONE_AT);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-prep">
      <div className="p-prep-head">
        <span className="p-brand-logo">Merry</span>
      </div>
      <button type="button" className="p-prep-stage" onClick={onDone} aria-label="Passer à la suite">
        <div className="p-prep2-halo" aria-hidden="true" />
        <ul className="p-prep2-steps">
          {steps.slice(0, STEP_AT.length).map((s, i) => (
            <li key={i} className="p-prep2-step" style={{ "--at": `${STEP_AT[i]}ms` }}>
              <span className="p-prep2-check" aria-hidden="true">
                <ProIcon name="check" size={14} sw={2.6} />
              </span>
              <span className="p-prep2-text">
                <span className="p-prep2-label">{s.label}</span>
                {s.detail ? <span className="p-prep2-detail">{s.detail}</span> : null}
              </span>
            </li>
          ))}
        </ul>
        <p className="p-prep2-line">{line}</p>
      </button>
    </div>
  );
}

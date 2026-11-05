"use client";

// Écran de préparation : exactement la même animation que l'onboarding couple (Preparing dans
// components/Brief.js, classes .ob-prep-* dans app/onboarding.css, seule source de cette animation —
// ne pas la redupliquer ailleurs, importer onboarding.css comme ici). Les bribes de la fiche tourbillonnent,
// se figent en résultats pendant qu'une ligne de statut défile, avant Bienvenue. 5,6 s en tout.

import { useEffect } from "react";
import "@/app/onboarding.css";

const PREPARE_MS = 5600;

function Check({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  );
}

// Mêmes emplacements que prepChips dans Brief.js, pour un tourbillon identique
const SPOTS = [
  [-230, -110, -6], [210, -120, 5], [-250, 40, 4], [240, 30, -5], [-150, 130, -3], [170, 135, 6], [0, -150, 3], [10, 160, -4],
];

export default function Preparation({ steps, lines, onDone }) {
  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const timer = setTimeout(onDone, reduce ? 1500 : PREPARE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Les bribes de la fiche (nom, catégorie, adresse…), en chips qui arrivent de partout
  const chipTexts = steps.flatMap((s) => (s.detail || "").split(" · ")).filter(Boolean);
  const k = typeof window !== "undefined" && window.innerWidth < 700 ? 0.42 : 1;
  const chips = chipTexts.slice(0, SPOTS.length).map((text, i) => ({ text, x: SPOTS[i][0] * k, y: SPOTS[i][1] * (k < 1 ? 0.85 : 1), r: SPOTS[i][2] }));

  return (
    <div className="ob">
      <header className="ob-header">
        <span className="ob-logo">Merry</span>
      </header>
      <main className="ob-main ob-prep" aria-live="polite">
        <div className="ob-prep-stage" aria-hidden="true">
          {chips.map((c, i) => (
            <span key={i} className="ob-prep-chip" style={{ "--i": i, "--x": `${c.x}px`, "--y": `${c.y}px`, "--r": `${c.r}deg` }}>
              {c.text}
            </span>
          ))}
          <div className="ob-prep-core" />
          <div className="ob-prep-results">
            {steps.map((s, i) => (
              <span key={s.label} className="ob-prep-result" style={{ "--i": i }}>
                <Check size={16} />
                {s.label}
              </span>
            ))}
          </div>
        </div>
        <div className="ob-prep-lines">
          {lines.map((line, i) => (
            <p key={line} className="ob-prep-line" style={{ "--i": i }}>{line}</p>
          ))}
        </div>
      </main>
    </div>
  );
}

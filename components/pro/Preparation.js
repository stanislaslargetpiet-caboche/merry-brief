"use client";

// Écran de préparation (maquettes V0d2 et V0h2) : entre le code validé et l'arrivée sur la fiche ou le
// tableau de bord. Tags qui convergent vers un cœur citron, légende qui tourne, boucle de 7 s — même
// principe pour « Créer sa fiche » (onboarding) et « Revendiquer sa fiche ».

import { useEffect } from "react";
import { ProIcon } from "./icons";

// Positions reprises des maquettes canvas (Vendor-Onb4b-Preparation / Vendor-Rev3b-Preparation)
const SPOTS = [
  { x: "-230px", y: "-110px", r: "-6deg" },
  { x: "210px", y: "-120px", r: "5deg" },
  { x: "-250px", y: "40px", r: "4deg" },
  { x: "240px", y: "30px", r: "-5deg" },
  { x: "-150px", y: "130px", r: "-3deg" },
  { x: "170px", y: "135px", r: "6deg" },
  { x: "0px", y: "-150px", r: "3deg" },
];

export default function Preparation({ tags, results, lines, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 7000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-prep">
      <div className="p-prep-head">
        <span className="p-brand-logo">Merry</span>
      </div>
      <button type="button" className="p-prep-stage" onClick={onDone} aria-label="Passer à la suite">
        <div className="p-prep-anim" aria-hidden="true">
          {tags.slice(0, SPOTS.length).map((t, i) => (
            <span key={i} className="p-prep-tag" style={{ "--i": i, "--x": SPOTS[i].x, "--y": SPOTS[i].y, "--r": SPOTS[i].r }}>
              {t}
            </span>
          ))}
          <div className="p-prep-core" />
          <div className="p-prep-results">
            {results.map((r, i) => (
              <span key={i} className="p-prep-res" style={{ "--i": i }}>
                <ProIcon name="check" size={16} sw={2.4} className="p-prep-res-icon" />
                {r}
              </span>
            ))}
          </div>
        </div>
        <div className="p-prep-lines">
          {lines.map((l, i) => (
            <p key={i} className={`p-prep-ln p-prep-ln${i}`}>
              {l}
            </p>
          ))}
        </div>
      </button>
    </div>
  );
}

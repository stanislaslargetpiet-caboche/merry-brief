"use client";

// Sélecteur de langue du site vitrine : Weglot traduit la page, mais son propre sélecteur reste masqué
// (réglage de l'intégration Squarespace), d'où ce menu « Français ▾ » du canvas.

import { useEffect, useRef, useState } from "react";
import { useAutoClose } from "./Dropdown";

const LANGS = [
  ["fr", "Français"],
  ["en", "English"],
];

export default function LangSwitch({ className }) {
  const [lang, setLang] = useState("fr");
  const ref = useRef(null);
  useAutoClose(ref);

  useEffect(() => {
    let stop = false;
    let tries = 0;
    const sync = () => {
      const w = window.Weglot;
      // Weglot s'initialise après le chargement de son script ; on l'attend quelques secondes au plus
      if (!w?.initialized) return stop || tries++ > 100 || setTimeout(sync, 100);
      setLang(w.getCurrentLang());
      w.on("languageChanged", (next) => setLang(next));
    };
    sync();
    return () => {
      stop = true;
    };
  }, []);

  const pick = (code) => {
    window.Weglot?.switchTo(code);
    setLang(code);
    if (ref.current) ref.current.open = false;
  };

  const name = LANGS.find(([code]) => code === lang)?.[1] ?? "Français";
  return (
    <details ref={ref} className={`wv-lang ${className ?? ""}`} data-wg-notranslate="">
      <summary>{name} ▾</summary>
      <div className="wv-lang-list">
        {LANGS.map(([code, label]) => (
          <button key={code} type="button" onClick={() => pick(code)} aria-current={code === lang ? "true" : undefined}>
            {label}
          </button>
        ))}
      </div>
    </details>
  );
}

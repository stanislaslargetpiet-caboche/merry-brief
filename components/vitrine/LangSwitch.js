"use client";

// Sélecteur de langue du site vitrine : textes traduits en dur dans le code (lib/i18n/vitrine-*),
// même mécanisme que l'appli (lib/lang.js). Remplace l'ancien sélecteur branché sur Weglot
// (retiré le 4 nov. 2026, abonnement expiré) — voir notes/journal.md.

import { useRef } from "react";
import { useAutoClose } from "./Dropdown";
import { useLang } from "@/lib/lang";

const LANGS = [
  ["fr", "Français"],
  ["en", "English"],
];

export default function LangSwitch({ className }) {
  const { lang, setLang } = useLang();
  const ref = useRef(null);
  useAutoClose(ref);

  const pick = (code) => {
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

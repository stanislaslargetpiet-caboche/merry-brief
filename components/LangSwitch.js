"use client";

import { useLang } from "@/lib/lang";

// Bascule FR/EN manuelle : filet de sécurité si la détection automatique
// (lien, cookie, langue du navigateur) ne devine pas la bonne langue.
export default function LangSwitch() {
  const { lang, setLang } = useLang();

  return (
    <div className="lang-switch" role="group" aria-label="Langue / Language">
      <button type="button" aria-pressed={lang === "fr"} onClick={() => setLang("fr")}>
        FR
      </button>
      <button type="button" aria-pressed={lang === "en"} onClick={() => setLang("en")}>
        EN
      </button>
    </div>
  );
}

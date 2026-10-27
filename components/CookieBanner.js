"use client";

import { useEffect, useState } from "react";
import { analyticsEnabled, readConsent, setConsent } from "@/lib/analytics";
import { useLang } from "@/lib/lang";
import { COOKIES_TEXT } from "@/lib/i18n/cookies";

// Bandeau de consentement : affiché tant que la personne n'a ni accepté ni refusé.
// Refuser est aussi simple qu'accepter (deux boutons de même taille, même rang).
export default function CookieBanner() {
  const { lang } = useLang();
  const s = COOKIES_TEXT[lang] || COOKIES_TEXT.fr;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (analyticsEnabled && readConsent() === null) setOpen(true);
  }, []);

  if (!open) return null;

  const choose = (value) => {
    setConsent(value);
    setOpen(false);
  };

  return (
    <div className="cookie" role="region" aria-label={s.aria}>
      <p className="cookie-text">
        {s.text}{" "}
        <a href="https://www.withmerry.com/confidentialite" target="_blank" rel="noreferrer">
          {s.more}
        </a>
      </p>
      <div className="cookie-actions">
        <button type="button" className="cookie-btn" onClick={() => choose("no")}>
          {s.refuse}
        </button>
        <button type="button" className="cookie-btn dark" onClick={() => choose("yes")}>
          {s.accept}
        </button>
      </div>
    </div>
  );
}

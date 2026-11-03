"use client";

import Script from "next/script";

// Weglot traduit le site en anglais, comme sur Squarespace (clé publique du projet Weglot de Merry).
// Initialisé au chargement du script (pas de scrutation : si un bloqueur empêche le chargement, rien ne tourne).
const WEGLOT_KEY = "wg_7a7d56df697abdba42bbcb9e1940599c4";

export default function Weglot() {
  return <Script src="https://cdn.weglot.com/weglot.min.js" strategy="afterInteractive" onLoad={() => window.Weglot?.initialize({ api_key: WEGLOT_KEY })} />;
}

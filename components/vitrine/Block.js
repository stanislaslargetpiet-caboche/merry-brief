"use client";

// Bloc HTML animé repris du site (sans script) ; ses styles sont dans app/vitrine/blocks.css.
// `fr`/`en` : les deux versions exportées par lib/vitrine/blocks/*.js ; `html` reste accepté seul
// pour un bloc qui n'a pas encore de version anglaise.

import { useLang } from "@/lib/lang";

export default function Block({ fr, en, html, className }) {
  const { lang } = useLang();
  const src = (lang === "en" && en) || fr || html;
  return <div className={className} dangerouslySetInnerHTML={{ __html: src }} />;
}

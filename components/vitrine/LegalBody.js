"use client";

// Corps des pages juridiques (CGU, confidentialité) : lit la langue (useLang) et affiche le
// bon jeu de sections. Remplace le rendu statique français de components/vitrine/Legal.js.

import { useLang } from "@/lib/lang";

export default function LegalBody({ text, sections }) {
  const { lang } = useLang();
  const t = text[lang];
  const sec = sections[lang];
  return (
    <section className="wv-legal">
      <h1 className="wv-h1">{t.title}</h1>
      <p className="wv-p wv-legal-date">{lang === "en" ? "Last updated: " : "Dernière mise à jour : "}{t.updated}</p>
      {t.intro ? <p className="wv-lead">{t.intro}</p> : null}
      {sec.map(([heading, paragraphs]) => (
        <section key={heading} className="wv-block">
          <h2 className="wv-h4">{heading}</h2>
          {paragraphs.map((p, i) =>
            Array.isArray(p) ? (
              <ul key={i} className="wv-p">
                {p.map((li) => (
                  <li key={li}>{li}</li>
                ))}
              </ul>
            ) : (
              <p key={i} className="wv-p">
                {p}
              </p>
            ),
          )}
        </section>
      ))}
    </section>
  );
}

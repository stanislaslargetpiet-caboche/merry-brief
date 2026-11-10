"use client";

// Liens vers les pages SEO métier × région, au-dessus du pied de page : les données viennent de
// SeoLinks (Frame.js, côté serveur), le rendu est ici pour suivre la langue.

import { useLang } from "@/lib/lang";
import { FRAME_TEXT } from "@/lib/i18n/vitrine-frame";

export default function SeoLinksView({ columns }) {
  const { lang } = useLang();
  const t = FRAME_TEXT[lang];
  return (
    <nav className="wv-seo" aria-label={t.seoAria}>
      <p className="wv-seo-t">{t.seoTitle}</p>
      <div className="wv-seo-g">
        {columns.map(({ slug, label, labelEn, href, regions }) => (
          <div key={slug}>
            <a href={href} className="wv-seo-h">
              {lang === "en" ? labelEn : label}
            </a>
            <ul>
              {regions.map((zone) => (
                <li key={zone.slug}>
                  <a href={zone.href}>{zone.name}</a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}

"use client";

import { SIGNUP } from "@/lib/vitrine/routes";
import { useLang } from "@/lib/lang";
import { ABOUT_TEXT, ABOUT_BLOCKS } from "@/lib/i18n/vitrine-about";

export default function AboutBody() {
  const { lang } = useLang();
  const t = ABOUT_TEXT[lang];
  const blocks = ABOUT_BLOCKS[lang];

  return (
    <section className="wv-about" aria-label={t.aria}>
      <img src="/vitrine/apropos.webp" alt="" className="wv-photo" width={1400} height={1944} decoding="async" />
      <div className="wv-text">
        <h1 className="wv-h1">{t.h1}</h1>
        <p className="wv-lead">{t.lead}</p>
        {blocks.map(([title, paragraphs, lead]) => (
          <div key={title} className="wv-block">
            <h2 className="wv-h4">{title}</h2>
            {paragraphs.map((p) => (
              <p key={p} className="wv-p">
                {p}
              </p>
            ))}
            {lead && <p className="wv-lead">{lead}</p>}
          </div>
        ))}
        <div className="wv-block">
          <h2 className="wv-h4">{t.finalTitle}</h2>
          <div>
            <a href={SIGNUP} className="wv-btn wv-btn-dark">
              {t.cta}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

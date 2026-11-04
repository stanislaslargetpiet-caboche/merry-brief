"use client";

// Bouton flottant mobile et pied de page du site vitrine. Extrait de Frame.js pour pouvoir lire
// la langue (useLang) sans rendre tout Frame.js client (SeoLinks y reste serveur, asynchrone).

import { useLang } from "@/lib/lang";
import { LINKS, SIGNUP } from "@/lib/vitrine/routes";
import { FRAME_TEXT, FOOTER_LINKS_TEXT } from "@/lib/i18n/vitrine-frame";

export default function FooterChrome({ current }) {
  const { lang } = useLang();
  const t = FRAME_TEXT[lang];
  const ft = FOOTER_LINKS_TEXT[lang];
  const links = LINKS;
  return (
    <>
      {current !== "pro" && (
        <aside className="wv-sticky" aria-label="Commencer">
          <span>
            <b>{t.stickyFree}</b>
            <br />
            {t.stickyTime}
          </span>
          <a href={SIGNUP} className="wv-btn wv-btn-dark" data-track="sticky_organise">
            {t.organise}
          </a>
        </aside>
      )}
      <footer className="wv-foot">
        <div className="wv-stack" style={{ gap: 12 }}>
          <span className="wv-h2">Merry</span>
          <p className="wv-lead">{t.footerTag}</p>
        </div>
        <div>
          <p className="wv-quote">"Never miss a party… good for the nerves - like celery."</p>
          <p className="wv-quote">F. Scott Fitzgerald</p>
          <p className="wv-quote wv-foot-links">
            <a href={links.about}>{ft.about}</a> · <a href={links.pro}>{ft.pro}</a> · <a href={links.privacy}>{ft.privacy}</a> ·{" "}
            <a href={links.terms}>{ft.terms}</a>
          </p>
        </div>
      </footer>
    </>
  );
}

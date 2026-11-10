"use client";

// En-tête du site vitrine : nav, connexion, sélecteur de langue, menu mobile. Extrait de Frame.js
// pour pouvoir lire la langue (useLang) sans rendre tout Frame.js client (SeoLinks y reste un
// composant serveur asynchrone).

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useLang } from "@/lib/lang";
import { LINKS, LOGIN, PRO, SIGNUP } from "@/lib/vitrine/routes";
import { EN_TITLES, FRAME_TEXT } from "@/lib/i18n/vitrine-frame";
import LangSwitch from "./LangSwitch";
import Dropdown from "./Dropdown";

const LOGIN_ITEMS = (t) => [
  [LOGIN, t.loginCouple],
  [PRO, t.loginPro],
];

function LoginMenu({ t }) {
  return (
    <Dropdown className="wv-login" summaryLabel={t.loginAria} summary={t.loginSummary}>
      <div className="wv-login-list">
        {LOGIN_ITEMS(t).map(([href, label]) => (
          <a key={href} href={href}>
            {label}
          </a>
        ))}
      </div>
    </Dropdown>
  );
}

export default function HeaderChrome({ current }) {
  const { lang } = useLang();
  const t = FRAME_TEXT[lang];
  const links = LINKS;
  // Les meta restent en français (serveur) : en anglais, on remplace le titre de l'onglet. En production, Next
  // pose son <title> après l'hydratation : on le surveille pour réappliquer le titre anglais.
  const pathname = usePathname();
  const frTitle = useRef(null);
  useEffect(() => {
    const key = (pathname || "").split("/").filter((p) => p && p !== "vitrine").pop() || "";
    const en = lang === "en" ? EN_TITLES[key] : null;
    if (!en) {
      if (frTitle.current && Object.values(EN_TITLES).includes(document.title)) document.title = frTitle.current;
      return undefined;
    }
    const apply = () => {
      if (document.title === en) return;
      frTitle.current = document.title;
      document.title = en;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, [lang, pathname]);
  const item = (key, href, label) => (
    <a href={href} className={current === key ? "on" : undefined} aria-current={current === key ? "page" : undefined}>
      {label}
    </a>
  );
  return (
    <>
      {/* Lien d'évitement : visible au clavier seulement, mène au contenu en sautant l'en-tête */}
      <a href="#contenu" className="wv-skip">
        {t.skip}
      </a>
      <header className="wv-head">
      <a href={links.home} className="wv-logo" aria-label={t.logoAria}>
        Merry
      </a>
      <nav className="wv-nav" aria-label={t.navAria}>
        {item("home", links.home, t.navHome)}
        {item("pro", links.pro, t.navPro)}
        <LoginMenu t={t} />
      </nav>
      <div className="wv-right">
        <LangSwitch />
        <a href={SIGNUP} className="wv-btn wv-btn-dark wv-btn-small" data-track="header_organise">
          {t.organise}
        </a>
        <Dropdown
          className="wv-menu"
          summaryLabel={t.menuAria}
          summary={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          }
        >
          <nav className="wv-menu-list" aria-label={t.menuNavAria}>
            <a href={links.home}>{t.navHome}</a>
            <a href={links.pro}>{t.navPro}</a>
            <a href={links.about}>{t.navAbout}</a>
            <p className="wv-menu-group">{t.menuLoginGroup}</p>
            {LOGIN_ITEMS(t).map(([href, label]) => (
              <a key={href} href={href} className="wv-menu-sub">
                {label}
              </a>
            ))}
            <LangSwitch className="wv-lang-menu" />
          </nav>
        </Dropdown>
      </div>
    </header>
    </>
  );
}

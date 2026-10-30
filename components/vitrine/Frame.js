// En-tête et pied de page du site vitrine (canvas « 9 - Site vitrine »)

import { headers } from "next/headers";
import { LOGIN, SIGNUP, linksFor } from "@/lib/vitrine/routes";

export async function getLinks() {
  return linksFor((await headers()).get("host"));
}

// Bloc HTML/CSS animé repris tel quel du site (sans script)
export function Block({ html, className }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

export default async function Frame({ current, children }) {
  const links = await getLinks();
  const item = (key, href, label) => (
    <a href={href} className={current === key ? "on" : undefined} aria-current={current === key ? "page" : undefined}>
      {label}
    </a>
  );
  return (
    <div className="wv">
      <header className="wv-head">
        <a href={links.home} className="wv-logo">
          Merry
        </a>
        <nav className="wv-nav" aria-label="Menu">
          {item("home", links.home, "Home")}
          {item("pro", links.pro, "Prestataires")}
          <a href={LOGIN}>Connexion</a>
        </nav>
        <div className="wv-right">
          <a href={SIGNUP} className="wv-btn wv-btn-dark wv-btn-small">
            J'organise
          </a>
          <details className="wv-menu">
            <summary aria-label="Menu">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </summary>
            <nav className="wv-menu-list" aria-label="Menu">
              <a href={links.home}>Home</a>
              <a href={links.pro}>Prestataires</a>
              <a href={links.about}>À propos</a>
              <a href={LOGIN}>Connexion</a>
            </nav>
          </details>
        </div>
      </header>
      {children}
      <footer className="wv-foot">
        <div className="wv-stack" style={{ gap: 12 }}>
          <span className="wv-h2">Merry</span>
          <p className="wv-lead">La vie est la plus belle des fêtes.</p>
        </div>
        <div>
          <p className="wv-quote">“Never miss a party… good for the nerves - like celery.”</p>
          <p className="wv-quote">F. Scott Fitzgerald</p>
        </div>
      </footer>
    </div>
  );
}

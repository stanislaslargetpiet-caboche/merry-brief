// En-tête et pied de page du site vitrine (canvas « 9 - Site vitrine »)

import { headers } from "next/headers";
import { LOGIN, SIGNUP, linksFor } from "@/lib/vitrine/routes";
import LangSwitch from "./LangSwitch";
import { PUBLIC_URL, getStats, hasPage, hrefOf } from "@/lib/seo/data";
import { FRANCE, regionZone } from "@/lib/seo/geo";
import { tradeOf } from "@/lib/seo/trades";

export async function getLinks() {
  return linksFor((await headers()).get("host"));
}

// Bloc HTML/CSS animé repris tel quel du site (sans script)
export function Block({ html, className }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

// Liens vers les pages SEO métier × région, au-dessus du pied de page (canvas « Site 1 · Accueil ») :
// une colonne par métier, les régions par taille de marché ; seules les pages qui existent sont listées.
const SEO_TRADES = [
  ["lieux", "Lieux de réception"],
  ["traiteurs", "Traiteurs"],
  ["photographes", "Photographes"],
  ["dj", "DJ"],
  ["fleuristes", "Fleuristes"],
];
const SEO_REGIONS = [
  "Île-de-France", "Auvergne-Rhône-Alpes", "Provence-Alpes-Côte d'Azur", "Nouvelle-Aquitaine", "Occitanie", "Bretagne",
  "Pays de la Loire", "Normandie", "Hauts-de-France", "Grand Est", "Bourgogne-Franche-Comté", "Centre-Val de Loire", "Corse",
];

async function SeoLinks() {
  const stats = await getStats().catch(() => null);
  // Sans les chiffres du catalogue (base injoignable, ou en local sans clé), on liste toutes les régions
  const known = Object.keys(stats?.stats || {}).length > 0;
  const columns = SEO_TRADES.map(([slug, label]) => {
    const trade = tradeOf(slug);
    const regions = SEO_REGIONS.map(regionZone).filter((zone) => zone && (!known || hasPage(stats, trade, zone)));
    return { trade, label, regions };
  });
  return (
    <nav className="wv-seo" aria-label="Prestataires de mariage par région">
      <p className="wv-seo-t">Prestataires de mariage par région</p>
      <div className="wv-seo-g">
        {columns.map(({ trade, label, regions }) => (
          <div key={trade.slug}>
            <a href={`${PUBLIC_URL}${hrefOf(trade, FRANCE)}`} className="wv-seo-h">
              {label}
            </a>
            <ul>
              {regions.map((zone) => (
                <li key={zone.slug}>
                  <a href={`${PUBLIC_URL}${hrefOf(trade, zone)}`}>{zone.name}</a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
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
          <LangSwitch />
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
              <LangSwitch className="wv-lang-menu" />
            </nav>
          </details>
        </div>
      </header>
      {children}
      <SeoLinks />
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

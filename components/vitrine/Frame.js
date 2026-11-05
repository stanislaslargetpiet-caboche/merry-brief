// En-tête et pied de page du site vitrine (canvas « 9 - Site vitrine »)

import { PUBLIC_URL, getStats, hasPage, hrefOf } from "@/lib/seo/data";
import { FRANCE, regionZone } from "@/lib/seo/geo";
import { tradeOf } from "@/lib/seo/trades";
import HeaderChrome from "./HeaderChrome";
import FooterChrome from "./FooterChrome";

export { default as Block } from "./Block";

// Liens vers les pages SEO métier × région, au-dessus du pied de page (canvas « Site 1 · Accueil ») :
// une colonne par métier, les régions par taille de marché ; seules les pages qui existent sont listées.
const SEO_TRADES = [
  ["lieux", "Lieux de réception"],
  ["traiteurs", "Traiteurs"],
  ["photographes", "Photographes"],
  ["dj", "DJ"],
  ["fleuristes", "Fleuristes"],
  // Deuxième rangée (5 nov. 2026) : les métiers ajoutés aux pages SEO
  ["wedding-planners", "Wedding planners"],
  ["coiffure-maquillage", "Coiffure et maquillage"],
  ["decoration", "Décoration"],
  ["robes-costumes", "Robes et costumes"],
];
const SEO_REGIONS = [
  "Île-de-France", "Auvergne-Rhône-Alpes", "Provence-Alpes-Côte d'Azur", "Nouvelle-Aquitaine", "Occitanie", "Bretagne",
  "Pays de la Loire", "Normandie", "Hauts-de-France", "Grand Est", "Bourgogne-Franche-Comté", "Centre-Val de Loire", "Corse",
];

async function SeoLinks() {
  const stats = await getStats().catch(() => null);
  // Sans les chiffres du catalogue (base injoignable, ou en local sans clé), on liste toutes les régions
  const known = Object.keys(stats?.stats || {}).length > 0;
  // Chiffres indisponibles : aucun lien plutôt qu'une liste de pages qui répondraient 404
  if (!known) return null;
  const columns = SEO_TRADES.map(([slug, label]) => {
    const trade = tradeOf(slug);
    const regions = SEO_REGIONS.map(regionZone).filter((zone) => zone && hasPage(stats, trade, zone));
    return { trade, label, regions };
  }).filter((c) => hasPage(stats, c.trade, FRANCE));
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

export default function Frame({ current, children }) {
  return (
    <div className="wv">
      <HeaderChrome current={current} />
      <main id="contenu" tabIndex={-1}>
        {children}
      </main>
      <SeoLinks />
      <FooterChrome current={current} />
    </div>
  );
}

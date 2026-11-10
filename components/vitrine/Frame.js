// En-tête et pied de page du site vitrine (canvas « 9 - Site vitrine »)

import { PUBLIC_URL, getStats, hasPage, hrefOf } from "@/lib/seo/data";
import { FRANCE, regionZone } from "@/lib/seo/geo";
import { tradeOf } from "@/lib/seo/trades";
import HeaderChrome from "./HeaderChrome";
import FooterChrome from "./FooterChrome";
import SeoLinksView from "./SeoLinksView";

export { default as Block } from "./Block";

// Liens vers les pages SEO métier × région, au-dessus du pied de page (canvas « Site 1 · Accueil ») :
// une colonne par métier (intitulé français, puis anglais), les régions par taille de marché ; seules les pages
// qui existent sont listées.
const SEO_TRADES = [
  ["lieux", "Lieux de réception", "Reception venues"],
  ["traiteurs", "Traiteurs", "Caterers"],
  ["photographes", "Photographes", "Photographers"],
  ["dj", "DJ", "DJs"],
  ["fleuristes", "Fleuristes", "Florists"],
  // Deuxième rangée (5 nov. 2026) : les métiers ajoutés aux pages SEO
  ["wedding-planners", "Wedding planners", "Wedding planners"],
  ["coiffure-maquillage", "Coiffure et maquillage", "Hair and makeup"],
  ["decoration", "Décoration", "Decor"],
  ["robes-costumes", "Robes et costumes", "Dresses and suits"],
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
  const columns = SEO_TRADES.map(([slug, label, labelEn]) => {
    const trade = tradeOf(slug);
    const regions = SEO_REGIONS.map(regionZone).filter((zone) => zone && hasPage(stats, trade, zone));
    return { trade, label, labelEn, regions };
  })
    .filter((c) => hasPage(stats, c.trade, FRANCE))
    .map(({ trade, label, labelEn, regions }) => ({
      slug: trade.slug,
      label,
      labelEn,
      href: `${PUBLIC_URL}${hrefOf(trade, FRANCE)}`,
      regions: regions.map((zone) => ({ slug: zone.slug, name: zone.name, href: `${PUBLIC_URL}${hrefOf(trade, zone)}` })),
    }));
  // Rendu côté client pour suivre la langue (les noms de régions restent en français)
  return <SeoLinksView columns={columns} />;
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

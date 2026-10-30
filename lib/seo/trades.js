// Pages SEO : les métiers qui ont une page par zone. `catalog` reprend les catégories de lib/dash/catalog.js ;
// `unit` est l'unité de prix retenue pour la médiane (on ne mélange pas un forfait et un prix par invité).

export const TRADES = [
  { slug: "lieux", key: "lieu", tab: "Lieux", title: "Lieux de mariage", one: "un lieu de mariage", many: "lieux", count: "lieux de réception", claim: "Votre lieu est sur cette page ?", catalog: ["lieu"], unit: "location" },
  { slug: "traiteurs", key: "traiteur", tab: "Traiteurs", title: "Traiteurs de mariage", one: "un traiteur de mariage", many: "traiteurs", count: "traiteurs", claim: "Vous êtes sur cette page ?", catalog: ["traiteur"], unit: "par_personne" },
  { slug: "dj", key: "dj", tab: "DJ et animation", title: "DJ de mariage", one: "un DJ de mariage", many: "DJ", count: "DJ et musiciens", claim: "Vous êtes sur cette page ?", catalog: ["dj", "musiciens"], unit: "forfait" },
  { slug: "fleuristes", key: "fleuriste", tab: "Fleuristes", title: "Fleuristes de mariage", one: "un fleuriste de mariage", many: "fleuristes", count: "fleuristes", claim: "Vous êtes sur cette page ?", catalog: ["fleuriste"], unit: "forfait" },
  { slug: "photographes", key: "photographe", tab: "Photographes", title: "Photographes de mariage", one: "un photographe de mariage", many: "photographes", count: "photographes et vidéastes", claim: "Vous êtes sur cette page ?", catalog: ["photographe", "videaste"], unit: "forfait" },
];

export const PRICE_UNIT = { location: "la location", par_personne: "par invité", forfait: "le forfait", par_heure: "de l'heure" };

// Libellé de la médiane, sous le chiffre et dans la FAQ
export const MEDIAN_LABEL = { location: "location seule", par_personne: "par invité", forfait: "la prestation" };
export const MEDIAN_PHRASE = { location: "pour la location seule", par_personne: "par invité", forfait: "pour la prestation" };

export function tradeOf(slug) {
  return TRADES.find((t) => t.slug === slug) || null;
}

export function tradeOfCategory(category) {
  return TRADES.find((t) => t.catalog.includes(category)) || null;
}

// Seuils : une page n'existe qu'avec assez de prestataires, et la médiane qu'avec assez de prix
export const MIN_VENDORS = 8;
export const MIN_PRICED = 5;

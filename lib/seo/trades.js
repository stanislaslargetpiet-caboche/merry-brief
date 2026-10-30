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

// Repère national quand la zone n'a pas assez de prix affichés dans le catalogue. Chiffres Mariages.net,
// vérifiés le 30 oct. 2026 sur mariages.net/articles/budget-mariage-100-personnes--c11469 et
// mariages.net/articles/prix-photographe-mariage--c11471 ; l'année des données est toujours affichée.
export const NATIONAL = {
  lieux: {
    value: "5 500 à 6 500 €",
    label: "budget moyen d'un lieu pour 100 invités, en France",
    answer: "Compte 5 500 à 6 500 € pour 100 invités, en moyenne en France (Mariages.net, rapport 2025 sur les mariages de 2024).",
    source: "Mariages.net, rapport 2025",
  },
  traiteurs: {
    value: "110 €",
    label: "par invité, en moyenne en France",
    answer: "Compte 110 € par invité, en moyenne en France (Mariages.net, Livre blanc du mariage 2023).",
    source: "Mariages.net, Livre blanc du mariage 2023",
  },
  photographes: {
    value: "1 300 €",
    label: "budget photographe moyen, en France",
    answer: "Compte 1 300 €, en moyenne en France (Mariages.net, rapport 2024 sur les mariages de 2023).",
    source: "Mariages.net, rapport 2024",
  },
  dj: {
    value: "1 200 €",
    label: "budget musique moyen, en France",
    answer: "Compte 1 200 € pour la musique, DJ ou groupe, en moyenne en France (Mariages.net, Livre blanc du mariage 2023).",
    source: "Mariages.net, Livre blanc du mariage 2023",
  },
  fleuristes: {
    value: "950 €",
    label: "budget fleurs moyen, en France",
    answer: "Compte 950 € pour les fleurs, en moyenne en France (Mariages.net, Livre blanc du mariage 2023).",
    source: "Mariages.net, Livre blanc du mariage 2023",
  },
};

export function tradeOf(slug) {
  return TRADES.find((t) => t.slug === slug) || null;
}

export function tradeOfCategory(category) {
  return TRADES.find((t) => t.catalog.includes(category)) || null;
}

// Seuils : une page n'existe qu'avec assez de prestataires, et la médiane qu'avec assez de prix
export const MIN_VENDORS = 8;
export const MIN_PRICED = 5;

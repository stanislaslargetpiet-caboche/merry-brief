// Pages SEO : les métiers qui ont une page par zone. `catalog` reprend les catégories de lib/dash/catalog.js ;
// `unit` est l'unité de prix retenue pour la médiane (on ne mélange pas un forfait et un prix par invité).

export const TRADES = [
  { slug: "lieux", key: "lieu", tab: "Lieux", title: "Lieux de mariage", one: "un lieu de mariage", many: "lieux", count: "lieux de réception", claim: "Votre lieu est sur cette page ?", catalog: ["lieu"], unit: "location" },
  { slug: "traiteurs", key: "traiteur", tab: "Traiteurs", title: "Traiteurs de mariage", one: "un traiteur de mariage", many: "traiteurs", count: "traiteurs", claim: "Vous êtes sur cette page ?", catalog: ["traiteur"], unit: "par_personne" },
  { slug: "dj", key: "dj", tab: "DJ et animation", title: "DJ de mariage", one: "un DJ de mariage", many: "DJ", count: "DJ et musiciens", claim: "Vous êtes sur cette page ?", catalog: ["dj", "musiciens"], unit: "forfait" },
  { slug: "fleuristes", key: "fleuriste", tab: "Fleuristes", title: "Fleuristes de mariage", one: "un fleuriste de mariage", many: "fleuristes", count: "fleuristes", claim: "Vous êtes sur cette page ?", catalog: ["fleuriste"], unit: "forfait" },
  { slug: "photographes", key: "photographe", tab: "Photographes", title: "Photographes de mariage", one: "un photographe de mariage", many: "photographes", count: "photographes et vidéastes", claim: "Vous êtes sur cette page ?", catalog: ["photographe", "videaste"], unit: "forfait" },
  // Ajoutés le 5 nov. 2026 : ces métiers n'ont pas encore de prix dans le catalogue (`priced: false`). Leurs pages
  // donnent le nombre de prestataires et la sélection, sans chiffre de prix ni promesse de « tarifs » dans le titre.
// `quote: false` : on ne demande pas un devis à une boutique de robes, on la contacte (titre, description, bouton).
  { slug: "wedding-planners", key: "wedding_planner", tab: "Wedding planners", title: "Wedding planners", one: "un wedding planner", many: "wedding planners", count: "wedding planners", claim: "Vous êtes sur cette page ?", catalog: ["wedding_planner"], unit: "forfait", priced: false },
  { slug: "coiffure-maquillage", key: "beaute", tab: "Coiffure et maquillage", title: "Coiffure et maquillage de mariée", one: "une coiffure et un maquillage de mariée", many: "coiffeurs et maquilleurs", count: "coiffeurs et maquilleurs", claim: "Vous êtes sur cette page ?", catalog: ["beaute"], unit: "forfait", priced: false },
  { slug: "decoration", key: "decoration", tab: "Décoration", title: "Décoration de mariage", one: "la décoration d'un mariage", many: "décorateurs", count: "décorateurs et loueurs de matériel", claim: "Vous êtes sur cette page ?", catalog: ["decoration"], unit: "forfait", priced: false },
  { slug: "robes-costumes", key: "robe", tab: "Robes et costumes", title: "Robes de mariée et costumes", one: "une robe de mariée", many: "boutiques", count: "boutiques de robes et de costumes", claim: "Votre boutique est sur cette page ?", catalog: ["robe"], unit: "forfait", priced: false, quote: false },
  // Ajouté le 5 nov. 2026 : 13 fiches, une par département. Seule la page nationale passe le seuil, et elle les
  // montre toutes (`cards`) ; les pages par région et par département s'ouvriront d'elles-mêmes avec le catalogue.
  { slug: "officiants", key: "officiant", tab: "Officiants", title: "Officiants de cérémonie", one: "un officiant de cérémonie", many: "officiants", count: "officiants de cérémonie", claim: "Vous êtes sur cette page ?", catalog: ["officiant"], unit: "forfait", priced: false, cards: 15 },
];

// Règles de choix des prestataires mis en avant (lib/seo/selection.js), par catégories Google. Mesuré le 5 nov. 2026 :
// environ 11 % des fiches « wedding planner » et 12 % des fiches « décoration » du catalogue sont un autre métier
// (lieux, vidéastes, traiteurs…), souvent rangées là par la catégorie générique « Prestataire de mariage ».
const VENUE = /lieu de mariage|salle de réception|espace événementiel|séminaire|location de cottage|maison de vacances|gîte|chambre d|château|hôtel|camping|restaurant|domaine/;
const OTHER_TRADES = /photograph|disc-jockey|dj\b|traiteur|buffet|fleuriste|cabine photo|boutique de robes|salon de coiffure|maquill/;

const SELECTION = {
  "wedding-planners": {
    strict: true,
    core: ["organisateur de mariages", "organisateur d'événements", "agence événementielle", "service d'organisation d'événements professionnels", "agence spécialisée dans l'organisation de fêtes", "professionnel de l'organisation"],
    coreName: /wedding planner|wedding designer|organisat(eur|rice) de mariage/,
    other: new RegExp(`${VENUE.source}|${OTHER_TRADES.source}`),
    otherName: /\b(domaine|château|manoir|résidence|auberge|moulin|mas|gîte)\b|vidéaste|vidéo|photograph|film/,
  },
  decoration: {
    core: ["décorateur.rice floral.e", "service de location de matériel de soirée", "agence de location de matériel", "magasin d'articles de fête", "boutique d'articles de mariage", "service de location de tentes", "location de tentes et chapiteaux", "service de location de meubles", "décorateur d'intérieur", "designer d'intérieur", "entreprise de scénographie", "magasin d'ameublement et de décoration"],
    coreName: /décorat|scénograph|location de (matériel|mobilier)/,
    other: new RegExp(`${VENUE.source}|${OTHER_TRADES.source}|organisateur de mariages`),
    otherName: /\b(domaine|château|manoir|auberge)\b|vidéaste|vidéo|photograph/,
  },
  "coiffure-maquillage": {
    core: ["maquilleur.euse", "prestataire de mariage", "conseiller en image personnelle"],
    coreName: /mari(é|e|age)|wedding|bridal|noces|bride/,
    other: /institut|esthéticien|manucure|massage|soins du visage|épilation|spa|bien-être|bronzage|amincissement|tatoueur|barbier|cils|sourcils|centre de formation|école|magasin de|parfumerie|hammam|sauna|soin des pieds|service establishment/,
    otherName: null,
  },
};
for (const t of TRADES) if (SELECTION[t.slug]) t.selection = SELECTION[t.slug];

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
// Les métiers ajoutés le 5 nov. : une page départementale n'est indexée (sitemap, pas de noindex) qu'à partir de
// ce nombre de prestataires. En dessous, Google la classe « explorée, non indexée » (Search Console, 10 nov. 2026 :
// 68 des 74 pages concernées en font partie). Elle reste ouverte aux visiteurs. Les cinq métiers plus anciens
// gardent le seuil d'ouverture : leurs pages à 8 fiches sont indexées.
export const MIN_INDEXED_DEPARTMENT = 20;
const THIN_PAGES = ["wedding-planners", "coiffure-maquillage", "decoration", "robes-costumes", "officiants"];
for (const t of TRADES) if (THIN_PAGES.includes(t.slug)) t.minIndexed = MIN_INDEXED_DEPARTMENT;
export const MIN_PRICED = 5;

// Titre des pages SEO dans l'onglet et dans les résultats de recherche. Google coupe vers 60 à 65 caractères :
// on garde le suffixe le plus parlant qui tient, puis la marque seule, puis rien.
// « Lieux de mariage en Bretagne : tarifs et sélection | Merry » (58)
// « Traiteurs de mariage dans les Alpes-de-Haute-Provence | Merry » (61), sans « tarifs et sélection ».
// Un métier sans prix dans le catalogue (`priced: false`) ne promet pas de tarifs :
// « Wedding planners en Bretagne : sélection et devis | Merry ».

export const TITLE_MAX = 65;
const WITH_PRICES = [" : tarifs et sélection | Merry", " : tarifs | Merry", " | Merry", ""];
const WITHOUT_PRICES = [" : sélection et devis | Merry", " : sélection | Merry", " | Merry", ""];
// Un métier où l'on ne demande pas de devis (`quote: false`, les boutiques de robes) n'en promet pas non plus
const WITHOUT_QUOTES = WITHOUT_PRICES.slice(1);

export function seoTitle(base, { priced = true, quote = true, max = TITLE_MAX } = {}) {
  const b = String(base || "").trim();
  const suffixes = !quote ? WITHOUT_QUOTES : priced ? WITH_PRICES : WITHOUT_PRICES;
  for (const suffix of suffixes) if ((b + suffix).length <= max) return b + suffix;
  return b;
}

// Titre des pages SEO dans l'onglet et dans les résultats de recherche. Google coupe vers 60 à 65 caractères :
// on garde le suffixe le plus parlant qui tient, et la marque toujours.
// « Lieux de mariage en Bretagne : tarifs et sélection | Merry » (58)
// « Traiteurs de mariage dans les Alpes-de-Haute-Provence | Merry » (61), sans « tarifs et sélection ».

export const TITLE_MAX = 65;
const SUFFIXES = [" : tarifs et sélection | Merry", " : tarifs | Merry", " | Merry"];

export function seoTitle(base, max = TITLE_MAX) {
  const b = String(base || "").trim();
  for (const suffix of SUFFIXES) if ((b + suffix).length <= max) return b + suffix;
  return b + SUFFIXES[SUFFIXES.length - 1];
}

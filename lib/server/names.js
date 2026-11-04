// Prénoms saisis tout en minuscules (« emma ») : majuscule à l'affichage dans les mails. Un nom qui
// contient déjà une majuscule reste tel quel (« Jean-Marie », « de La Tour », « LE CERCLE DU GOÛT »).
export function displayName(name) {
  const clean = String(name || "").trim();
  if (clean !== clean.toLowerCase()) return clean;
  return clean.replace(/(^|[\s'’-])(\p{L})/gu, (_, before, letter) => before + letter.toUpperCase());
}

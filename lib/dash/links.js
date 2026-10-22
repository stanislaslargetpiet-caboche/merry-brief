// Ce que le budget sait déjà et que les tâches n'ont pas à redemander : un poste dont le devis est
// signé (Traiteur, Lieu…) vaut « prestataire réservé ». Les tâches type « Choisir le traiteur » se
// cochent alors toutes seules, et le générateur ne les repropose pas.

import { normalize } from "./format";

// Quels libellés de poste (ou catégories de prestataire) valent quel prestataire du générateur
const POSTE_MATCH = {
  lieu: /\b(lieu|domaine|salle|chateau|reception)\b/,
  traiteur: /traiteur|repas|buffet|cocktail/,
  photographe: /photo/,
  videaste: /video/,
  dj: /\bdj\b|musique|musicien|orchestre|animation/,
  fleuriste: /fleur|deco/,
  robe: /\brobe\b/,
  costume: /costume/,
  officiant: /officiant/,
  hebergement: /hebergement|chambre|gite|logement/,
  fairepart: /faire.?part|papeterie/,
};

// Tâche type (titre normalisé) → prestataire qu'elle sert à trouver
const TASK_VENDOR = {
  "reserver le lieu": "lieu",
  "choisir le traiteur": "traiteur",
  "reserver le photographe": "photographe",
  "choisir le videaste": "videaste",
  "choisir le dj ou les musiciens": "dj",
  "choisir le fleuriste": "fleuriste",
  "choisir la robe": "robe",
  "choisir le costume": "costume",
  "trouver l officiant": "officiant",
  "bloquer des chambres pres du lieu": "hebergement",
  "commander les faire part": "fairepart",
};

const hasQuote = (item) => item.quote_amount !== null && item.quote_amount !== undefined && item.quote_amount !== "";

// Les prestataires (ids du générateur) couverts par un poste, d'après son libellé et la catégorie de son prestataire
export function vendorChoicesOf(item, vendors = []) {
  const vendor = vendors.find((v) => v.id === item.vendor_id);
  const text = normalize(`${item.label || ""} ${vendor?.category || ""}`);
  return Object.entries(POSTE_MATCH).filter(([, re]) => re.test(text)).map(([id]) => id);
}

// Prestataires déjà réservés : ceux dont un poste a un devis signé
export function signedVendorChoices(data) {
  return [...new Set(data.items.filter(hasQuote).flatMap((i) => vendorChoicesOf(i, data.vendors)))];
}

// Les tâches à cocher quand ce poste reçoit un devis signé
export function tasksDoneByQuote(item, data) {
  if (!hasQuote(item)) return [];
  const covered = vendorChoicesOf(item, data.vendors);
  return data.tasks.filter((t) => !t.done && covered.includes(TASK_VENDOR[normalize(t.title)])).map((t) => t.id);
}

// Couleurs du tableau de bord (palette validée dans le canvas « Merry · Carte brief »).

export const INK = "#1c1c1a";
export const MUTED = "#6b6a63";
export const LINE = "#ecebe6";
export const PANEL = "#f6f5f1";
export const BORDER = "#d9d7cf";
export const LIME = "#cbff75";
export const LIMETINT = "#f1fbdd";
export const OK_BG = "#ecfbcf";
export const OK_INK = "#35520a";

// Pastels Merry, utilisés pour les organisateurs et les groupes d'invités.
// bg = fond de pastille, mid = avatar et camembert, ink = texte.
export const PASTELS = {
  lavande: { bg: "#ebe6fb", mid: "#bcb0f0", ink: "#4a3d99" },
  peche: { bg: "#fbe5dc", mid: "#f1b8a1", ink: "#8c4229" },
  bleu: { bg: "#e0ebf6", mid: "#a5c4e4", ink: "#2b5479" },
  sauge: { bg: "#e5eadc", mid: "#b9c8a6", ink: "#3f5a31" },
  jaune: { bg: "#f4f5d6", mid: "#e4e690", ink: "#5d5e12" },
  rose: { bg: "#fbe3ec", mid: "#efb2c8", ink: "#8a2f52" },
  gris: { bg: "#efeeea", mid: "#cfccc3", ink: "#4d4c46" },
};
export const PASTEL_KEYS = ["lavande", "peche", "bleu", "sauge", "jaune", "rose", "gris"];

export function pastel(key) {
  return PASTELS[key] || PASTELS.gris;
}

// Couleurs des postes dans le camembert « Par poste » (différentes des personnes)
export const POSTE_COLORS = ["#f0d27a", "#cbff75", "#d8c3a5", "#f2b3c9", "#c9c6bd", "#9fd8c9", "#f5b98a", "#b7c4f5", "#e3e3a1", "#d6d2c4"];

// Réponses des invités
export const RSVP = {
  oui: { label: "Oui", bg: OK_BG, ink: OK_INK, check: true, weight: 600 },
  non: { label: "Non", bg: "#fde0de", ink: "#9b2c2c", weight: 600 },
  attente: { label: "En attente", bg: "#ffe6cc", ink: "#8a4b0f", weight: 600 },
  non_invite: { label: "Non invité", bg: "#fdeceb", ink: "#b05a55", weight: 500 },
};
export const RSVP_ORDER = ["oui", "non", "attente", "non_invite"];

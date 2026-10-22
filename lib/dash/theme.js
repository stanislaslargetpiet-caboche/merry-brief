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

// Pastille d'un poste de budget : émoticône et pastel propres au poste (clé de guessIcon)
const POSTE_LOOKS = {
  lieu: ["🏰", "#e3edfb", "#1f3b5c"],
  traiteur: ["🍽️", "#fff1d6", "#7a4a06"],
  photo: ["📸", "#efe8fb", "#4b2d7a"],
  musique: ["🎶", "#e2f4ef", "#1f5547"],
  fleurs: ["💐", "#fbe5ec", "#7a2945"],
  tenues: ["👗", "#fbeee3", "#7a4123"],
  alliances: ["💍", "#e9f8d4", "#35520a"],
  enveloppe: ["💌", "#fdeaf0", "#7a2945"],
  beaute: ["💄", "#fbe3ec", "#8a2f52"],
  mairie: ["🏛️", "#efeeea", "#4d4c46"],
  lit: ["🛏️", "#e0ebf6", "#2b5479"],
  cadeau: ["🎁", "#f4f5d6", "#5d5e12"],
};

export function posteLook(key) {
  const l = POSTE_LOOKS[key] || ["📄", "#efeeea", "#4d4c46"];
  return { emoji: l[0], bg: l[1], ink: l[2] };
}

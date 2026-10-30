// Couleurs du tableau de bord (palette validée dans le canvas « Merry · Carte brief »).

export const OK_BG = "#fcebdd";
export const OK_INK = "#8a3f1c";

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
export const POSTE_COLORS = ["#f0d27a", "#cbe8a0", "#d8c3a5", "#f2b3c9", "#c9c6bd", "#9fd8c9", "#f5b98a", "#b7c4f5", "#e3e3a1", "#d6d2c4"];

// Réponses des invités
// Quatre statuts par moment du mariage : Non invité, Invité (réponse attendue), Vient, Ne vient pas
export const RSVP = {
  attente: { label: "Invité", hint: "Réponse attendue", bg: "#ffe6cc", ink: "#8a4b0f", weight: 600 },
  oui: { label: "Vient", hint: "A confirmé sa présence", bg: OK_BG, ink: OK_INK, check: true, weight: 600 },
  non: { label: "Ne vient pas", hint: "A décliné", bg: "#fde0de", ink: "#9b2c2c", weight: 600 },
  non_invite: { label: "Non invité", hint: "Pas convié à ce moment", bg: "#efeeea", ink: "#6b6a63", weight: 500 },
};
export const RSVP_ORDER = ["attente", "oui", "non", "non_invite"];

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

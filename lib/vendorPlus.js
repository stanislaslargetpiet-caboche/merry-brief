// « Plus d'informations » : questions propres aux lieux de réception (primary_category === "lieu"),
// enregistrées dans vendor.details (voir DETAIL_KEYS, lib/pro/store.js). Source commune à l'espace
// prestataire (édition, app/pro/fiche) et au tableau de bord des couples (lecture, FichePanel dans
// components/dash/Prestataires.js), pour que les libellés restent identiques des deux côtés.

// Choix à pastilles : toujours plusieurs réponses possibles
export const PLUS_CHOICES = [
  {
    key: "espaces",
    question: "De quels espaces disposez-vous ?",
    options: [
      { value: "salle", label: "Salle de réception" },
      { value: "terrasse", label: "Terrasse" },
      { value: "jardin", label: "Jardin" },
      { value: "piste", label: "Piste de danse" },
      { value: "cuisine", label: "Cuisine pour le traiteur" },
      { value: "ceremonie", label: "Espace cérémonie laïque" },
      { value: "enfants", label: "Jeux / salle pour enfants" },
    ],
  },
  {
    key: "services",
    question: "Quels services proposez-vous ?",
    options: [
      { value: "banquet", label: "Banquet" },
      { value: "ceremonie", label: "Cérémonie" },
      { value: "decoration", label: "Décoration" },
      { value: "hebergement", label: "Hébergement" },
      { value: "wedding_planner", label: "Wedding planner sur place" },
    ],
  },
  {
    key: "geo",
    question: "Situation géographique",
    options: [
      { value: "campagne", label: "À la campagne" },
      { value: "riviere", label: "Proche d’une rivière" },
      { value: "ville", label: "À la sortie de la ville" },
      { value: "montagne", label: "En montagne" },
    ],
  },
  {
    key: "type_reception",
    question: "Quel type de réception proposez-vous ?",
    options: [
      { value: "vin", label: "Vin d’honneur" },
      { value: "cocktail", label: "Cocktail" },
      { value: "diner", label: "Dîner" },
      { value: "brunch", label: "Brunch" },
      { value: "buffet", label: "Buffet" },
      { value: "aperitif", label: "Apéritif" },
    ],
  },
  {
    key: "gastronomie",
    question: "Quel type de gastronomie proposez-vous ?",
    options: [
      { value: "traditionnelle", label: "Traditionnelle" },
      { value: "creative", label: "Cuisine créative" },
      { value: "internationale", label: "Internationale" },
      { value: "regionale", label: "Régionale" },
    ],
  },
  {
    key: "menus_specifiques",
    question: "Proposez-vous des menus spécifiques ?",
    options: [
      { value: "vegetarien", label: "Végétariens" },
      { value: "vegan", label: "Végans" },
      { value: "sans_gluten", label: "Sans gluten" },
      { value: "casher_halal", label: "Casher / halal" },
    ],
  },
  {
    key: "paiement",
    question: "Comment s’effectue le paiement ?",
    options: [
      { value: "virement", label: "Virement" },
      { value: "cheque", label: "Chèque" },
      { value: "especes", label: "Espèces" },
      { value: "cb", label: "Carte bancaire" },
    ],
  },
];

// Oui / non
export const PLUS_TOGGLES = [
  { key: "multi_evenements", question: "Célébrez-vous plus d’un événement par jour ?" },
  { key: "sans_traiteur", question: "Est-il possible de louer le lieu sans inclure les services du traiteur ?" },
  { key: "cuisine_privee", question: "Disposez-vous d’un service traiteur ou d’une cuisine privée ?" },
  { key: "menus_adaptables", question: "Est-il possible d’adapter ou de modifier les menus ?" },
  { key: "gateaux_proposes", question: "Proposez-vous des gâteaux de mariage ?" },
  { key: "boissons_apportees", question: "Le couple peut-il apporter ses propres boissons ?" },
  { key: "photographe_impose", question: "Le photographe est-il imposé ?" },
  { key: "musique_exclusivite", question: "Exclusivité musique (DJ, orchestre imposé) ?" },
  { key: "prix_fixe", question: "Existe-t-il un prix fixe pour louer le lieu, hors prestations ?" },
];

// Réponse libre, courte
export const PLUS_TEXT = [{ key: "gateau_apporte", question: "Le couple peut-il apporter son propre gâteau ? Facturez-vous une majoration ?" }];

export const PLUS_DETAIL_KEYS = [...PLUS_CHOICES.map((c) => c.key), ...PLUS_TOGGLES.map((t) => t.key), ...PLUS_TEXT.map((t) => t.key)];

// Les réponses réellement renseignées, pour la lecture côté couples : chaque entrée { question, kind, value }
// kind "choices" : value = labels cochés ; "toggle" : value = "Oui"/"Non" ; "text" : value = texte libre
export function plusAnswers(details) {
  if (!details) return [];
  const out = [];
  for (const c of PLUS_CHOICES) {
    // Une valeur hors options vient du bouton « Autre » (lib/pro/fiche) : affichée telle quelle
    const raw = details[c.key];
    const labels = (Array.isArray(raw) ? raw : []).map((v) => c.options.find((o) => o.value === v)?.label || (typeof v === "string" ? v.trim() : "")).filter(Boolean);
    if (labels.length) out.push({ question: c.question, kind: "choices", labels });
  }
  for (const t of PLUS_TOGGLES) {
    if (details[t.key] === true) out.push({ question: t.question, kind: "text", value: "Oui" });
    else if (details[t.key] === false) out.push({ question: t.question, kind: "text", value: "Non" });
  }
  for (const t of PLUS_TEXT) {
    const value = String(details[t.key] || "").trim();
    if (value) out.push({ question: t.question, kind: "text", value });
  }
  return out;
}

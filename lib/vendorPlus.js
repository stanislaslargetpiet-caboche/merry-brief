// « Plus d'informations » : questions propres à chaque métier (primary_category), enregistrées dans
// vendor.details (voir DETAIL_KEYS, lib/pro/store.js). Source commune à l'espace prestataire (édition,
// app/pro/fiche) et au tableau de bord des couples (lecture, FichePanel dans components/dash/Prestataires.js),
// pour que les libellés restent identiques des deux côtés. Chaque question porte les métiers auxquels
// elle s'applique (`categories`) : un lieu et un traiteur n'ont pas les mêmes questions pertinentes.

// Choix à pastilles : toujours plusieurs réponses possibles
export const PLUS_CHOICES = [
  {
    key: "espaces",
    categories: ["lieu"],
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
    categories: ["lieu"],
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
    categories: ["lieu"],
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
    categories: ["traiteur"],
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
    categories: ["traiteur"],
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
    categories: ["traiteur"],
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
    categories: ["lieu", "traiteur"],
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
  { key: "multi_evenements", categories: ["lieu"], question: "Célébrez-vous plus d’un événement par jour ?" },
  { key: "sans_traiteur", categories: ["lieu"], question: "Est-il possible de louer le lieu sans inclure les services du traiteur ?" },
  { key: "cuisine_privee", categories: ["lieu"], question: "Disposez-vous d’un service traiteur ou d’une cuisine privée ?" },
  { key: "boissons_apportees", categories: ["lieu"], question: "Le couple peut-il apporter ses propres boissons ?" },
  { key: "photographe_impose", categories: ["lieu"], question: "Le photographe est-il imposé ?" },
  { key: "musique_exclusivite", categories: ["lieu"], question: "Exclusivité musique (DJ, orchestre imposé) ?" },
  { key: "prix_fixe", categories: ["lieu"], question: "Existe-t-il un prix fixe pour louer le lieu, hors prestations ?" },
  { key: "menus_adaptables", categories: ["traiteur"], question: "Est-il possible d’adapter ou de modifier les menus ?" },
  { key: "gateaux_proposes", categories: ["traiteur"], question: "Proposez-vous des gâteaux de mariage ?" },
];

// Réponse libre, courte
export const PLUS_TEXT = [{ key: "gateau_apporte", categories: ["traiteur"], question: "Le couple peut-il apporter son propre gâteau ? Facturez-vous une majoration ?" }];

// Les questions qui s'appliquent à un métier donné (primary_category)
export function plusFor(category) {
  const has = (q) => q.categories.includes(category);
  return { choices: PLUS_CHOICES.filter(has), toggles: PLUS_TOGGLES.filter(has), text: PLUS_TEXT.filter(has) };
}

export const PLUS_DETAIL_KEYS = [...PLUS_CHOICES.map((c) => c.key), ...PLUS_TOGGLES.map((t) => t.key), ...PLUS_TEXT.map((t) => t.key)];

// Les réponses réellement renseignées, pour la lecture côté couples : chaque entrée { question, kind, value }
// kind "choices" : value = labels cochés ; "toggle" : value = "Oui"/"Non" ; "text" : value = texte libre
export function plusAnswers(details, category) {
  if (!details || !category) return [];
  const { choices, toggles, text } = plusFor(category);
  const out = [];
  for (const c of choices) {
    // Une valeur hors options vient du bouton « Autre » (lib/pro/fiche) : affichée telle quelle
    const raw = details[c.key];
    const labels = (Array.isArray(raw) ? raw : []).map((v) => c.options.find((o) => o.value === v)?.label || (typeof v === "string" ? v.trim() : "")).filter(Boolean);
    if (labels.length) out.push({ question: c.question, kind: "choices", labels });
  }
  for (const t of toggles) {
    if (details[t.key] === true) out.push({ question: t.question, kind: "text", value: "Oui" });
    else if (details[t.key] === false) out.push({ question: t.question, kind: "text", value: "Non" });
  }
  for (const t of text) {
    const value = String(details[t.key] || "").trim();
    if (value) out.push({ question: t.question, kind: "text", value });
  }
  return out;
}

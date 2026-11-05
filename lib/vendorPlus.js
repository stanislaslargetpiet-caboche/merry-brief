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
    categories: ["traiteur", "dj", "musiciens", "fleuriste", "photographe", "videaste", "decoration", "wedding_planner", "patisserie", "beaute", "robe", "transport", "officiant"],
    question: "Comment s’effectue le paiement ?",
    options: [
      { value: "virement", label: "Virement" },
      { value: "cheque", label: "Chèque" },
      { value: "especes", label: "Espèces" },
      { value: "cb", label: "Carte bancaire" },
    ],
  },
  {
    key: "dj_materiel",
    categories: ["dj", "musiciens"],
    question: "Quel matériel fournissez-vous ?",
    options: [
      { value: "sono", label: "Sonorisation" },
      { value: "eclairage", label: "Éclairage" },
      { value: "fumee", label: "Machine à fumée" },
      { value: "ecran", label: "Écran vidéo" },
      { value: "micro", label: "Micro pour les discours" },
    ],
  },
  {
    key: "photo_formats",
    categories: ["photographe", "videaste"],
    question: "Quels formats proposez-vous ?",
    options: [
      { value: "album", label: "Album photo" },
      { value: "tirages", label: "Tirages" },
      { value: "drone", label: "Prises de vue au drone" },
      { value: "highlights", label: "Film de mariage court" },
      { value: "film_long", label: "Film de mariage long" },
      { value: "brutes", label: "Photos brutes en plus des retouchées" },
    ],
  },
  {
    key: "fleur_prestations",
    categories: ["fleuriste", "decoration"],
    question: "Quelles prestations proposez-vous ?",
    options: [
      { value: "bouquet", label: "Bouquet de la mariée" },
      { value: "boutonnieres", label: "Boutonnières" },
      { value: "centres_table", label: "Centres de table" },
      { value: "arche", label: "Arche florale" },
      { value: "deco_salle", label: "Décoration de salle" },
    ],
  },
  {
    key: "planner_accompagnement",
    categories: ["wedding_planner"],
    question: "Quel type d’accompagnement proposez-vous ?",
    options: [
      { value: "complete", label: "Organisation complète" },
      { value: "coordination", label: "Coordination jour J" },
      { value: "conseil", label: "Conseil ponctuel" },
      { value: "budget", label: "Suivi du budget et des devis" },
    ],
  },
  {
    key: "patisserie_pieces",
    categories: ["patisserie"],
    question: "Quelles pièces proposez-vous ?",
    options: [
      { value: "piece_montee", label: "Pièce montée" },
      { value: "wedding_cake", label: "Wedding cake" },
      { value: "bar_desserts", label: "Bar à desserts" },
      { value: "macarons", label: "Macarons" },
    ],
  },
  {
    key: "options_alimentaires",
    categories: ["patisserie"],
    question: "Proposez-vous des options alimentaires spécifiques ?",
    options: [
      { value: "sans_gluten", label: "Sans gluten" },
      { value: "vegan", label: "Végan" },
      { value: "sans_sucre", label: "Sans sucre ajouté" },
      { value: "sans_lactose", label: "Sans lactose" },
    ],
  },
  {
    key: "beaute_prestations",
    categories: ["beaute"],
    question: "Quelles prestations proposez-vous ?",
    options: [
      { value: "coiffure", label: "Coiffure" },
      { value: "maquillage", label: "Maquillage" },
      { value: "essai", label: "Essai avant le jour J" },
      { value: "soin", label: "Soin" },
      { value: "invitees", label: "Pour les invitées aussi" },
    ],
  },
  {
    key: "robe_services",
    categories: ["robe"],
    question: "Quels services proposez-vous ?",
    options: [
      { value: "essayages", label: "Essayages" },
      { value: "retouches", label: "Retouches" },
      { value: "location", label: "Location" },
      { value: "vente", label: "Vente" },
    ],
  },
  {
    key: "transport_vehicules",
    categories: ["transport"],
    question: "Quels véhicules proposez-vous ?",
    options: [
      { value: "ancienne", label: "Voiture ancienne" },
      { value: "limousine", label: "Limousine" },
      { value: "minibus", label: "Minibus" },
      { value: "calèche", label: "Calèche" },
    ],
  },
  {
    key: "officiant_ceremonies",
    categories: ["officiant"],
    question: "Quels types de cérémonie proposez-vous ?",
    options: [
      { value: "laique", label: "Laïque" },
      { value: "religieuse", label: "Religieuse" },
      { value: "symbolique", label: "Symbolique" },
    ],
  },
];

// Oui / non
export const PLUS_TOGGLES = [
  { key: "menus_adaptables", categories: ["traiteur"], question: "Est-il possible d’adapter ou de modifier les menus ?" },
  { key: "gateaux_proposes", categories: ["traiteur"], question: "Proposez-vous des gâteaux de mariage ?" },
  { key: "dj_playlist", categories: ["dj", "musiciens"], question: "Proposez-vous une playlist personnalisée ?" },
  { key: "dj_animateur", categories: ["dj"], question: "Un animateur (MC) est-il inclus ?" },
  { key: "dj_repetition", categories: ["dj", "musiciens"], question: "Vous déplacez-vous pour une répétition avant l’événement ?" },
  { key: "photo_essai", categories: ["photographe", "videaste"], question: "Proposez-vous une séance d’essai avant le jour J ?" },
  { key: "photo_equipe", categories: ["photographe", "videaste"], question: "Travaillez-vous en équipe (plusieurs photographes ou vidéastes présents) ?" },
  { key: "fleur_livraison", categories: ["fleuriste", "decoration"], question: "Livrez-vous et installez-vous sur place ?" },
  { key: "fleur_reprise", categories: ["fleuriste", "decoration"], question: "Reprenez-vous le matériel après l’événement ?" },
  { key: "fleur_saison", categories: ["fleuriste"], question: "Travaillez-vous avec des fleurs de saison uniquement ?" },
  { key: "planner_budget", categories: ["wedding_planner"], question: "Gérez-vous aussi le budget et les devis prestataires ?" },
  { key: "planner_jourj", categories: ["wedding_planner"], question: "Êtes-vous présent le jour J ?" },
  { key: "patisserie_degustation", categories: ["patisserie"], question: "Proposez-vous une dégustation avant de commander ?" },
  { key: "patisserie_livraison", categories: ["patisserie"], question: "Livrez-vous sur place ?" },
  { key: "beaute_deplacement", categories: ["beaute"], question: "Vous déplacez-vous le jour J ?" },
  { key: "beaute_essai", categories: ["beaute"], question: "Un essai est-il inclus dans le forfait ?" },
  { key: "robe_retouches", categories: ["robe"], question: "Faites-vous les retouches sur place ?" },
  { key: "transport_chauffeur", categories: ["transport"], question: "Un chauffeur est-il inclus ?" },
  { key: "officiant_texte", categories: ["officiant"], question: "Rédigez-vous un texte personnalisé pour la cérémonie ?" },
  { key: "officiant_deplacement", categories: ["officiant"], question: "Vous déplacez-vous hors de votre région ?" },
];

// Réponse libre, courte
export const PLUS_TEXT = [
  { key: "gateau_apporte", categories: ["traiteur"], question: "Le couple peut-il apporter son propre gâteau ? Facturez-vous une majoration ?" },
  { key: "photo_delai", categories: ["photographe", "videaste"], question: "Quel est le délai de livraison des photos ou de la vidéo ?" },
  { key: "planner_rdv", categories: ["wedding_planner"], question: "Combien de rendez-vous sont inclus dans votre forfait ?" },
  { key: "robe_delai", categories: ["robe"], question: "Quel est le délai moyen de commande ?" },
  { key: "transport_distance", categories: ["transport"], question: "Quelle distance maximale couvrez-vous ?" },
];

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

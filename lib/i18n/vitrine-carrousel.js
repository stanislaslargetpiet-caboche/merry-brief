/*
 * Textes de la section « Comment ça marche » de l'accueil (components/vitrine/Carrousel.js), en français et en anglais :
 * une seule source pour l'ordinateur et le téléphone. Trois étapes de deux scènes : Ton brief (brief, plan),
 * Prestataires (matchs, devis), Tout le reste (invités, à plusieurs). Source du français : canvas « Merry · Carte
 * brief », page « 9 - Site vitrine », planches Site-Brief-1 à 6, validées par Stan le 10 nov. 2026. Données d'exemple
 * (Alice et Ben) ; les visages reprennent les prénoms du bloc d'accueil (lib/vitrine/blocks/proposition.js). Le
 * compteur de lieux vient de la base : 317 lieux actifs en Provence-Alpes-Côte d'Azur de 120 places assises ou plus
 * (catalog.vendors, relevé du 10 nov. 2026).
 */

const B = "/vitrine/blocks";
export const VENUES = {
  oliviers: { img: `${B}/carrousel-2.webp`, name: "Domaine des Oliviers" },
  source: { img: `${B}/carrousel-3.webp`, name: "Mas de la Source" },
  clair: { img: `${B}/carrousel-1.webp`, name: "Bastide Saint-Clair" },
};
export const COUPLE_PHOTO = `${B}/carrousel-6.webp`;
export const MOODS = [`${B}/proposition-1.webp`, `${B}/proposition-2.webp`, `${B}/proposition-3.webp`, "/vitrine/invites-1.webp"];
export const FACES = {
  lea: `${B}/proposition-11.webp`,
  hugo: `${B}/proposition-10.webp`,
  sophie: `${B}/proposition-7.webp`,
  parentsAlice: `${B}/proposition-8.webp`,
  parentsBen: `${B}/proposition-9.webp`,
};
export const VENUE_COUNT = 317;

const TEXTES = {
  fr: {
    tabsLabel: "Les trois étapes",
    pause: "Mettre en pause",
    play: "Relancer",
    steps: [
      {
        tab: "Ton brief",
      },
      {
        tab: "Prestataires",
      },
      {
        tab: "Tout le reste",
      },
    ],
    brief: ["Provence", "19 juin 2027", "120 invités", "35 000 €", "Champêtre chic"],
    briefScene: {
      title: "Ton brief.",
      before: "4 sur 5",
      after: "5 sur 5",
      couple: "Alice et Ben",
      wedding: "Ton mariage",
      rows: [
        ["Où", "Provence"],
        ["Quand", "Samedi 19 juin 2027"],
        ["Combien", "120 invités"],
        ["Budget", "35 000 €"],
        ["Ambiance", "Champêtre chic"],
      ],
      mood: "Ton ambiance",
      moodCount: "3 choisies",
      moods: ["Vieilles pierres", "Dîner sous tente", "Jardins à la française", "Voiture ancienne"],
    },
    plan: {
      title: "Ton plan.",
      timeline: "Ton rétroplanning",
      ready: "Prêt",
      steps: [
        ["Juin 2026", "Choisir le lieu"],
        ["Sept. 2026", "Réserver le traiteur"],
        ["Déc. 2026", "Envoyer les faire-part"],
        ["Mars 2027", "Essayer les tenues"],
        ["19 juin 2027", "Le jour J"],
      ],
      budget: "Ton budget",
      split: "Réparti",
      total: "35 000 €",
      posts: "6 postes",
      // [poste, montant affiché, montant en euros pour l'anneau]
      rows: [
        ["Lieu", "10 500 €", 10500],
        ["Traiteur", "12 000 €", 12000],
        ["Tenues", "3 500 €", 3500],
        ["Photographe", "3 000 €", 3000],
        ["Musique", "2 500 €", 2500],
        ["Fleurs", "2 000 €", 2000],
      ],
      more: "Et trois autres postes.",
      venues: "Tes premiers lieux",
      found: "Trouvés",
      count: "lieux de 120 places assises ou plus en Provence-Alpes-Côte d'Azur",
      list: [
        { ...VENUES.oliviers, area: "Luberon · dès 9 800 €" },
        { ...VENUES.source, area: "Alpilles · dès 11 300 €" },
        { ...VENUES.clair, area: "Var · dès 8 400 €" },
      ],
    },
    matches: {
      title: "Tes matchs.",
      cats: ["Lieux", "Traiteurs", "Photographes", "DJ"],
      cards: [
        { ...VENUES.oliviers, area: "Luberon", seats: "150 places assises", price: "9 800 €" },
        { ...VENUES.source, area: "Alpilles", seats: "160 places assises", price: "11 300 €" },
        { ...VENUES.clair, area: "Var", seats: "140 places assises", price: "8 400 €" },
      ],
      budget: "Dans ton budget",
      style: "Champêtre chic",
      from: "À partir de",
      selCount: "3 lieux",
      selLabel: "Ta sélection",
      selCta: "Demander les devis (3)",
    },
    quotes: {
      title: "Tes devis.",
      replies: "3 réponses sur 3",
      request: "Ta demande",
      lines: [
        "Bonjour,",
        "Nous organisons notre mariage le samedi 19 juin 2027 en Provence, pour 120 invités, avec un budget de 35 000 € et une ambiance champêtre chic.",
        "Êtes-vous disponibles à cette date ? Pouvez-vous nous envoyer un devis ?",
        "Alice et Ben",
      ],
      sent: "Envoyée aux 3 lieux",
      best: "Meilleur prix",
      free: "Libre le 19 juin",
      full: "Complet le 19 juin",
      choose: "Choisir ce lieu",
      see: "Voir le devis",
      cards: [
        { ...VENUES.oliviers, area: "Luberon", price: "9 800 €", free: true, best: true },
        { ...VENUES.source, area: "Alpilles", price: "11 300 €", free: true },
        { ...VENUES.clair, area: "Var", price: "8 400 €", free: false },
      ],
    },
    guests: {
      title: "Tes invités.",
      couple: "Alice & Ben",
      when: "Samedi 19 juin 2027 · Provence",
      question: "Léa, seras-tu des nôtres ?",
      yes: "Oui, avec joie",
      no: "Non, hélas",
      note: "On a trop hâte !",
      before: "86",
      after: "87",
      of: "oui sur 120 invités",
      latest: "Dernières réponses",
      // [visage, nom, réponse, quand]
      rows: [
        ["lea", "Léa, témoin d'Alice", "Oui, avec joie", "À l'instant"],
        ["hugo", "Hugo, témoin de Ben", "Oui", "Il y a 2 h"],
        ["sophie", "Sophie", "Oui, végétarienne", "Hier"],
        ["parentsAlice", "Les parents d'Alice", "Oui, à deux", "Hier"],
      ],
      photo: "Photo d'Alice et Ben",
    },
    team: {
      title: "À plusieurs.",
      invite: "Inviter",
      week: "Cette semaine",
      // [visage, qui, quoi, quand]
      rows: [
        ["parentsBen", "Les parents de Ben", "ont ajouté 14 invités à la liste", "10 h"],
        ["lea", "Léa, témoin d'Alice", "a publié le site de mariage", "Hier"],
        ["parentsAlice", "Les parents d'Alice", "ont versé leur participation : 3 000 €", "Hier"],
        ["hugo", "Hugo, témoin de Ben", "a coché « Réserver le DJ »", "Lundi"],
      ],
      site: "alice-et-ben",
      siteCap: "Site de mariage",
      online: "En ligne",
      stats: [
        ["87", "oui"],
        ["22 700 €", "engagés"],
        ["J-7 mois", "avant le jour J"],
      ],
      photo: "Site de mariage d'Alice et Ben",
    },
  },
  en: {
    tabsLabel: "The three steps",
    pause: "Pause",
    play: "Play",
    steps: [
      {
        tab: "Your brief",
      },
      {
        tab: "Vendors",
      },
      {
        tab: "Everything else",
      },
    ],
    brief: ["Provence", "June 19, 2027", "120 guests", "€35,000", "Rustic chic"],
    briefScene: {
      title: "Your brief.",
      before: "4 of 5",
      after: "5 of 5",
      couple: "Alice and Ben",
      wedding: "Your wedding",
      rows: [
        ["Where", "Provence"],
        ["When", "Saturday, June 19, 2027"],
        ["How many", "120 guests"],
        ["Budget", "€35,000"],
        ["Vibe", "Rustic chic"],
      ],
      mood: "Your vibe",
      moodCount: "3 picked",
      moods: ["Old stone", "Dinner under canvas", "Formal gardens", "Vintage car"],
    },
    plan: {
      title: "Your plan.",
      timeline: "Your timeline",
      ready: "Ready",
      steps: [
        ["June 2026", "Pick the venue"],
        ["Sept 2026", "Book the caterer"],
        ["Dec 2026", "Send the invitations"],
        ["Mar 2027", "Outfit fittings"],
        ["June 19, 2027", "The big day"],
      ],
      budget: "Your budget",
      split: "Allocated",
      total: "€35,000",
      posts: "6 categories",
      rows: [
        ["Venue", "€10,500", 10500],
        ["Catering", "€12,000", 12000],
        ["Outfits", "€3,500", 3500],
        ["Photographer", "€3,000", 3000],
        ["Music", "€2,500", 2500],
        ["Flowers", "€2,000", 2000],
      ],
      more: "And three more categories.",
      venues: "Your first venues",
      found: "Found",
      count: "venues seating 120 or more in Provence-Alpes-Côte d'Azur",
      list: [
        { ...VENUES.oliviers, area: "Luberon · from €9,800" },
        { ...VENUES.source, area: "Alpilles · from €11,300" },
        { ...VENUES.clair, area: "Var · from €8,400" },
      ],
    },
    matches: {
      title: "Your matches.",
      cats: ["Venues", "Caterers", "Photographers", "DJs"],
      cards: [
        { ...VENUES.oliviers, area: "Luberon", seats: "Seats 150", price: "€9,800" },
        { ...VENUES.source, area: "Alpilles", seats: "Seats 160", price: "€11,300" },
        { ...VENUES.clair, area: "Var", seats: "Seats 140", price: "€8,400" },
      ],
      budget: "Within budget",
      style: "Rustic chic",
      from: "From",
      selCount: "3 venues",
      selLabel: "Your shortlist",
      selCta: "Request quotes (3)",
    },
    quotes: {
      title: "Your quotes.",
      replies: "3 of 3 replied",
      request: "Your request",
      lines: [
        "Hi,",
        "We're getting married on Saturday, June 19, 2027 in Provence: 120 guests, a €35,000 budget, rustic chic.",
        "Is your venue available that day? Could you send us a quote?",
        "Alice and Ben",
      ],
      sent: "Sent to 3 venues",
      best: "Best price",
      free: "Available June 19",
      full: "Booked June 19",
      choose: "Pick this venue",
      see: "View quote",
      cards: [
        { ...VENUES.oliviers, area: "Luberon", price: "€9,800", free: true, best: true },
        { ...VENUES.source, area: "Alpilles", price: "€11,300", free: true },
        { ...VENUES.clair, area: "Var", price: "€8,400", free: false },
      ],
    },
    guests: {
      title: "Your guests.",
      couple: "Alice & Ben",
      when: "Saturday, June 19, 2027 · Provence",
      question: "Léa, will you join us?",
      yes: "Yes, with joy",
      no: "Sadly no",
      note: "Can't wait!",
      before: "86",
      after: "87",
      of: "yes out of 120 guests",
      latest: "Latest replies",
      rows: [
        ["lea", "Léa, Alice's maid of honor", "Yes, with joy", "Just now"],
        ["hugo", "Hugo, Ben's best man", "Yes", "2 h ago"],
        ["sophie", "Sophie", "Yes, vegetarian", "Yesterday"],
        ["parentsAlice", "Alice's parents", "Yes, both of us", "Yesterday"],
      ],
      photo: "Photo of Alice and Ben",
    },
    team: {
      title: "Together.",
      invite: "Invite",
      week: "This week",
      rows: [
        ["parentsBen", "Ben's parents", "added 14 guests to the list", "10 am"],
        ["lea", "Léa, Alice's maid of honor", "published the wedding website", "Yesterday"],
        ["parentsAlice", "Alice's parents", "paid their share: €3,000", "Yesterday"],
        ["hugo", "Hugo, Ben's best man", "checked off “Book the DJ”", "Monday"],
      ],
      site: "alice-and-ben",
      siteCap: "Wedding website",
      online: "Live",
      stats: [
        ["87", "yes"],
        ["€22,700", "committed"],
        ["7 months", "to the big day"],
      ],
      photo: "Alice and Ben's wedding website",
    },
  },
};

// Espaces insécables dans les montants et les pourcentages : « 5 000 € » ne se coupe jamais en bout de ligne
function insecable(node) {
  if (typeof node === "string") return node.replace(/(\d) (?=\d{3}\b|[€%])/g, "$1 ");
  if (Array.isArray(node)) return node.map(insecable);
  if (node && typeof node === "object") return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, insecable(v)]));
  return node;
}

export const CARROUSEL = insecable(TEXTES);

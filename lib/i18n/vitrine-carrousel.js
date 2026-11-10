/*
 * Textes du carrousel de l'accueil (components/vitrine/Carrousel.js), en français et en anglais : une seule source
 * pour l'ordinateur et le téléphone. Source du français : storyboard du lot 2, canvas « Merry · Carte brief », page
 * « 9 - Site vitrine » (planches Site-Blocs-*), validé par Stan le 10 nov. 2026. Données d'exemple (Alice et Ben).
 */

const VENUES = {
  oliviers: { img: "/vitrine/blocks/carrousel-2.webp", name: "Domaine des Oliviers" },
  source: { img: "/vitrine/blocks/carrousel-3.webp", name: "Mas de la Source" },
  clair: { img: "/vitrine/blocks/carrousel-1.webp", name: "Bastide Saint-Clair" },
};
export const COUPLE_PHOTO = "/vitrine/blocks/carrousel-6.webp";

const TEXTES = {
  fr: {
    tabsLabel: "Fonctionnalités de Merry",
    pause: "Mettre en pause",
    play: "Relancer",
    tabs: ["Prestataires", "Budget", "Invités", "Rétroplanning"],
    brief: ["Provence", "19 juin 2027", "120 invités", "35 000 €"],
    vendors: {
      title: "Prestataires.",
      cards: [
        { ...VENUES.oliviers, area: "Luberon", seats: "150 places assises", beds: "20 couchages", price: "9 800 €" },
        { ...VENUES.source, area: "Alpilles", seats: "160 places assises", beds: "16 couchages", price: "11 300 €" },
        { ...VENUES.clair, area: "Var", seats: "140 places assises", beds: "12 couchages", price: "8 400 €" },
      ],
      from: "À partir de",
      rent: "la location",
      selCount: "3 lieux",
      selLabel: "Ta sélection",
      selCta: "Demander les devis (3)",
    },
    request: {
      title: "Demande.",
      to: "Envoyée à",
      venues: [
        { ...VENUES.oliviers, area: "Luberon" },
        { ...VENUES.source, area: "Alpilles" },
        { ...VENUES.clair, area: "Var" },
      ],
      message: "Ton message",
      lines: [
        "Bonjour,",
        "Nous organisons notre mariage le samedi 19 juin 2027 en Provence, pour 120 invités, avec un budget de 35 000 € et une ambiance champêtre chic.",
        "Êtes-vous disponibles à cette date ? Pouvez-vous nous envoyer un devis ?",
        "Alice et Ben",
      ],
      send: "Envoyer la demande",
      sent: "Demande envoyée aux 3 lieux",
    },
    quotes: {
      title: "Devis.",
      replies: "3 réponses sur 3",
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
    budget: {
      title: "Budget.",
      stats: [
        ["35 000 €", "Budget"],
        ["22 700 €", "Engagé"],
        ["12 300 €", "Reste"],
      ],
      on: "sur",
      rows: [
        ["Lieu", "9 800 €", "10 500 €", 93],
        ["Traiteur", "8 500 €", "12 000 €", 71],
        ["Photographe", "2 400 €", "3 000 €", 80],
        ["Musique", "2 000 €", "2 500 €", 80],
        ["Tenues", "0 €", "3 500 €", 0],
        ["Fleurs", "0 €", "2 000 €", 0],
      ],
    },
    payers: {
      title: "Qui paie.",
      label: "Participations",
      // [avant, après] l'arrivée de la participation des parents de Ben
      total: ["31 000 €", "35 000 €"],
      rows: [
        { ini: "AB", name: "Alice et Ben", amount: "25 000 €", pct: ["81 %", "71 %"], w: [81, 71] },
        { ini: "PA", name: "Parents d'Alice", amount: "6 000 €", pct: ["19 %", "17 %"], w: [19, 17] },
        { ini: "PB", name: "Parents de Ben", amount: "4 000 €", pct: ["", "12 %"], w: [0, 12], arrives: true },
      ],
      add: "Ajouter une participation",
    },
    payments: {
      title: "Paiements.",
      rows: [
        ["Domaine des Oliviers", "Acompte", "3 000 €", "12 nov. 2026"],
        ["Les Capucines", "Traiteur · acompte", "2 500 €", "3 déc. 2026"],
        ["Studio Argile", "Photographe · acompte", "700 €", "10 nov. 2026"],
        ["Domaine des Oliviers", "Solde", "6 800 €", "19 mai 2027"],
      ],
      paid: "Payé",
      due: "À régler",
      // [avant, après] le paiement de l'acompte du photographe
      stats: [
        ["5 500 €", "6 200 €", "Payé"],
        ["17 200 €", "16 500 €", "Reste à régler"],
      ],
      pay: "Payer depuis Merry",
      soon: "Bientôt",
    },
    guests: {
      title: "Invités.",
      stats: [
        ["120", "120", "Invités"],
        ["86", "87", "Oui"],
        ["22", "21", "En attente"],
        ["12", "12", "Non"],
      ],
      rows: [
        ["C", "Camille Durand", "Famille d'Alice", "yes"],
        ["L", "Léa Martin", "Témoin d'Alice", "yes"],
        ["T", "Thomas Bernard", "Amis de Ben", "flip"],
        ["S", "Sarah Cohen", "Collègues d'Alice", "wait"],
        ["H", "Hugo Petit", "Famille de Ben", "no"],
      ],
      yes: "Oui",
      wait: "En attente",
      no: "Non",
    },
    form: {
      title: "Formulaire.",
      couple: "Alice & Ben",
      when: "Samedi 19 juin 2027 · Domaine des Oliviers",
      question: "Seras-tu des nôtres ?",
      yes: "Oui, avec joie",
      no: "Hélas non",
      diet: "Régime : végétarien",
      note: "Hâte de danser avec vous !",
      send: "Envoyer ma réponse",
      thanks: "Merci, c'est noté.",
      side: "Chez Alice et Ben",
      guest: "Léa Martin",
      guestRole: "Témoin d'Alice",
      answer: "Oui",
    },
    site: {
      title: "Site.",
      nav: ["Notre histoire", "Programme", "Répondre", "Infos pratiques", "Liste de mariage"],
      couple: "Alice & Ben",
      when: "Samedi 19 juin 2027 · Domaine des Oliviers, Luberon",
      fund: "Voyage de noces",
      before: "3 350 €",
      after: "3 450 €",
      of: "sur 5 000 €",
      gift: "Léa a participé · 100 €",
      madeWith: "Créé avec Merry",
      photo: "Photo d'Alice et Ben",
    },
    timeline: {
      title: "Rétroplanning.",
      done: "Fait",
      here: "Tu es ici",
      rows: [
        ["J-12 mois", "Choisir le lieu", "past"],
        ["J-9 mois", "Réserver le traiteur", "past"],
        ["J-6 mois", "Envoyer les faire-part", "now"],
        ["J-3 mois", "Essayages", ""],
        ["J-1 mois", "Plan de table", ""],
        ["Jour J", "Samedi 19 juin 2027", ""],
      ],
    },
    tasks: {
      title: "Tâches.",
      before: "1 sur 5 faites",
      after: "2 sur 5 faites",
      rows: [
        ["Commander les alliances", "Avant le 15 nov.", "A", "Alice", "done"],
        ["Envoyer les faire-part", "Avant le 19 déc.", "B", "Ben", "flip"],
        ["Réserver la voiture pour la sortie de mairie", "Avant le 1er mars", "S", "Sophie", ""],
        ["Réserver le DJ", "Avant le 1er mars", "B", "Ben", ""],
        ["Choisir les fleurs", "Avant le 1er avril", "S", "Sophie", ""],
      ],
    },
    docs: {
      title: "Documents.",
      folders: [
        ["Mairie", "3 documents", "4 documents"],
        ["Lieu", "Devis signé, facture"],
        ["Traiteur", "Devis signé"],
        ["Photographe", "Contrat"],
      ],
      files: [
        ["Pièce d'identité d'Alice.pdf", "Ajouté par Alice · 2 nov."],
        ["Pièce d'identité de Ben.pdf", "Ajouté par Ben · 2 nov."],
        ["Acte de naissance d'Alice.pdf", "Ajouté par Sophie · 6 nov."],
        ["Justificatif de domicile.pdf", "Ajouté par Ben · aujourd'hui"],
      ],
      drop: "Glisse un fichier ici",
    },
  },
  en: {
    tabsLabel: "What Merry does",
    pause: "Pause",
    play: "Play",
    tabs: ["Vendors", "Budget", "Guests", "Timeline"],
    brief: ["Provence", "June 19, 2027", "120 guests", "€35,000"],
    vendors: {
      title: "Vendors.",
      cards: [
        { ...VENUES.oliviers, area: "Luberon", seats: "Seats 150", beds: "Sleeps 20", price: "€9,800" },
        { ...VENUES.source, area: "Alpilles", seats: "Seats 160", beds: "Sleeps 16", price: "€11,300" },
        { ...VENUES.clair, area: "Var", seats: "Seats 140", beds: "Sleeps 12", price: "€8,400" },
      ],
      from: "From",
      rent: "venue rental",
      selCount: "3 venues",
      selLabel: "Your shortlist",
      selCta: "Request quotes (3)",
    },
    request: {
      title: "Request.",
      to: "Sent to",
      venues: [
        { ...VENUES.oliviers, area: "Luberon" },
        { ...VENUES.source, area: "Alpilles" },
        { ...VENUES.clair, area: "Var" },
      ],
      message: "Your message",
      lines: [
        "Hi,",
        "We're getting married on Saturday, June 19, 2027 in Provence: 120 guests, a €35,000 budget, rustic chic.",
        "Is your venue available that day? Could you send us a quote?",
        "Alice and Ben",
      ],
      send: "Send request",
      sent: "Request sent to 3 venues",
    },
    quotes: {
      title: "Quotes.",
      replies: "3 of 3 replied",
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
    budget: {
      title: "Budget.",
      stats: [
        ["€35,000", "Budget"],
        ["€22,700", "Committed"],
        ["€12,300", "Left"],
      ],
      on: "of",
      rows: [
        ["Venue", "€9,800", "€10,500", 93],
        ["Catering", "€8,500", "€12,000", 71],
        ["Photographer", "€2,400", "€3,000", 80],
        ["Music", "€2,000", "€2,500", 80],
        ["Outfits", "€0", "€3,500", 0],
        ["Flowers", "€0", "€2,000", 0],
      ],
    },
    payers: {
      title: "Who's paying.",
      label: "Contributions",
      total: ["€31,000", "€35,000"],
      rows: [
        { ini: "AB", name: "Alice and Ben", amount: "€25,000", pct: ["81%", "71%"], w: [81, 71] },
        { ini: "PA", name: "Alice's parents", amount: "€6,000", pct: ["19%", "17%"], w: [19, 17] },
        { ini: "PB", name: "Ben's parents", amount: "€4,000", pct: ["", "12%"], w: [0, 12], arrives: true },
      ],
      add: "Add a contribution",
    },
    payments: {
      title: "Payments.",
      rows: [
        ["Domaine des Oliviers", "Deposit", "€3,000", "Nov 12, 2026"],
        ["Les Capucines", "Catering · deposit", "€2,500", "Dec 3, 2026"],
        ["Studio Argile", "Photographer · deposit", "€700", "Nov 10, 2026"],
        ["Domaine des Oliviers", "Balance", "€6,800", "May 19, 2027"],
      ],
      paid: "Paid",
      due: "Due",
      stats: [
        ["€5,500", "€6,200", "Paid"],
        ["€17,200", "€16,500", "Still due"],
      ],
      pay: "Pay through Merry",
      soon: "Coming soon",
    },
    guests: {
      title: "Guests.",
      stats: [
        ["120", "120", "Guests"],
        ["86", "87", "Yes"],
        ["22", "21", "Waiting"],
        ["12", "12", "No"],
      ],
      rows: [
        ["C", "Camille Durand", "Alice's family", "yes"],
        ["L", "Léa Martin", "Alice's maid of honor", "yes"],
        ["T", "Thomas Bernard", "Ben's friends", "flip"],
        ["S", "Sarah Cohen", "Alice's coworkers", "wait"],
        ["H", "Hugo Petit", "Ben's family", "no"],
      ],
      yes: "Yes",
      wait: "Waiting",
      no: "No",
    },
    form: {
      title: "RSVP.",
      couple: "Alice & Ben",
      when: "Saturday, June 19, 2027 · Domaine des Oliviers",
      question: "Will you join us?",
      yes: "Yes, gladly",
      no: "Sadly, no",
      diet: "Diet: vegetarian",
      note: "Can't wait to dance with you!",
      send: "Send my RSVP",
      thanks: "Thanks, you're all set.",
      side: "On Alice and Ben's side",
      guest: "Léa Martin",
      guestRole: "Alice's maid of honor",
      answer: "Yes",
    },
    site: {
      title: "Website.",
      nav: ["Our story", "Schedule", "RSVP", "Travel & stay", "Registry"],
      couple: "Alice & Ben",
      when: "Saturday, June 19, 2027 · Domaine des Oliviers, Luberon",
      fund: "Honeymoon fund",
      before: "€3,350",
      after: "€3,450",
      of: "of €5,000",
      gift: "Léa chipped in · €100",
      madeWith: "Made with Merry",
      photo: "Photo of Alice and Ben",
    },
    timeline: {
      title: "Timeline.",
      done: "Done",
      here: "You are here",
      rows: [
        ["12 months out", "Pick the venue", "past"],
        ["9 months out", "Book the caterer", "past"],
        ["6 months out", "Send the invitations", "now"],
        ["3 months out", "Dress fittings", ""],
        ["1 month out", "Seating chart", ""],
        ["The big day", "Saturday, June 19, 2027", ""],
      ],
    },
    tasks: {
      title: "Tasks.",
      before: "1 of 5 done",
      after: "2 of 5 done",
      rows: [
        ["Order the rings", "By Nov 15", "A", "Alice", "done"],
        ["Send the invitations", "By Dec 19", "B", "Ben", "flip"],
        ["Book the getaway car", "By Mar 1", "S", "Sophie", ""],
        ["Book the DJ", "By Mar 1", "B", "Ben", ""],
        ["Choose the flowers", "By Apr 1", "S", "Sophie", ""],
      ],
    },
    docs: {
      title: "Documents.",
      folders: [
        ["Paperwork", "3 files", "4 files"],
        ["Venue", "Signed quote, invoice"],
        ["Catering", "Signed quote"],
        ["Photographer", "Contract"],
      ],
      files: [
        ["Alice's ID.pdf", "Added by Alice · Nov 2"],
        ["Ben's ID.pdf", "Added by Ben · Nov 2"],
        ["Alice's birth certificate.pdf", "Added by Sophie · Nov 6"],
        ["Proof of address.pdf", "Added by Ben · today"],
      ],
      drop: "Drop a file here",
    },
  },
};

// Espaces insécables dans les montants et les pourcentages : « 5 000 € » ne se coupe jamais en bout de ligne
function insecable(node) {
  if (typeof node === "string") return node.replace(/(\d) (?=\d{3}\b|[€%])/g, "$1\u00a0");
  if (Array.isArray(node)) return node.map(insecable);
  if (node && typeof node === "object") return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, insecable(v)]));
  return node;
}

export const CARROUSEL = insecable(TEXTES);

// Espace prestataire : données d'exemple (?demo=1), celles des maquettes « Espace prestataire » du canvas.
// Les dates des demandes et des actions suivent le jour où l'on ouvre la démo.

import { addDays, isoDate, today } from "@/lib/dash/format";

const VENDOR_ID = "00000000-0000-4000-8000-0000000000d0";
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export function buildProDemo() {
  const now = Date.now();
  const ago = (hours) => new Date(now - hours * 3600000).toISOString();
  const day = (n) => isoDate(addDays(today(), n));

  const clients = [
    { id: id(101), names: "Alice & Ben", wedding_date: "2027-06-14", guests: 120, budget_label: "30 000 à 50 000 €", source: "merry", stage: "nouvelle", next_action: "Répondre", next_action_on: day(0), email: "alice.b@exemple.fr", phone: "06 12 34 56 21", created_at: ago(2) },
    { id: id(102), names: "Léa & Karim", wedding_date: "2027-09-18", guests: 90, budget_label: "20 000 à 30 000 €", source: "merry", stage: "nouvelle", next_action: "Répondre", next_action_on: day(0), created_at: ago(5) },
    { id: id(103), names: "Inès & Thomas", wedding_date: "2027-06-05", guests: 150, budget_label: "40 000 à 60 000 €", source: "merry", stage: "nouvelle", next_action: "Répondre", next_action_on: day(1), created_at: ago(26) },
    { id: id(104), names: "Camille & Jules", wedding_date: "2027-07-03", guests: 140, budget_label: "35 000 à 45 000 €", source: "merry", stage: "devis", next_action: "Relancer pour le devis", next_action_on: day(0), notes: "Hésitent avec un lieu dans les Alpilles. Tiennent à la cérémonie en extérieur.", email: "camille.j@exemple.fr", phone: "06 21 43 65 18", answered_at: ago(24 * 14), created_at: ago(24 * 16) },
    { id: id(105), names: "Julie & Paul", wedding_date: "2027-09-11", guests: 80, source: "hors_merry", stage: "devis", next_action: "Relancer", next_action_on: day(4), created_at: ago(24 * 20) },
    { id: id(106), names: "Chloé & Maxime", wedding_date: "2027-05-22", guests: 110, source: "merry", stage: "visite", next_action: "Visite", next_action_on: day(5), created_at: ago(24 * 22) },
    { id: id(107), names: "Sophie & Antoine", wedding_date: "2027-05-29", guests: 130, source: "merry", stage: "reserve", next_action: "Envoyer le contrat", next_action_on: day(7), created_at: ago(24 * 60) },
    { id: id(108), names: "Margue & Stanislas", wedding_date: "2027-06-12", guests: 162, budget_label: "30 000 à 50 000 €", source: "merry", stage: "reserve", next_action: "Rappel d’acompte", next_action_on: day(0), notes: "Acompte attendu avant le 1er novembre.", created_at: ago(24 * 10) },
    { id: id(109), names: "Clara & Mehdi", wedding_date: "2027-07-10", guests: 100, source: "hors_merry", stage: "reserve", next_action: "Appel de calage", next_action_on: day(15), created_at: ago(24 * 90) },
    { id: id(110), names: "Emma & Lucas", wedding_date: "2027-09-04", guests: 70, source: "merry", stage: "perdu", lost_reason: "A choisi un autre lieu", created_at: ago(24 * 40) },
  ].map((c) => ({ vendor_id: VENDOR_ID, notes: null, email: null, phone: null, budget_label: null, lost_reason: null, answered_at: null, date_label: null, updated_at: c.created_at, ...c }));

  const requestOf = (cid, extra) => ({ client_id: cid, pick_id: null, ...extra });
  const requests = [
    requestOf(id(101), {
      names: "Alice & Ben",
      requested_at: ago(2),
      wedding_date: "2027-06-14",
      dates: ["14 juin 2027", "19 juin 2027", "26 juin 2027"],
      guests: "100-150",
      guestsCount: 120,
      budget: "30-50k",
      region: "Provence",
      vibes: ["Champêtre", "Chic"],
      message:
        "Bonjour, nous nous marions le 14 juin 2027 en Provence et nous attendons environ 120 invités. Pourriez-vous nous envoyer un devis et nous confirmer que vous êtes disponible à cette date ? Nous aimerions aussi savoir jusqu’à quelle heure la musique est autorisée. Merci beaucoup, Alice et Ben",
      answered: false,
    }),
    requestOf(id(102), { names: "Léa & Karim", requested_at: ago(5), wedding_date: "2027-09-18", dates: ["18 septembre 2027"], guests: "50-100", guestsCount: 90, budget: "15-30k", budgetLabel: "20 000 à 30 000 €", region: "Luberon", vibes: ["Bohème"], message: "Bonjour, le 18 septembre 2027 est-il libre ? Nous serions environ 90. Merci, Léa et Karim", answered: false }),
    requestOf(id(103), { names: "Inès & Thomas", requested_at: ago(26), wedding_date: "2027-06-05", dates: ["5 juin 2027"], guests: "150-200", guestsCount: 150, budget: "30-50k", budgetLabel: "40 000 à 60 000 €", region: "Vaucluse", vibes: ["Grande fête"], message: "Bonjour, nous cherchons un domaine pour 150 invités le 5 juin 2027, avec des couchages pour nos familles. Merci, Inès et Thomas", answered: false }),
    requestOf(id(104), { names: "Camille & Jules", requested_at: ago(24 * 14), wedding_date: "2027-07-03", dates: ["3 juillet 2027"], guests: "100-150", guestsCount: 140, budget: "30-50k", budgetLabel: "35 000 à 45 000 €", region: "Provence", vibes: ["Chic"], message: "Bonjour, le 3 juillet est-il encore libre ? Nous serions environ 140.", answered: true }),
    requestOf(id(108), { names: "Margue & Stanislas", requested_at: ago(24 * 10), wedding_date: "2027-06-12", dates: ["12 juin 2027"], guests: "150-200", guestsCount: 162, budget: "30-50k", region: "Provence", vibes: ["Champêtre"], message: "Bonjour, nous aimerions réserver le domaine le 12 juin 2027 pour 162 invités.", answered: true }),
  ];

  const threads = {
    [id(104)]: [
      { id: id(201), from_vendor: false, body: "Bonjour, le 3 juillet est-il encore libre ? Nous serions environ 140.", sent_at: ago(24 * 16) },
      { id: id(202), from_vendor: true, body: "Bonjour Camille, oui, la date est libre. Je vous envoie le devis de la formule week-end.", sent_at: ago(24 * 14) },
      { id: id(203), from_vendor: false, body: "Merci ! Nous revenons vers vous après en avoir parlé avec nos parents.", sent_at: ago(24 * 13) },
    ],
  };

  return {
    vendor: {
      id: VENDOR_ID,
      name: "Domaine des Oliviers",
      primary_category: "lieu",
      category_label: "Lieu de réception",
      address: "Chemin des Oliviers",
      postal_code: "84160",
      city: "Lourmarin",
      department: "84",
      region: "Provence-Alpes-Côte d'Azur",
      area: "Luberon",
      email: "contact@domainedesoliviers.fr",
      phone: "06 11 22 33 42",
      website: "domainedesoliviers.fr",
      description:
        "Un domaine du XVIIIe siècle au cœur du Luberon, entouré de deux hectares d’oliviers. Les dîners se font à une seule grande tablée sous les arbres, la cérémonie dans le jardin, et vos proches dorment sur place dans les 32 couchages du domaine.",
      style_tags: ["Champêtre", "Chic"],
      capacity_seated: 140,
      capacity_standing: 200,
      beds: 32,
      details: { outdoor_ceremony: true, caterer_imposed: false, caterer_mode: "libre", music_end: "2 h", parking: true, accessible: true, video_url: "" },
      airport_name: "Marseille Provence",
      airport_minutes: 35,
      station_name: "Avignon TGV",
      station_minutes: 40,
      price_min: 9800,
      price_unit: "location",
      google_rating: 4.8,
      google_review_count: 37,
      lat: 43.7642,
      lng: 5.3631,
    },
    photos: [{ path: "demo/1.jpg", url: "/prestataires/domaine-des-oliviers.jpg" }, { path: "demo/2.jpg", url: "/prestataires/mas-de-la-source.jpg" }, { path: "demo/3.jpg", url: "/prestataires/bastide-saint-clair.jpg" }],
    pro: { vendor_id: VENDOR_ID, plan: "confort", billing: "mensuel", renews_on: isoDate(addDays(today(), 6)), credits: 12, high_from: "1 mai", high_to: "30 septembre", low_from: "1 octobre", low_to: "30 avril", ical_token: "demo" },
    formulas: [
      { id: id(301), name: "Formule week-end", unit: "forfait", includes: ["Le domaine du samedi 10 h au dimanche 12 h", "Tables, chaises et vaisselle pour 140 invités", "Les 32 couchages pour vos proches"], price_high: 11800, price_low: 9800, position: 0 },
      { id: id(302), name: "Formule journée", unit: "forfait", includes: ["Le domaine de 10 h à 2 h du matin", "Tables, chaises et vaisselle pour 140 invités", "Un régisseur présent toute la soirée"], price_high: 8500, price_low: 7200, position: 1 },
      { id: id(303), name: "Formule cocktail", unit: "par_invite", includes: ["Le jardin et la terrasse de 16 h à minuit", "Mange-debout, bar et éclairage", "Jusqu’à 200 invités debout"], price_high: 45, price_low: 38, position: 2 },
    ],
    options: [
      { id: id(311), name: "Nuit supplémentaire", unit: "nuit", price: 1200, position: 0 },
      { id: id(312), name: "Brunch du dimanche", unit: "par_invite", price: 28, position: 1 },
      { id: id(313), name: "Prolongation après 2 h", unit: "par_heure", price: 250, position: 2 },
    ],
    dates: [
      { id: id(401), day: "2027-06-05", status: "option", client_id: id(103), label: null, expires_on: isoDate(addDays(today(), 14)) },
      { id: id(402), day: "2027-06-12", status: "reserve", client_id: id(108), label: null, expires_on: null },
      { id: id(403), day: "2027-06-19", status: "option", client_id: id(101), label: null, expires_on: isoDate(addDays(today(), 7)) },
      { id: id(404), day: "2027-07-03", status: "option", client_id: id(104), label: null, expires_on: isoDate(addDays(today(), 21)) },
      { id: id(405), day: "2027-05-29", status: "reserve", client_id: id(107), label: null, expires_on: null },
      { id: id(406), day: "2027-07-10", status: "reserve", client_id: id(109), label: null, expires_on: null },
    ],
    clients,
    requests,
    threads,
    documents: [{ id: id(501), client_id: id(104), name: "Devis formule week-end", storage_path: "demo/devis.pdf", bytes: 120000, created_at: ago(24 * 14) }],
    ledger: [
      { id: id(601), at: ago(24 * 6), kind: "remboursement", label: "Remboursement", delta: 2, balance: 12 },
      { id: id(602), at: ago(24 * 12), kind: "achat", label: "Achat de crédits", delta: 10, balance: 10 },
      { id: id(603), at: ago(24 * 18), kind: "utilisation", label: "Utilisation", delta: -5, balance: 0 },
      { id: id(604), at: ago(24 * 25), kind: "abonnement", label: "Abonnement", delta: 5, balance: 5 },
    ],
    offer: { plans: [{ key: "essentiel", name: "Essentiel", monthly: null, yearly: null, credits: null }, { key: "confort", name: "Confort", monthly: null, yearly: null, credits: null }, { key: "pro", name: "Pro", monthly: null, yearly: null, credits: null }], packs: [{ credits: null, price: null }, { credits: null, price: null }, { credits: null, price: null }], unlock_cost: 5, explainer: null, payments_on: false },
    feedback: [
      { id: id(701), body: "Envoyer un rappel d’acompte automatique", status: "prevue", created_at: ago(24 * 42) },
      { id: id(702), body: "Synchroniser mes dates avec Google Agenda", status: "disponible", created_at: ago(24 * 54) },
      { id: id(703), body: "Voir sur quels mots les couples me trouvent", status: "recue", created_at: ago(24 * 57) },
    ],
    stats: { views: 214, picks: 18, requests: 6 },
    projects: [
      { wedding_id: id(801), unlocked: false, names: null, area: "Luberon", wedding_date: "2027-06-26", date_unknown: false, guests: "100-150", guestsCount: 110, budget: "15-30k", budgetLabel: "25 000 à 35 000 €", km: 12, vibes: ["Champêtre", "Intime"], note: "Nous cherchons un lieu avec des chambres pour nos familles et un grand jardin pour le dîner." },
      { wedding_id: id(802), unlocked: true, names: "Nina & Hugo", area: "Luberon", wedding_date: "2027-09-11", date_unknown: false, guests: "100-150", guestsCount: 130, budget: "30-50k", budgetLabel: "30 000 à 40 000 €", km: 8, vibes: ["Champêtre", "Grande fête"], format: "weekend", note: "Bonjour, nous cherchons un domaine où réunir 130 personnes pour un week-end de septembre, avec une cérémonie dehors et une soirée qui dure. Nous aimerions loger nos familles sur place.", brief: ["Un week-end, du samedi au dimanche", "Cérémonie laïque en extérieur", "Traiteur au choix", "Une vingtaine de proches à loger sur place"] },
      { wedding_id: id(803), unlocked: false, names: null, area: "Pays d’Aix", wedding_date: null, dateLabel: "Mai 2027", guests: "150-200", guestsCount: 160, budget: ">50k", budgetLabel: "40 000 à 60 000 €", km: 28, vibes: ["Chic", "Grande fête"], note: "Nous voulons une belle salle en cas de pluie et une piste de danse qui ferme tard." },
      { wedding_id: id(804), unlocked: false, names: null, area: "Alpilles", wedding_date: null, dateLabel: "Septembre 2027", guests: "50-100", guestsCount: 90, budget: "15-30k", budgetLabel: "20 000 à 30 000 €", km: 24, vibes: ["Bohème"], note: "Un lieu simple et lumineux, avec des oliviers si possible, pour un déjeuner qui se prolonge." },
      { wedding_id: id(805), unlocked: false, names: null, area: "Vaucluse", wedding_date: null, dateLabel: "Juillet 2027", guests: "100-150", guestsCount: 140, budget: "30-50k", budgetLabel: "35 000 à 45 000 €", km: 19, vibes: ["Chic"], note: "Nous aimerions une cérémonie au coucher du soleil et un dîner à grande tablée." },
    ],
    user: { email: "contact@domainedesoliviers.fr" },
    setup: true,
  };
}

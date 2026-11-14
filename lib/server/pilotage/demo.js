// Jeu de données d'exemple pour la page de pilotage : sans Supabase en local (ou avec ?demo=1), la page se
// dessine avec ces chiffres plutôt que de rester vide. Rien ici n'est une vraie mesure.

import { summarizeCouts } from "@/lib/server/pilotage/couts";
import { parisDay, summarizeReseau } from "@/lib/server/pilotage/reseau";
import { heureList } from "@/lib/server/pilotage/shape";

function jours(n) {
  const out = [];
  const now = Date.now();
  for (let i = n - 1; i >= 0; i--) out.push(new Date(now - i * 86400 * 1000).toISOString().slice(0, 10));
  return out;
}

// Suite pseudo-aléatoire stable, pour que la démo soit la même à chaque chargement
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// Liste d'actions d'exemple, pour relire Aujourd'hui et Tâches sans la table
export function demoItems() {
  const jour = (n) => parisDay(Date.now() + n * 86400 * 1000);
  const base = { statut: "a_faire", priorite: 0, recurrence: "", detail: "", contenu: "", lien: "", projet: "", cle: "", cree_le: "2026-11-06T08:00:00Z" };
  return [
    { ...base, id: "demo-1", type: "campagne", titre: "Relire le mail n° 2, liste d'invités", detail: "Part samedi, 8 h", echeance: jour(0), lien: "/pilotage/acquisition/campagnes" },
    { ...base, id: "demo-2", type: "decision", titre: "Calibrer le montant de la levée", detail: "Bloque les messages aux angels", echeance: jour(0), priorite: 1 },
    { ...base, id: "demo-3", type: "tache", titre: "Valider l'échantillon des textes 1001salles", echeance: jour(-1) },
    { ...base, id: "demo-4", type: "tache", titre: "Préparer le rendez-vous avec Astrid", echeance: jour(1) },
    { ...base, id: "demo-5", type: "tache", titre: "Relire les chiffres de la semaine", echeance: jour(3), recurrence: "hebdo" },
    { ...base, id: "demo-6", type: "tache", titre: "Renouveler l'assurance", projet: "Perso", echeance: jour(12) },
    { ...base, id: "demo-7", type: "tache", titre: "Idée : carte cadeau pour les témoins", echeance: null },
    { ...base, id: "demo-b1", type: "tache", projet: "Bugs", titre: "Bug à arbitrer : inscription par invitation sur iPhone, bouton sans effet", detail: "Le 8 nov. vers 19 h 18 (heure de Paris), sur /connexion en mode inscription avec lien d'invitation, Mobile Safari : clic sur le bouton d'envoi relevé en clic mort par PostHog ; aucune requête d'inscription ni de connexion dans les journaux Supabase Auth. Hypothèse non vérifiée : la validation native du navigateur bloque l'envoi sans message de Merry.", echeance: jour(0) },
    { ...base, id: "demo-b2", type: "tache", projet: "Bugs", titre: "Bug à arbitrer : pilotage_stats coupé par le délai de la base (11 erreurs 500 en 24 h)", detail: "11 appels POST rpc/pilotage_stats en 500, tous « canceling statement due to statement timeout ».", echeance: jour(0) },
    { ...base, id: "demo-8", type: "mot", titre: "Mot du matin", detail: "Deux réponses t'attendent et le mail n° 2 attend ta relecture. Rien ne casse en production.", echeance: jour(0) },
    { ...base, id: "demo-9", type: "lecture", titre: "Honeyfund : le voyage de noces en cadeaux, sans frais pour les invités", detail: "Les invités financent une étape du voyage plutôt qu'un objet, et Honeyfund se paie sur le paiement par carte.", contenu: "**CE QUE C'EST**\n**Les couples transforment leur voyage de noces en liste de cadeaux.**\nÉdition d'exemple pour la démo.\n\n**COMMENT ÇA MARCHE**\n1. Le couple liste les nuits et les excursions.\n2. Les invités en choisissent une et paient.\n\n**SOURCES**\n[Honeyfund](https://www.honeyfund.com)", projet: "Feature of the Day", cle: `feature:${jour(0)}:fr`, echeance: jour(0) },
    { ...base, id: "demo-9-en", type: "lecture", titre: "Honeyfund: the honeymoon as a gift list, with no fees for guests", detail: "Guests fund a leg of the trip rather than an object, and Honeyfund earns on card payments.", contenu: "**WHAT IT IS**\n**Couples turn their honeymoon into a giftable registry.**\nExample edition for the demo.\n\n**HOW IT WORKS**\n1. The couple lists nights and excursions.\n2. Guests choose one and pay.\n\n**SOURCES**\n[Honeyfund](https://www.honeyfund.com)", projet: "Feature of the Day", cle: `feature:${jour(0)}:en`, echeance: jour(0) },
    { ...base, id: "demo-10", type: "lecture", titre: "Paathz se lance, Tripadvisor taille dans ses équipes", detail: "Trois levées dans le voyage de groupe cette semaine, aucune dans le mariage.", projet: "News of the Day", cle: `news:${jour(0)}:fr`, echeance: jour(0) },
    { ...base, id: "demo-10-en", type: "lecture", titre: "Paathz launches, Tripadvisor cuts staff", detail: "Three raises in group travel this week, none in weddings.", projet: "News of the Day", cle: `news:${jour(0)}:en`, echeance: jour(0) },
  ];
}

export function demoAgenda() {
  return {
    disponible: true,
    meetings: [
      { id: "demo-m1", heure: "11 h", personnes: "Baptiste, Lucas Berger" },
      { id: "demo-m2", heure: "16 h 30", personnes: "Margaux" },
    ],
  };
}

function demoCouts() {
  const d = (back) => new Date(Date.now() - back * 86400 * 1000).toISOString().slice(0, 10);
  const rows = [
    ["Vercel", "Pro, abonnement du mois", "tech", 20, 2],
    ["Supabase", "Pro, abonnement du mois", "tech", 25, 3],
    ["Google Cloud", "Places API, campagne photos (exemple)", "acquisition", 31.4, 4],
    ["Claude", "Abonnement du mois", "tech", 90, 6],
    ["Greffe", "Dépôt de marque (exemple)", "juridique", 190, 12],
    ["Vercel", "Pro, abonnement du mois", "tech", 20, 33],
  ].map(([fournisseur, libelle, categorie, montant_eur, back], i) => ({ id: `demo-${i}`, jour: d(back), fournisseur, libelle, categorie, montant_eur, cree_le: d(back) }));
  return summarizeCouts(rows);
}

function demoUtilisateurs() {
  const ago = (min) => new Date(Date.now() - min * 60000).toISOString();
  const compte = (email, connexion, accent = null, couple = true) => ({ id: email, email, couple, accent, derniere_connexion: connexion === null ? null : ago(connexion), derniere_visite: connexion === null ? null : ago(connexion) });
  const replay = (email, min, actif_s, clics, erreurs = 0) => ({ session: `demo-${email}`, debut: ago(min + 10), fin: ago(min), actif_s, clics, erreurs, compte: email, email });
  // Un cas de chaque pastille : replay récent, replay avec erreurs, ancien replay, sessions sans replay, sans cookies, test
  const m = (couple, comptes, { date = null, posthog = "ok", replay: r = null, sessions = 0, invites = 0, site = null, formulaire = null, reponses = 0, taches = 0, budget = 0, budgetTouche = false, equipe = 0, devis = 0, cree = 20000, test = false } = {}) => ({
    id: comptes[0].email,
    couple,
    test,
    comptes,
    emails: comptes.map((c) => c.email),
    cree: ago(cree),
    date,
    lieu: null,
    derniere_connexion: comptes[0].derniere_connexion,
    derniere_visite: comptes[0].derniere_visite,
    visite_par: comptes[0].derniere_visite ? comptes[0].email : null,
    posthog,
    replay: r,
    sessions_7j: sessions,
    invites,
    dernier_invite: invites ? ago(300) : null,
    site,
    site_slug: site ? "exemple" : null,
    formulaire,
    formulaire_slug: formulaire ? "exemple" : null,
    reponses_formulaire: reponses,
    taches,
    taches_faites: Math.round(taches * 0.3),
    budget,
    budget_touche: budgetTouche,
    equipe,
    devis,
  });
  const mariages = [
    m("Emma et Lucas", [compte("emma@exemple.fr", 12, "pistache"), compte("lucas.martin@exemple.fr", 2000, "anis")], { date: "2027-06-12", replay: replay("emma@exemple.fr", 12, 340, 52), sessions: 9, invites: 130, site: "publié", formulaire: "publié", reponses: 14, taches: 40, budget: 12, budgetTouche: true, equipe: 2, devis: 3 }),
    m("Théo et Clem", [compte("theo@exemple.fr", 300), compte("clem@exemple.fr", 900, "beurre"), compte("parent@exemple.fr", 3000, null, false)], { date: "2027-09-11", posthog: "sans_replay", sessions: 8, invites: 607, formulaire: "publié", taches: 30, budget: 4, budgetTouche: true, equipe: 3 }),
    m("Côme et Astrid", [compte("come@exemple.fr", 1500, "citron")], { date: "2027-05-29", replay: replay("come@exemple.fr", 1500, 1260, 140, 6), sessions: 3, invites: 139, formulaire: "publié", reponses: 12, taches: 18, budget: 9 }),
    m("Florence", [compte("florence@exemple.fr", 15000)], { posthog: "ancien", replay: replay("florence@exemple.fr", 22000, 95, 23), sessions: 0, invites: 12, site: "brouillon", taches: 25, devis: 1 }),
    m("Yvasne et Henri", [compte("yvasne@exemple.fr", 50000)], { date: "2027-06-05", posthog: "jamais", cree: 50010 }),
    // Couples à regarder dans Couples › Funnel : mariage passé, jamais revenu, doublon
    m("Joséphine et Aristide", [compte("josephine@exemple.fr", 30000)], { date: "2026-09-05", posthog: "jamais", cree: 30010 }),
    m("Marie et Florian", [compte("marie.f@exemple.fr", 20000)], { posthog: "jamais", invites: 2, site: "publié", formulaire: "publié", cree: 20010 }),
    m("Florian et Marie", [compte("florian@exemple.fr", 9000)], { posthog: "jamais", invites: 2, formulaire: "publié", cree: 9010 }),
    // Couple de test : en bas malgré une visite récente
    m("Thomas et Thomas2", [compte("test.mariage@exemple.fr", 5)], { posthog: "jamais", invites: 3, test: true }),
  ];
  const sourceDe = { "emma@exemple.fr": "meta-a", "theo@exemple.fr": "seo" };
  const utilisateurs = mariages.map((x) => ({ id: x.id, email: x.emails[0], cree: x.cree, derniere_connexion: x.derniere_connexion, source: sourceDe[x.emails[0]] || "Sans source", couple: x.couple, invites: x.invites, site: x.site, devis: x.devis }));
  return {
    fenetre_ms: 86400000,
    genere: new Date().toISOString(),
    totaux: { comptes: 9, mariages: 6, avec_site: 2, avec_site_publie: 1, avec_invites: 4, avec_formulaire: 3, avec_devis: 2 },
    fenetre: { connectes: { n: 2, prec: 1 }, couples_connectes: { n: 2, prec: 1 }, comptes_crees: { n: 0, prec: 1 }, mariages_crees: { n: 0, prec: 1 }, sites_crees: { n: 0, prec: 0 }, invites_ajoutes: { n: 12, prec: 4 }, devis: { n: 1, prec: 0 } },
    sources: [{ label: "meta-a", n: 1, total: 1, sub: "1 au total" }, { label: "seo", n: 0, total: 1, sub: "1 au total" }, { label: "Sans source", n: 0, total: 1, sub: "1 au total" }],
    utilisateurs,
    mariages,
  };
}

function demoReseau() {
  const now = Date.now();
  const today = parisDay(now);
  const c = (id, nom, entreprise, piste, statut, prochaine_action, date_action, notes = "") => ({ id, nom, entreprise, role: "", piste, statut, canal: "linkedin", email: "", linkedin: "https://www.linkedin.com/", dernier_contact: null, prochaine_action, date_action, notes });
  return summarizeReseau(
    [
      c("1", "Camille Exemple", "Lieux de France", "marketplace", "contacte", "Relance J+7", today),
      c("2", "Alex Exemple", "Salles & Co", "marketplace", "a_contacter", "Premier message", today, "Intro possible par un planner"),
      c("3", "Sacha Exemple", "Studio Expérience", "experientiel", "a_valider", "", null, "Lance des lieux éphémères"),
      c("4", "Noa Exemple", "Liste & Cie", "mille_merci", "conversation", "Fixer un rendez-vous", null),
    ],
    [{ id: "e1", contact_id: "1", jour: today, sens: "sortant", canal: "linkedin", resume: "Premier message", cree_le: new Date(now).toISOString() }],
    now,
    [
      { id: "p1", jour: today, creneau: "repondre", ordre: 1, contact_id: "4", titre: "", raison: "A répondu hier, propose un échange", dernier_message: "Avec plaisir, dites-moi quand vous êtes disponible.", message: "Bonjour Noa, merci pour votre retour. Seriez-vous disponible jeudi matin pour 20 minutes ?", lien_envoi: "https://mail.google.com/mail/u/0/#drafts", statut: "a_faire" },
      { id: "p2", jour: today, creneau: "ecrire", ordre: 1, contact_id: "2", titre: "", raison: "Gère 3 000 lieux, intro possible par un planner", dernier_message: "", message: "Bonjour Alex, je construis Merry, qui aide les couples à organiser leur mariage. Votre avis sur le référencement des lieux m'intéresse : auriez-vous 20 minutes ?", lien_envoi: "https://www.linkedin.com/", statut: "a_faire" },
      { id: "p3", jour: today, creneau: "ecrire", ordre: 2, contact_id: "1", titre: "", raison: "Relance J+7", dernier_message: "", message: "Bonjour Camille, je me permets de revenir vers vous.", lien_envoi: "https://www.linkedin.com/", statut: "fait" },
      { id: "p4", jour: today, creneau: "consolider", ordre: 1, contact_id: null, titre: "Préparer le rendez-vous de demain", raison: "Note prête dans les brouillons", dernier_message: "", message: "", lien_envoi: "", statut: "a_faire" },
    ],
  );
}

function demoCampagnes(list) {
  const jour = list[list.length - 1];
  return {
    disponible: true,
    periode: { envoyes: 25, delivres: 24, echecs: 1, desinscrits: 1 },
    precedente: { envoyes: 0, delivres: 0, echecs: 0, desinscrits: 0 },
    par_jour: [[jour, 25]],
    problemes: [{ quand: new Date().toISOString(), numero: 1, a: "mauvaise-adresse@exemple.fr", etat: "Rebond", detail: "Permanent" }],
    numeros: [
      { numero: 2, campagne: "samedi-2", titre: "Dépose ton fichier. Ta liste est prête.", samedi: "2026-11-14", statut: "À envoyer", prevus: 0, envoyes: 0, delivres: 0, echecs: 0, desinscrits: null },
      { numero: 1, campagne: "samedi-1", titre: "Combien ça nous coûte. Et qui paie quoi.", samedi: "2026-11-07", statut: "Parti", prevus: 25, envoyes: 25, delivres: 24, echecs: 1, desinscrits: 1 },
    ],
    envoi: {
      numero: 2,
      titre: "Dépose ton fichier. Ta liste est prête.",
      depart: "2026-11-14T07:00:00.000Z",
      restants: ["emma@exemple.fr", "louis@exemple.fr"],
      exclus: ["test@exemple.fr"],
      deja: 0,
      desinscrits: 0,
      html: "<p style='font-family:Arial;padding:24px'>Aperçu du mail</p>",
    },
  };
}

// Planning de démonstration d'un couple (Couples › Funnel), de même forme que /api/interne/pilotage/demarrage?mariage=…
const MAILS_DEMO = {
  invites: ["Importe ta liste d’invités", "Fini les listes d’invités sur trois Excel différents"],
  equipe: ["Invite les autres organisateurs", "Fini les boucles WhatsApp à rallonge"],
  budget: ["Complète ton budget", "Fini le budget sur des bouts de papier"],
  stan: ["Le mot de Stan", "Ton mariage sur Merry"],
};

export function demoMails(row, retires = []) {
  const prenom = row.couple.split(" et ")[0];
  const sorti = retires.includes("tout");
  const reste = ["invites", "equipe", "budget"].filter((e) => !retires.includes(e) && (e === "invites" ? row.invites < 10 : e === "equipe" ? !row.equipe : !row.budget_touche));
  if (reste.length === 3 && !row.invites && !row.budget_touche && !retires.includes("stan")) reste[2] = "stan";
  const soir = (i) => {
    const d = new Date();
    if (d.getHours() >= 20) d.setDate(d.getDate() + 1);
    d.setDate(d.getDate() + i);
    d.setHours(20, 0, 0, 0);
    return d.toISOString();
  };
  return {
    couple: row.couple,
    test: row.test,
    sorti,
    retires: Object.keys(MAILS_DEMO)
      .filter((e) => retires.includes(e))
      .map((etape) => ({ etape, titre: MAILS_DEMO[etape][0] })),
    a_venir: row.test || sorti ? [] : reste.map((etape, i) => ({ etape, titre: MAILS_DEMO[etape][0], objet: MAILS_DEMO[etape][1], soir: soir(i), a: [prenom], html: "" })),
    envoyes: [
      { libelle: "Mail de 20 h", at: new Date(Date.now() - 86400000).toISOString(), a: prenom },
      { libelle: "Du nouveau sur Merry, n° 1", at: "2026-11-07T07:00:00Z", a: prenom },
    ],
    desinscrits: [],
  };
}

export function demoData(days) {
  const r = rng(days * 7 + 3);
  const list = jours(2 * days);
  const n = (base, spread) => Math.max(0, Math.round(base + (r() - 0.5) * spread));
  const series = list.map((jour, i) => {
    const boost = i >= days ? 1.3 : 1;
    return {
      jour,
      inscriptions: n(1.2 * boost, 3),
      mariages: n(0.9 * boost, 2),
      demandes: n(0.8 * boost, 3),
      messages_pro: n(0.6 * boost, 2),
      messages_couple: n(1.5 * boost, 4),
      reponses_rsvp: n(6 * boost, 30),
      reponses_formulaire: n(4 * boost, 20),
      formulaires_live: 2 + Math.floor(i / 2),
      visites_sites: n(2 * boost, 6),
      vues_pro: n(3 * boost, 8),
      appels_ia: n(8 * boost, 30),
      mails_planifies: n(1 * boost, 3),
      couples_connectes: n(1 * boost, 2),
    };
  });
  const qualite = list.map((jour, i) => [jour, n(18, 6), 42 - i % 3, 60 + n(30, 12)]);
  const site = list.map((jour, i) => [jour, n(40 * (i >= days ? 1.2 : 1), 30), n(90 * (i >= days ? 1.2 : 1), 60), n(45 * (i >= days ? 1.2 : 1), 30)]);
  const app = list.map((jour, i) => [jour, n(9 * (i >= days ? 1.2 : 1), 6), n(60, 30), 300 + n(0, 240), 0]);
  const people = list.map((jour) => [jour, n(6, 4)]);
  const bugs = list.map((jour) => [jour, n(0.4, 2), n(0.3, 1), n(0.5, 2)]);
  const gscDays = list.map((jour, i) => [jour, n(6 * (i >= days ? 1.4 : 1), 6), n(220 * (i >= days ? 1.4 : 1), 120), 18 + n(0, 6)]);
  const organicDays = list.map((jour, i) => [jour, n(5 * (i >= days ? 1.3 : 1), 5)]);
  const cat = (categorie, label, actifs, p3, email, tel, cand, rev) => ({ categorie, label, actifs, photos3: Math.round(actifs * p3), sans_photo: Math.round(actifs * 0.01), email: Math.round(actifs * email), telephone: Math.round(actifs * tel), candidats: cand, revendiques: rev });
  return {
    ok: true,
    demo: true,
    couts: demoCouts(),
    reseau: demoReseau(),
    // Sur 24 h, deux comptes créés dans la journée, pour les séries par heure du Site
    utilisateurs: { ...demoUtilisateurs(), comptes_heures: days === 1 ? [[heureList()[40], 1], [heureList()[15], 1]] : undefined },
    demandes: {
      disponible: true,
      en_attente: [
        { id: "demo-1", cree_le: new Date(Date.now() - 25 * 60000).toISOString(), statut: "en_attente", fiche: { nom: "Le Clos des Amandiers", ville: "Lourmarin", metier: "Lieu de réception" }, fiche_email: "contact@closdesamandiers.fr", fiche_phone: "06 12 34 56 78", email_choice: "oui", email_given: null, phone_choice: "non", phone_given: "0698765432", account_email: "camille@closdesamandiers.fr", account_phone: "0698765432" },
      ],
      recentes: [],
    },
    acces: {
      disponible: true,
      en_attente: [{ email: "camille@exemple.fr", statut: "en_attente", demande_le: new Date(Date.now() - 40 * 60000).toISOString() }],
      approuves: [{ email: "associe@exemple.fr", statut: "approuve", demande_le: new Date(Date.now() - 3 * 86400000).toISOString(), decide_le: new Date(Date.now() - 2 * 86400000).toISOString() }],
      refuses: [],
      permanents: ["stan@exemple.fr"],
    },
    jours: days,
    genere: new Date().toISOString(),
    erreurs: [],
    supabase: {
      jours: days,
      series,
      totaux: {
        comptes: 27, comptes_actifs: 11, comptes_actifs_prec: 16, comptes_jamais_connectes: 0,
        mariages: 23, mariages_avec_date: 16, organisateurs: 27, organisateurs_invites_en_attente: 1, briefs: 20,
        invites: 1050, mariages_avec_invites: 6, taches: 360, taches_faites: 43, lignes_budget: 226, documents: 2, pense_bete: 1,
        formulaires_publies: 8, reponses_formulaires: 8, sites_publies: 5, sites_total: 5, selections_prestataires: 18, mariages_avec_selection: 6,
        demandes_devis: 9, messages: 34, commentaires_prestataires: 1,
        catalogue_actifs: 20946, catalogue_candidats: 135506, catalogue_fermes: 1186, catalogue_photos3: 14174, catalogue_sans_photo: 69,
        catalogue_email: 14149, catalogue_telephone: 18171, catalogue_ajoutes_par_couples: 4,
        fiches_revendiquees: 5, fiches_revendiquees_periode: 5, comptes_pro: 2, credits_en_circulation: 430, credits_depenses: 70, credits_depenses_periode: 70,
        clients_pro: 5, clients_pro_repondus: 3, desinscriptions_mail: 0, mails_planifies: 0,
      },
      catalogue: [
        cat("lieu", "Lieu de réception", 9918, 0.84, 0.69, 0.75, 2203, 2),
        cat("photographe", "Photographe", 1869, 0.66, 0.74, 0.96, 46432, 0),
        cat("fleuriste", "Fleuriste", 1743, 0.35, 0.52, 0.99, 20629, 0),
        cat("traiteur", "Traiteur", 1633, 0.55, 0.71, 0.99, 32178, 3),
        cat("wedding_planner", "Wedding planner", 1532, 0.56, 0.72, 0.96, 4656, 0),
        cat("dj", "DJ et animation", 1227, 0.48, 0.68, 0.98, 3274, 0),
        cat("beaute", "Coiffure et maquillage", 1125, 0.48, 0.5, 0.95, 98, 0),
        cat("videaste", "Vidéaste", 679, 0.66, 0.79, 0.95, 588, 0),
        cat("decoration", "Décoration et location", 625, 0.52, 0.73, 0.99, 321, 0),
        cat("robe", "Robes et costumes", 595, 0.61, 0.68, 0.99, 210, 0),
      ],
      derniers_comptes: [
        { email: "emma@exemple.fr", cree: list[list.length - 1], derniere_connexion: list[list.length - 1], prenoms: "Emma et Lucas" },
        { email: "florence@exemple.fr", cree: list[list.length - 3], derniere_connexion: list[list.length - 2], prenoms: "Florence" },
        { email: "theo@exemple.fr", cree: list[list.length - 5], derniere_connexion: list[list.length - 1], prenoms: "Théo et Clem" },
      ],
      dernieres_demandes: [
        { quand: list[list.length - 1], couple: "Emma et Lucas", prestataire: "Le Cercle du Goût", categorie: "Traiteur" },
        { quand: list[list.length - 2], couple: "Léo et Léa", prestataire: "Château de Castelneau", categorie: "Lieu" },
      ],
      fiches_pro: [
        { nom: "Le Cercle du Goût", categorie: "traiteur", credits: 55, membres: 1, clients: 3, vues: 3 },
        { nom: "Grand Cru Vins et Terroirs", categorie: "traiteur", credits: 100, membres: 0, clients: 1, vues: 1 },
      ],
    },
    posthog: {
      mails: [{ campagne: "samedi-1", total: 6, periode: 6, precedente: 0 }],
      disponible: true,
      erreurs: [],
      site: {
        series: site,
        visites: site.map(([jour, , , sessions]) => [jour, sessions, sessions, Math.round(sessions * 0.12)]),
        robots: site.map(([jour], i) => [jour, 30 + ((i * 11) % 37)]),
        // Sur 24 h, les mêmes heure par heure : creux la nuit, pic en soirée
        ...(days === 1
          ? {
              visites_heures: heureList().map((h) => {
                const n = Math.round([0, 0, 0, 0, 0, 0, 1, 2, 4, 5, 5, 6, 7, 6, 5, 5, 6, 7, 9, 11, 12, 9, 5, 2][Number(h.slice(11))] * (1 + r() * 0.6));
                return [h, n, n, Math.round(n * 0.1)];
              }),
              robots_heures: heureList().map((h) => [h, 3 + Math.round(r() * 12)]),
            }
          : {}),
        robots_familles: [
          { famille: "Googlebot", categorie: "Moteur de recherche", n: 240, pages: 118, dernier: new Date(Date.now() - 2 * 3600000).toISOString() },
          { famille: "GPTBot", categorie: "Agent IA", n: 212, pages: 96, dernier: new Date(Date.now() - 3 * 3600000).toISOString() },
          { famille: "WhatsApp", categorie: "Aperçu de lien", n: 64, pages: 5, dernier: new Date(Date.now() - 5 * 3600000).toISOString() },
          { famille: "Scripts", categorie: "Script", n: 31, pages: 9, dernier: new Date(Date.now() - 20 * 3600000).toISOString() },
        ],
        qualite,
        pages: [{ chemin: "/", vues: 420, visiteurs: 300 }, { chemin: "/partenaires", vues: 90, visiteurs: 70 }, { chemin: "/mariage/lieux-de-reception", vues: 60, visiteurs: 48 }, { chemin: "/about", vues: 30, visiteurs: 26 }],
        entrees: [{ chemin: "/", n: 280 }, { chemin: "/partenaires", n: 40 }, { chemin: "/mariage/lieux-de-reception", n: 35 }],
        sources: [{ source: "Accès direct", n: 180 }, { source: "google.com", n: 95 }, { source: "linkedin.com", n: 40 }, { source: "instagram.com", n: 22 }],
        utm: [],
        entonnoir: [
          { source: "meta-a", site: 22, appli: 9, equipe: 6, essentiel: 4, preparation: 3, compte: 2 },
          { source: "meta-b", site: 17, appli: 5, equipe: 3, essentiel: 2, preparation: 2, compte: 1 },
          { source: "meta-e", site: 4, appli: 1, equipe: 0, essentiel: 0, preparation: 0, compte: 0 },
          { source: "Sans source", site: 140, appli: 31, equipe: 20, essentiel: 15, preparation: 12, compte: 9 },
        ],
        appareils: [{ label: "Mobile", n: 210 }, { label: "Desktop", n: 120 }, { label: "Tablet", n: 8 }],
        pays: [{ label: "France", n: 300 }, { label: "Belgique", n: 14 }, { label: "Suisse", n: 9 }],
        rebond: { rebonds: 150, sessions: 338, duree: 72 },
        rebond_prec: { rebonds: 140, sessions: 290, duree: 65 },
      },
      agents: {
        series: organicDays.map(([jour], i) => [jour, 20 + ((i * 7) % 23), 6 + (i % 5)]),
        familles: [
          { famille: "GPTBot", operateur: "OpenAI", type: "entrainement", n: 212, pages: 96, dernier: new Date(Date.now() - 3 * 3600000).toISOString() },
          { famille: "ClaudeBot", operateur: "Anthropic", type: "entrainement", n: 148, pages: 71, dernier: new Date(Date.now() - 9 * 3600000).toISOString() },
          { famille: "PerplexityBot", operateur: "Perplexity", type: "recherche", n: 61, pages: 30, dernier: new Date(Date.now() - 26 * 3600000).toISOString() },
          { famille: "ChatGPT-User", operateur: "OpenAI", type: "utilisateur", n: 9, pages: 6, dernier: new Date(Date.now() - 50 * 3600000).toISOString() },
        ],
        pages: [{ chemin: "/", n: 70, familles: 4 }, { chemin: "/mariage/lieux/provence", n: 38, familles: 3 }, { chemin: "/mariage/traiteurs/bretagne", n: 21, familles: 2 }],
        sites: { "www.withmerry.com": 410, "app.withmerry.com": 20 },
        navigateurs: { site: { sessions: 3, pages: 11 }, app: { sessions: 1, pages: 4 } },
        rafales: { site: { rafales: 2, sessions: 338 }, app: { rafales: 0, sessions: 41 } },
      },
      seo: {
        series: organicDays,
        entrees: [{ chemin: "/mariage/lieux/provence", n: 14, pages: 2.4 }, { chemin: "/", n: 9, pages: 3.1 }, { chemin: "/mariage/traiteurs/bretagne", n: 6, pages: 1.8 }],
        moteurs: [{ label: "www.google.com", n: 26 }, { label: "www.bing.com", n: 3 }, { label: "www.qwant.com", n: 1 }],
      },
      app: {
        series: app,
        personnes_series: people,
        sessions: { n: 64, duree: 410, mediane: 240, pages: 7.2, engagees: 48 },
        sessions_prec: { n: 52, duree: 380, mediane: 220, pages: 6.5, engagees: 36 },
        personnes: 18,
        personnes_prec: 15,
        pages: [
          { chemin: "/dashboard", vues: 180, sessions: 60, personnes: 18 },
          { chemin: "/dashboard/invites", vues: 120, sessions: 30, personnes: 12 },
          { chemin: "/dashboard/prestataires", vues: 95, sessions: 28, personnes: 11 },
          { chemin: "/dashboard/budget", vues: 70, sessions: 22, personnes: 10 },
          { chemin: "/pro/demandes", vues: 40, sessions: 9, personnes: 3 },
        ],
        temps: [
          { chemin: "/dashboard/invites", total: 9000, n: 110, moyenne: 82 },
          { chemin: "/dashboard/prestataires", total: 6400, n: 90, moyenne: 71 },
          { chemin: "/dashboard", total: 3000, n: 170, moyenne: 18 },
          { chemin: "/dashboard/budget", total: 2500, n: 60, moyenne: 42 },
        ],
        appareils: [{ label: "Mobile", n: 40 }, { label: "Desktop", n: 24 }],
        funnel: { equipe: 31, essentiel: 24, compte: 17, preparation: 9, termine: 9, echecs: 1 },
      },
      bugs: {
        series: bugs,
        exceptions: [{ quand: new Date().toISOString(), hote: "app.withmerry.com", chemin: "/dashboard/invites", titre: "TypeError : Cannot read properties of undefined (reading 'map')", navigateur: "Safari", appareil: "Mobile" }],
        rage: [{ hote: "app.withmerry.com", chemin: "/dashboard/prestataires", n: 2, dernier: list[list.length - 1] }],
        replays: {
          analysees: 12,
          bugs: 1,
          liste: [{ quand: new Date().toISOString(), raison: "Le bouton d'envoi reste sans effet après trois clics, puis la personne quitte la page.", lien: "https://eu.posthog.com/project/321035/replay" }],
        },
        vitals: [{ hote: "app.withmerry.com", lcp: 1900, inp: 120, cls: 0.04, n: 140 }, { hote: "www.withmerry.com", lcp: 2300, inp: 90, cls: 0.02, n: 260 }],
      },
    },
    campagnes: demoCampagnes(list),
    envois: { depuis: list[0], par_jour: list.map((jour, i) => [jour, 6 + ((i * 5) % 9)]) },
    resend: {
      disponible: true,
      envoyes: 23,
      tronque: false,
      par_etat: { delivered: 21, sent: 1, bounced: 1 },
      par_jour: list.map((jour, i) => [jour, (i * 7) % 5]),
      problemes: [{ quand: list[list.length - 2], a: "mauvaise-adresse@exemple.fr", sujet: "Nouvelle demande de devis", etat: "bounced" }],
      sujets: [{ sujet: "Nouvelle demande de devis", n: 9 }, { sujet: "Bienvenue sur Merry", n: 6 }, { sujet: "Un prestataire a répondu", n: 5 }, { sujet: "Invitation", n: 3 }],
      derniers: [
        ["camille.martin@exemple.fr", "Ta réponse est bien arrivée chez Léo et Léa"],
        ["contact@domaine-des-oliviers.fr", "Bienvenue sur Merry, Domaine des Oliviers"],
        ["julien.petit@exemple.fr", "Ta réponse est bien arrivée chez Léo et Léa"],
        ["lea.bernard@exemple.fr", "Nouvelles activités sur votre mariage"],
        ["studio-lumiere@exemple.fr", "Ta demande est bien reçue"],
        ["thomas.durand@exemple.fr", "Léa t'invite à rejoindre Merry"],
        ["sarah.roux@exemple.fr", "Ta réponse est bien arrivée chez Léo et Léa"],
        ["traiteur-saveurs@exemple.fr", "Ta demande est bien reçue"],
        ["hugo.moreau@exemple.fr", "Nouvelles activités sur votre mariage"],
        ["emma.laurent@exemple.fr", "Hugo a rejoint ton mariage sur Merry"],
        ["fleurs-de-lune@exemple.fr", "Bienvenue sur Merry, Fleurs de Lune"],
        ["chloe.simon@exemple.fr", "Ta réponse est bien arrivée chez Léo et Léa"],
        ["louis.michel@exemple.fr", "Nouvelles activités sur votre mariage"],
        ["manon.garcia@exemple.fr", "Ta réponse est bien arrivée chez Léo et Léa"],
        ["nathan.david@exemple.fr", "Ton mot de passe a été modifié"],
      ].map(([a, sujet], i) => ({ id: `demo-${i}`, quand: new Date(Date.now() - i * 37 * 60000 - (i > 9 ? 86400000 : 0) - (i > 12 ? 86400000 : 0)).toISOString(), a, sujet, etat: "delivered" })),
    },
    google: {
      disponible: true,
      site: "sc-domain:withmerry.com",
      series: gscDays,
      requetes: [
        { requete: "lieu mariage provence", clics: 12, impressions: 410, ctr: 0.029, position: 14.2 },
        { requete: "traiteur mariage bretagne", clics: 7, impressions: 260, ctr: 0.027, position: 17.8 },
        { requete: "organiser son mariage", clics: 4, impressions: 520, ctr: 0.008, position: 31.4 },
        { requete: "merry mariage", clics: 9, impressions: 22, ctr: 0.41, position: 1.3 },
      ],
      pages: [
        { page: "/mariage/lieux/provence", clics: 14, impressions: 620, ctr: 0.022, position: 15 },
        { page: "/", clics: 11, impressions: 180, ctr: 0.061, position: 6 },
        { page: "/mariage/traiteurs/bretagne", clics: 7, impressions: 300, ctr: 0.023, position: 18 },
      ],
      appareils: [{ label: "MOBILE", n: 28, impressions: 1100 }, { label: "DESKTOP", n: 12, impressions: 520 }],
      sitemaps: [{ chemin: "https://www.withmerry.com/sitemap.xml", soumis: 528, indexes: 212, erreurs: 0, avertissements: 0, lu: new Date().toISOString(), en_attente: false }],
    },
    seo: {
      disponible: true,
      site: "https://www.withmerry.com",
      robots: { statut: 200, sitemap_declare: true, bloque_tout: false },
      sitemap: { statut: 200, urls: 528, sections: [{ label: "/mariage/lieux", n: 109 }, { label: "/mariage/traiteurs", n: 109 }, { label: "/mariage/photographes", n: 109 }, { label: "/mariage/fleuristes", n: 106 }, { label: "/mariage/dj", n: 95 }] },
      pages: [
        { url: "https://www.withmerry.com/", chemin: "/", statut: 200, ms: 240, problemes: [] },
        { url: "https://www.withmerry.com/mariage/lieux/provence", chemin: "/mariage/lieux/provence", statut: 200, ms: 410, problemes: ["titre long (72 caractères)"] },
        { url: "https://www.withmerry.com/mariage/dj/corse", chemin: "/mariage/dj/corse", statut: 200, ms: 380, problemes: [] },
      ],
      pages_en_defaut: 1,
      lenteur_ms: 343,
    },
    vercel: {
      disponible: true,
      total: 12,
      erreurs: 1,
      erreurs_production: 0,
      en_cours: 0,
      derniere_production: { quand: Date.now() - 3600 * 1000, message: "Pilotage : page interne des indicateurs", commit: "193473c" },
      liste: [
        { id: "1", etat: "READY", cible: "production", quand: Date.now() - 3600 * 1000, duree: 70, commit: "193473c", message: "Pilotage : page interne des indicateurs" },
        { id: "2", etat: "ERROR", cible: "preview", quand: Date.now() - 7200 * 1000, duree: 50, commit: "gxi06qi", message: "Mails : sitemap" },
        { id: "3", etat: "READY", cible: "production", quand: Date.now() - 86400 * 1000, duree: 65, commit: "59e8545", message: "Connexion prestataire : état gardé" },
      ],
    },
  };
}

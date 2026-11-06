// Jeu de données d'exemple pour la page de pilotage : sans Supabase en local (ou avec ?demo=1), la page se
// dessine avec ces chiffres plutôt que de rester vide. Rien ici n'est une vraie mesure.

import { summarizeCouts } from "@/lib/server/pilotage/couts";
import { parisDay, summarizeReseau } from "@/lib/server/pilotage/reseau";

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
  const m = (couple, email, connexion, cree, invites, site, devis, taches) => ({ id: email, couple, emails: [email], cree: ago(cree), date: null, lieu: null, derniere_connexion: connexion === null ? null : ago(connexion), invites, dernier_invite: invites ? ago(300) : null, site, site_slug: site ? "exemple" : null, formulaire: null, reponses_formulaire: 0, taches, taches_faites: Math.round(taches * 0.2), budget: 12, devis });
  const mariages = [m("Emma et Lucas", "emma@exemple.fr", 12, 9000, 84, "publié", 3, 40), m("Théo et Clem", "theo@exemple.fr", 340, 20000, 0, null, 0, 30), m("Florence", "florence@exemple.fr", 3000, 30000, 12, "brouillon", 1, 25)];
  const utilisateurs = mariages.map((x) => ({ id: x.id, email: x.emails[0], cree: x.cree, derniere_connexion: x.derniere_connexion, couple: x.couple, invites: x.invites, site: x.site, devis: x.devis }));
  return {
    fenetre_ms: 86400000,
    genere: new Date().toISOString(),
    totaux: { comptes: 3, mariages: 3, avec_site: 2, avec_site_publie: 1, avec_invites: 2, avec_formulaire: 0, avec_devis: 2 },
    fenetre: { connectes: { n: 2, prec: 1 }, comptes_crees: { n: 0, prec: 1 }, mariages_crees: { n: 0, prec: 1 }, sites_crees: { n: 0, prec: 0 }, invites_ajoutes: { n: 12, prec: 4 }, devis: { n: 1, prec: 0 } },
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
      visites_sites: n(2 * boost, 6),
      vues_pro: n(3 * boost, 8),
      appels_ia: n(8 * boost, 30),
      mails_planifies: n(1 * boost, 3),
    };
  });
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
    utilisateurs: demoUtilisateurs(),
    demandes: {
      disponible: true,
      en_attente: [
        { id: "demo-1", cree_le: new Date(Date.now() - 25 * 60000).toISOString(), statut: "en_attente", fiche: { nom: "Le Clos des Amandiers", ville: "Lourmarin", metier: "Lieu de réception" }, fiche_email: "contact@closdesamandiers.fr", fiche_phone: "06 12 34 56 78", email_choice: "oui", email_given: null, phone_choice: "non", phone_given: "0698765432", account_email: "camille@closdesamandiers.fr", account_phone: "0698765432" },
      ],
      recentes: [],
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
      disponible: true,
      erreurs: [],
      site: {
        series: site,
        pages: [{ chemin: "/", vues: 420, visiteurs: 300 }, { chemin: "/partenaires", vues: 90, visiteurs: 70 }, { chemin: "/mariage/lieux-de-reception", vues: 60, visiteurs: 48 }, { chemin: "/about", vues: 30, visiteurs: 26 }],
        entrees: [{ chemin: "/", n: 280 }, { chemin: "/partenaires", n: 40 }, { chemin: "/mariage/lieux-de-reception", n: 35 }],
        sources: [{ source: "Accès direct", n: 180 }, { source: "google.com", n: 95 }, { source: "linkedin.com", n: 40 }, { source: "instagram.com", n: 22 }],
        utm: [],
        appareils: [{ label: "Mobile", n: 210 }, { label: "Desktop", n: 120 }, { label: "Tablet", n: 8 }],
        pays: [{ label: "France", n: 300 }, { label: "Belgique", n: 14 }, { label: "Suisse", n: 9 }],
        rebond: { rebonds: 150, sessions: 338, duree: 72 },
        rebond_prec: { rebonds: 140, sessions: 290, duree: 65 },
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
        funnel: { fete: 40, equipe: 31, essentiel: 24, compte: 17, preparation: 9, termine: 9, echecs: 1 },
      },
      bugs: {
        series: bugs,
        exceptions: [{ quand: new Date().toISOString(), hote: "app.withmerry.com", chemin: "/dashboard/invites", titre: "TypeError : Cannot read properties of undefined (reading 'map')", navigateur: "Safari", appareil: "Mobile" }],
        rage: [{ hote: "app.withmerry.com", chemin: "/dashboard/prestataires", n: 2, dernier: list[list.length - 1] }],
        vitals: [{ hote: "app.withmerry.com", lcp: 1900, inp: 120, cls: 0.04, n: 140 }, { hote: "www.withmerry.com", lcp: 2300, inp: 90, cls: 0.02, n: 260 }],
      },
    },
    resend: {
      disponible: true,
      envoyes: 23,
      tronque: false,
      par_etat: { delivered: 21, sent: 1, bounced: 1 },
      par_jour: list.map((jour, i) => [jour, (i * 7) % 5]),
      problemes: [{ quand: list[list.length - 2], a: "mauvaise-adresse@exemple.fr", sujet: "Nouvelle demande de devis", etat: "bounced" }],
      sujets: [{ sujet: "Nouvelle demande de devis", n: 9 }, { sujet: "Bienvenue sur Merry", n: 6 }, { sujet: "Un prestataire a répondu", n: 5 }, { sujet: "Invitation", n: 3 }],
      derniers: [{ quand: new Date().toISOString(), sujet: "Un prestataire a répondu", etat: "delivered" }, { quand: list[list.length - 1], sujet: "Bienvenue sur Merry", etat: "delivered" }],
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

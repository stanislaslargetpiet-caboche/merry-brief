// Données d'exemple (le mariage de la maquette), utilisées en mode démo :
// en local sans Supabase, ou avec ?demo=1. Les dates sont calées sur aujourd'hui
// pour que « cette semaine » et le compte à rebours restent justes.

import { isoDate, addDays, today } from "./format";

const D = (n) => isoDate(addDays(today(), n));
const ts = (n) => new Date(addDays(today(), n).getTime() + 10 * 3600000).toISOString();

// Générateur pseudo-aléatoire déterministe (mêmes invités à chaque chargement)
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const IDS = {
  wedding: "00000000-0000-4000-8000-000000000001",
  S: "00000000-0000-4000-8000-0000000000a1",
  M: "00000000-0000-4000-8000-0000000000a2",
  PS: "00000000-0000-4000-8000-0000000000a3",
  PM: "00000000-0000-4000-8000-0000000000a4",
};

let n = 0;
const id = (prefix) => {
  n += 1;
  return `${prefix}-0000-4000-8000-${String(n).padStart(12, "0")}`;
};

export function buildDemo() {
  n = 0;
  const wedding = {
    id: IDS.wedding,
    partner1: "Stanislas",
    partner2: "Margue",
    wedding_date: D(234),
    venue: "Domaine des Oliviers",
    region: "Provence",
    layouts: {},
    budget_total: 40000,
    brief_id: null,
  };

  const members = [
    { id: IDS.S, wedding_id: IDS.wedding, user_id: "demo-user", display_name: "Stanislas", initial: "S", color: "lavande", role: "couple", email: "stanislas@exemple.fr", contribution: 12000, position: 0, invite_token: id("10000000"), joined_at: ts(-30) },
    { id: IDS.M, wedding_id: IDS.wedding, user_id: "demo-margue", display_name: "Margue", initial: "M", color: "peche", role: "couple", email: "margue@exemple.fr", contribution: 12000, position: 1, invite_token: id("10000000"), joined_at: ts(-29) },
    { id: IDS.PS, wedding_id: IDS.wedding, user_id: "demo-ps", display_name: "Parents de Stanislas", initial: "P", color: "bleu", role: "parents", email: "parents.s@exemple.fr", contribution: 8000, position: 2, invite_token: id("10000000"), joined_at: ts(-20) },
    { id: IDS.PM, wedding_id: IDS.wedding, user_id: null, display_name: "Parents de Margue", initial: "P", color: "sauge", role: "parents", email: "parents.m@exemple.fr", contribution: 8000, position: 3, invite_token: id("10000000"), joined_at: null, invited_at: ts(-3) },
  ];

  const ev = (name, short, position) => ({ id: id("20000000"), wedding_id: IDS.wedding, name, short_name: short, position });
  const events = [
    { ...ev("Mariage civil", "Civil", 0), kind: "civil", event_date: D(227) },
    { ...ev("Dîner de la veille", "Veille", 1), kind: "veille", event_date: D(233) },
    { ...ev("Cocktail", "Cocktail", 2), kind: "cocktail", event_date: D(234) },
    { ...ev("Dîner", "Dîner", 3), kind: "diner", event_date: D(234) },
    { ...ev("Brunch", "Brunch", 4), kind: "brunch", event_date: D(235) },
  ];
  const [CIVIL, VEILLE, COCKTAIL, DINER, BRUNCH] = events.map((e) => e.id);

  const gr = (name, color, position) => ({ id: id("30000000"), wedding_id: IDS.wedding, name, color, position });
  const groups = [gr("Famille de Stanislas", "lavande", 0), gr("Amis de Stanislas", "bleu", 1), gr("Famille de Margue", "peche", 2), gr("Amis de Margue", "sauge", 3)];
  const [FS, AS, FM, AM] = groups.map((g) => g.id);

  const fields = [
    { id: id("40000000"), wedding_id: IDS.wedding, name: "Hébergement", position: 0, source: "invites", kind: "text", options: [] },
    { id: id("40000000"), wedding_id: IDS.wedding, name: "Vient en voiture", position: 1, source: "organisateurs", kind: "choice", options: ["Oui", "Non", "Ne sait pas"] },
  ];
  const VOITURE = fields[1].id;
  const HEB = fields[0].id;

  const guests = [];
  const responses = [];
  let pos = 0;
  const addGuest = (g, statuses, when) => {
    const gid = id("50000000");
    guests.push({ id: gid, wedding_id: IDS.wedding, first_name: "", last_name: "", age: null, plus_one_of: null, diet: null, address: null, email: null, phone: null, custom: {}, position: pos++, ...g });
    const list = [CIVIL, VEILLE, COCKTAIL, DINER, BRUNCH];
    statuses.forEach((s, i) => responses.push({ wedding_id: IDS.wedding, guest_id: gid, event_id: list[i], status: s, updated_at: when || ts(-25) }));
    return gid;
  };
  const OUI5 = ["oui", "oui", "oui", "oui", "oui"];
  const ATT_FRIEND = ["non_invite", "attente", "attente", "attente", "attente"];

  // Les invités montrés dans la maquette
  addGuest({ first_name: "Claire", last_name: "Morel", group_id: FS, address: "14 rue de Vaugirard, 75006 Paris", email: "claire.morel@gmail.com", custom: { [HEB]: "Hôtel", [VOITURE]: "Oui" } }, ["oui", "oui", "oui", "oui", "non"]);
  addGuest({ first_name: "Pierre", last_name: "Morel", group_id: FS, address: "14 rue de Vaugirard, 75006 Paris", email: "pierre.morel@gmail.com", custom: { [HEB]: "Hôtel", [VOITURE]: "Oui" } }, ["oui", "oui", "oui", "oui", "non"]);
  addGuest({ first_name: "Anne", last_name: "Dubois", group_id: FM, address: "3 chemin des Vignes, 13100 Aix-en-Provence", email: "anne.dubois@orange.fr", custom: { [HEB]: "Gîte", [VOITURE]: "Non" } }, OUI5);
  addGuest({ first_name: "Marc", last_name: "Dubois", group_id: FM, address: "3 chemin des Vignes, 13100 Aix-en-Provence", email: "marc.dubois@orange.fr", custom: { [HEB]: "Gîte" } }, OUI5);
  addGuest({ first_name: "Léo", last_name: "Dubois", age: 8, group_id: FM, diet: "Sans gluten", address: "3 chemin des Vignes, 13100 Aix-en-Provence", custom: { [HEB]: "Gîte" } }, OUI5);
  addGuest({ first_name: "Jade", last_name: "Dubois", age: 5, group_id: FM, address: "3 chemin des Vignes, 13100 Aix-en-Provence", custom: { [HEB]: "Gîte" } }, OUI5);
  const louise = addGuest({ first_name: "Louise", last_name: "Martin", group_id: AM, email: "louise.martin@gmail.com" }, ["non_invite", "non_invite", "attente", "non_invite", "non_invite"]);
  addGuest({ first_name: "", last_name: "", group_id: AM, plus_one_of: louise }, ["non_invite", "non_invite", "attente", "non_invite", "non_invite"]);
  addGuest({ first_name: "Inès", last_name: "Haddad", group_id: AS, diet: "Halal", address: "27 boulevard Voltaire, 75011 Paris", email: "ines.haddad@outlook.fr", custom: { [HEB]: "À voir" } }, ATT_FRIEND);
  addGuest({ first_name: "Karim", last_name: "Haddad", group_id: AS, diet: "Halal", address: "27 boulevard Voltaire, 75011 Paris", email: "karim.haddad@outlook.fr", custom: { [HEB]: "À voir" } }, ATT_FRIEND);
  addGuest({ first_name: "Odile", last_name: "Petit", group_id: FS, diet: "Végétarienne", address: "8 place Bellecour, 69002 Lyon", email: "odile.petit@free.fr", custom: { [HEB]: "Gîte" } }, ["oui", "non", "non_invite", "oui", "oui"]);
  addGuest({ first_name: "Hugo", last_name: "Bernard", group_id: AS, email: "hugo.bernard@gmail.com" }, ["non_invite", "non_invite", "non", "non_invite", "non_invite"]);

  // 150 invités de plus, répartis comme dans la maquette (162 au total)
  const rand = rng(1206);
  const FIRST = ["Camille", "Thomas", "Julie", "Nicolas", "Sophie", "Antoine", "Marie", "Julien", "Laura", "Maxime", "Emma", "Lucas", "Chloé", "Hugo", "Manon", "Louis", "Sarah", "Paul", "Léa", "Arthur", "Alice", "Victor", "Inès", "Gabriel", "Zoé", "Raphaël", "Juliette", "Adrien", "Clémence", "Bastien", "Margaux", "Romain", "Agathe", "Simon", "Pauline", "Théo", "Elsa", "Quentin", "Charlotte", "Mathieu", "Hélène", "Bruno", "Isabelle", "François", "Nathalie", "Philippe", "Catherine", "Olivier", "Valérie", "Étienne"];
  const LAST = ["Garnier", "Leroy", "Fontaine", "Rousseau", "Girard", "Bonnet", "Lambert", "Faure", "Mercier", "Blanc", "Guerin", "Muller", "Henry", "Roussel", "Nicolas", "Perrin", "Morin", "Mathieu", "Clement", "Gauthier", "Dumont", "Lopez", "Fournier", "Chevalier", "Robin", "Masson", "Sanchez", "Noel", "Lemaire", "Picard", "Renaud", "Barbier", "Aubert", "Brun", "Marchand"];
  const CITIES = ["75005 Paris", "75017 Paris", "69003 Lyon", "13008 Marseille", "33000 Bordeaux", "44000 Nantes", "31000 Toulouse", "13100 Aix-en-Provence", "92200 Neuilly-sur-Seine", "35000 Rennes", "59000 Lille", "06000 Nice"];
  const STREETS = ["rue de la République", "avenue des Tilleuls", "rue Victor Hugo", "chemin des Oliviers", "rue du Moulin", "boulevard Gambetta", "place du Marché", "rue des Écoles", "allée des Platanes", "rue Pasteur"];
  const HEBS = ["Hôtel", "Gîte", "À voir", "Chez la famille"];

  // Quotas : groupes, réponses, adresses
  const quota = [
    [FS, 49],
    [AS, 25],
    [FM, 52],
    [AM, 24],
  ];
  const statusPool = [...Array(31).fill("oui"), ...Array(5).fill("non"), ...Array(114).fill("attente")];
  for (let i = statusPool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [statusPool[i], statusPool[j]] = [statusPool[j], statusPool[i]];
  }
  let k = 0;
  let addressesLeft = 100;
  let recentLeft = 12;
  for (const [groupId, count] of quota) {
    const family = groupId === FS || groupId === FM;
    let left = count;
    while (left > 0) {
      const size = Math.min(left, family ? 1 + Math.floor(rand() * 3) : 1 + Math.floor(rand() * 2));
      const last = LAST[Math.floor(rand() * LAST.length)];
      const hasAddr = addressesLeft > 0 && rand() < 0.86;
      const addr = hasAddr ? `${1 + Math.floor(rand() * 60)} ${STREETS[Math.floor(rand() * STREETS.length)]}, ${CITIES[Math.floor(rand() * CITIES.length)]}` : null;
      const heb = HEBS[Math.floor(rand() * HEBS.length)];
      for (let m = 0; m < size; m += 1) {
        const first = FIRST[Math.floor(rand() * FIRST.length)];
        const st = statusPool[k++];
        if (addr) addressesLeft -= 1;
        let statuses;
        if (st === "oui") statuses = family ? ["oui", "oui", "oui", "oui", rand() < 0.7 ? "oui" : "non"] : ["non_invite", rand() < 0.5 ? "oui" : "non_invite", "oui", "oui", rand() < 0.6 ? "oui" : "non"];
        else if (st === "non") statuses = family ? ["non", "non", "non", "non", "non"] : ["non_invite", "non_invite", "non", "non", "non_invite"];
        else statuses = family ? ["attente", rand() < 0.6 ? "attente" : "non_invite", "attente", "attente", "attente"] : ["non_invite", rand() < 0.4 ? "attente" : "non_invite", "attente", "attente", rand() < 0.5 ? "attente" : "non_invite"];
        let when;
        if ((st === "oui" || st === "non") && recentLeft > 0) {
          when = ts(-Math.min(2, (today().getDay() + 6) % 7));
          recentLeft -= 1;
        }
        addGuest(
          {
            first_name: first,
            last_name: last,
            group_id: groupId,
            address: addr,
            email: rand() < 0.75 ? `${first}.${last}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "") + "@gmail.com" : null,
            custom: addr ? { [HEB]: heb } : {},
          },
          statuses,
          when,
        );
      }
      left -= size;
    }
  }

  // Rétroplanning : 48 tâches, 11 faites
  const S = IDS.S;
  const M = IDS.M;
  const PS = IDS.PS;
  const PM = IDS.PM;
  const BOTH = [S, M];
  const tasks = [];
  let tp = 0;
  const task = (title, icon, offset, assignees, done = false, merry = false) =>
    tasks.push({ id: id("60000000"), wedding_id: IDS.wedding, title, icon, due_date: D(offset), done, done_at: done ? ts(Math.min(offset, -1)) : null, assignees, added_by_merry: merry, position: tp++ });

  task("Valider le devis du traiteur", "traiteur", 4, [M]);
  task("Envoyer le lien d'adresses aux familles", "adresse", 7, [S]);
  task("Réserver le photographe", "photo", 12, BOTH, true);
  task("Choisir le DJ", "musique", 25, [S]);
  const djTask = tasks[tasks.length - 1].id;
  task("Bloquer des chambres près du lieu", "lit", 40, [PM]);
  task("Envoyer les save-the-date", "enveloppe", 55, [M]);
  task("Payer le 2e acompte du traiteur", "wallet", 86, [S]);
  task("Premiers essayages", "tenues", 102, BOTH);
  task("Réserver le brunch du dimanche", "traiteur", 145, [PS]);
  task("Déposer le dossier à la mairie", "mairie", 173, [S]);
  task("Liste des photos de groupe", "photo", 203, [M], false, true);
  task("Faire le plan de table", "table", 211, BOTH);
  task("Envoyer le déroulé aux prestataires", "horloge", 223, [S]);
  // Déjà faites
  task("Fixer le budget", "wallet", -70, BOTH, true);
  task("Réserver le lieu", "lieu", -60, BOTH, true);
  task("Choisir la date", "calendar", -80, [S], true);
  task("Faire la liste des invités", "users", -50, [S], true);
  task("Comparer trois traiteurs", "traiteur", -35, [S], true);
  task("Ouvrir un compte commun mariage", "wallet", -40, [S], true);
  task("Choisir les témoins", "users", -45, [M], true);
  task("Visiter le domaine avec les parents", "lieu", -55, [M], true);
  task("Réserver le gîte des familles", "lit", -20, [PS], true);
  task("Choisir les alliances", "alliances", -15, [M], true);
  // À venir
  const later = [
    ["Choisir le fleuriste", "fleurs", 30, [M]],
    ["Commander les faire-part", "enveloppe", 70, [M]],
    ["Réserver la navette des invités", "autre", 120, [S]],
    ["Choisir le gâteau", "traiteur", 150, BOTH],
    ["Essai coiffure et maquillage", "beaute", 175, [M]],
    ["Relancer les invités sans réponse", "users", 190, [S]],
    ["Prévoir les tenues des enfants d'honneur", "tenues", 160, [PM]],
    ["Préparer les discours", "autre", 215, [PS]],
    ["Trouver un officiant laïque", "autre", 95, BOTH],
    ["Choisir la playlist du cocktail", "musique", 200, BOTH],
    ["Commander la papeterie du jour J", "enveloppe", 180, [M]],
    ["Acheter les cadeaux des témoins", "cadeau", 205, BOTH],
    ["Organiser l'enterrement de vie de garçon", "autre", 150, [S]],
    ["Prévoir le transport des parents", "autre", 190, [PM]],
    ["Réserver la nuit de noces", "lit", 110, BOTH],
    ["Choisir les menus enfants", "traiteur", 165, [PM]],
    ["Préparer la cérémonie laïque", "autre", 196, BOTH],
    ["Rédiger les remerciements", "enveloppe", 240, BOTH],
    ["Organiser l'apéritif de bienvenue", "traiteur", 230, [PS]],
    ["Vérifier les assurances", "autre", 160, [S]],
    ["Préparer le plan d'accès", "adresse", 135, [S]],
    ["Choisir les chaussures", "tenues", 130, [M]],
    ["Réserver le coiffeur du jour J", "beaute", 140, [M]],
    ["Commander les menus imprimés", "enveloppe", 210, BOTH],
    ["Faire la liste de mariage", "cadeau", 115, BOTH],
  ];
  for (const [t, ic, off, who] of later) task(t, ic, off, who);

  // Budget et prestataires
  const vendor = (v) => {
    const vid = id("70000000");
    return { id: vid, wedding_id: IDS.wedding, contact_name: null, contact_role: null, phone: null, email: null, website: null, summary: null, next_action: null, ...v };
  };
  const vLieu = vendor({ name: "Domaine des Oliviers", category: "Lieu", contact_name: "Hélène Garcia", contact_role: "Responsable des événements", phone: "04 90 12 34 56", email: "evenements@domaine-oliviers.fr", website: "domaine-oliviers.fr" });
  const vTraiteur = vendor({ name: "Maison Lemoine", category: "Traiteur", contact_name: "Paul Lemoine", contact_role: "Chef", phone: "04 42 98 76 54", email: "contact@maison-lemoine.fr", website: "maison-lemoine.fr" });
  const vPhoto = vendor({
    name: "Atelier Lumen",
    category: "Photo & vidéo",
    contact_name: "Julie Marchand",
    contact_role: "Photographe, votre interlocutrice",
    phone: "06 39 98 42 17",
    email: "julie@atelier-lumen.fr",
    website: "atelier-lumen.fr",
    summary:
      "Reportage de 10 h, des préparatifs à la soirée, et un film court de 3 minutes.\nDevis signé le 18 octobre pour 2 400 €. Acompte de 720 € réglé par Margue.\nSéance d'engagement à caler : Julie propose le 8 ou le 16 novembre.\nÀ envoyer un mois avant : la liste des photos de groupe.",
    next_action: "Répondre à Julie pour la date de la séance",
  });
  const vFleurs = vendor({ name: "Fleurs de Lune", category: "Fleuriste", contact_name: "Lucie Bernard", phone: "06 12 45 78 90", email: "bonjour@fleursdelune.fr", website: "fleursdelune.fr", iban: "FR76 1234 5678 9012 3456 7890 123", bic: "EXEMFRPP" });
  const vAlliances = vendor({ name: "Maison Ardent", category: "Bijoutier", contact_name: "Marc Ardent", phone: "01 45 67 89 10", email: "atelier@maison-ardent.fr", website: "maison-ardent.fr" });
  const vendors = [vLieu, vTraiteur, vPhoto, vFleurs, vAlliances];

  const item = (label, icon, budgeted, extra = {}) => ({ id: id("80000000"), wedding_id: IDS.wedding, label, icon, budgeted, note: null, vendor_id: null, quote_amount: null, quote_signed_at: null, ...extra });
  const items = [
    item("Lieu", "lieu", 9000, { vendor_id: vLieu.id, quote_amount: 9800, quote_signed_at: D(-40) }),
    item("Traiteur", "traiteur", 12000, { vendor_id: vTraiteur.id, quote_amount: 11200, quote_signed_at: D(-12) }),
    item("Photo & vidéo", "photo", 3500, { vendor_id: vPhoto.id, quote_amount: 2400, quote_signed_at: D(-3) }),
    item("Fleurs & déco", "fleurs", 2500, { vendor_id: vFleurs.id, quote_amount: 2300, quote_signed_at: D(-2) }),
    item("Alliances", "alliances", 2300, { vendor_id: vAlliances.id, quote_amount: 2300, quote_signed_at: D(-15) }),
    item("Tenues", "tenues", 3500),
    item("Musique", "musique", 1800),
    item("Papeterie", "enveloppe", 900),
    item("Beauté", "beaute", 500),
    item("Imprévus", "imprevus", 4000, { note: "10 % du budget" }),
  ].map((it, i) => ({ ...it, position: i }));
  const [iLieu, iTraiteur, iPhoto, iFleurs, iAlliances] = items;

  const pay = (itemId, label, amount, due, paid, payer, method = "virement") => ({ id: id("90000000"), wedding_id: IDS.wedding, budget_item_id: itemId, label, amount, due_date: due, paid_at: paid, payer_id: payer, method });
  const payments = [
    pay(iLieu.id, "Acompte", 2940, D(-38), D(-38), PS),
    pay(iLieu.id, "Solde", 6860, D(203), null, PS),
    pay(iTraiteur.id, "Acompte", 3360, D(-10), D(-10), S),
    pay(iTraiteur.id, "2e acompte", 3360, D(86), null, S),
    pay(iTraiteur.id, "Solde", 4480, D(244), null, S),
    pay(iPhoto.id, "Acompte", 720, D(-1), D(-1), M, "carte"),
    pay(iPhoto.id, "Solde", 1680, D(234), null, M),
    pay(iFleurs.id, "Acompte", 690, D(40), null, null),
    pay(iAlliances.id, "Totalité", 2300, D(-15), D(-15), S, "carte"),
  ];

  // Dossiers de documents et leur contenu (les devis et factures du budget sont dans « Factures et devis »)
  const folder = (name, color, position, by, offset) => ({ id: id("c0000000"), wedding_id: IDS.wedding, name, color, position, created_by: by, created_at: ts(offset) });
  const fFactures = folder("Factures et devis", "lavande", 0, S, -41);
  const fMairie = folder("Mairie", "bleu", 1, S, -30);
  const fReligieux = folder("Préparation religieuse", "peche", 2, M, -20);
  const fLieu = folder("Lieu et traiteur", "sauge", 3, PS, -40);
  const folders = [fFactures, fMairie, fReligieux, fLieu];

  const doc = (itemId, vendorId, kind, name, offset, by, size, mime) => ({
    id: id("a0000000"),
    wedding_id: IDS.wedding,
    budget_item_id: itemId,
    vendor_id: vendorId,
    folder_id: fFactures.id,
    kind,
    name,
    url: "https://exemple.fr/document.pdf",
    storage_path: null,
    size_bytes: size,
    mime,
    added_by: by,
    created_at: ts(offset),
  });
  const file = (folderId, name, offset, by, size, mime) => ({
    id: id("a0000000"),
    wedding_id: IDS.wedding,
    budget_item_id: null,
    vendor_id: null,
    folder_id: folderId,
    kind: "autre",
    name,
    url: "https://exemple.fr/document.pdf",
    storage_path: null,
    size_bytes: size,
    mime,
    added_by: by,
    created_at: ts(offset),
  });
  const PDF = "application/pdf";
  const documents = [
    doc(iLieu.id, vLieu.id, "devis", "Devis signé", -40, PS, 640000, PDF),
    doc(iLieu.id, vLieu.id, "facture", "Facture d'acompte", -38, PS, 210000, PDF),
    doc(iTraiteur.id, vTraiteur.id, "devis", "Devis signé", -12, S, 2400000, PDF),
    doc(iTraiteur.id, vTraiteur.id, "facture", "Facture d'acompte", -10, S, 180000, PDF),
    doc(iPhoto.id, vPhoto.id, "devis", "Devis signé", -3, M, 1100000, PDF),
    doc(iPhoto.id, vPhoto.id, "facture", "Facture d'acompte", -1, M, 150000, PDF),
    doc(iFleurs.id, vFleurs.id, "devis", "Devis signé", -2, M, 1200000, PDF),
    doc(iAlliances.id, vAlliances.id, "devis", "Devis signé", -15, S, 90000, PDF),
    doc(iAlliances.id, vAlliances.id, "facture", "Facture", -15, S, 95000, PDF),
    file(fFactures.id, "Reçu essayage robe.jpg", -24, M, 2100000, "image/jpeg"),
    file(fMairie.id, "Acte de naissance Stanislas.jpg", -12, S, 3800000, "image/jpeg"),
    file(fMairie.id, "Acte de naissance Margue.pdf", -11, M, 420000, PDF),
    file(fMairie.id, "Justificatif de domicile.pdf", -11, S, 310000, PDF),
    file(fMairie.id, "Liste des témoins.docx", -9, M, 48000, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    file(fReligieux.id, "Textes de la cérémonie.docx", -19, M, 88000, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    file(fReligieux.id, "Certificat de baptême Margue.pdf", -18, M, 260000, PDF),
    file(fReligieux.id, "Chants choisis.pdf", -6, M, 120000, PDF),
    file(fLieu.id, "Plan du domaine.pdf", -39, PS, 5400000, PDF),
    file(fLieu.id, "Menu dégustation.pdf", -14, S, 760000, PDF),
    file(fLieu.id, "Plan de table v1.xlsx", -4, S, 52000, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
  ];

  const messages = [
    { id: id("b0000000"), wedding_id: IDS.wedding, vendor_id: vPhoto.id, from_vendor: true, author_id: null, body: "Merci pour la signature ! Je vous envoie la facture d'acompte dans la journée.", sent_at: ts(-3) },
    { id: id("b0000000"), wedding_id: IDS.wedding, vendor_id: vPhoto.id, from_vendor: false, author_id: M, body: "Acompte réglé. Pouvez-vous nous proposer un créneau pour la séance d'engagement ?", sent_at: ts(-1) },
    { id: id("b0000000"), wedding_id: IDS.wedding, vendor_id: vPhoto.id, from_vendor: true, author_id: null, body: "Avec plaisir : samedi 8 ou dimanche 16 novembre, au choix.", sent_at: ts(0) },
  ];

  return {
    wedding,
    members,
    groups,
    events,
    fields,
    guests,
    responses,
    tasks,
    vendors,
    items,
    payments,
    documents,
    folders,
    documentsSetup: true,
    messages,
    comments: [
      { id: id("61000000"), wedding_id: IDS.wedding, task_id: djTask, author_id: M, body: "On a écouté les trois DJ proposés par le domaine. Plus que deux choix : DJ Sam ou Les Platines.", created_at: ts(-2) },
      { id: id("61000000"), wedding_id: IDS.wedding, task_id: djTask, author_id: S, body: "J'appelle les deux jeudi pour les tarifs, on tranche samedi.", created_at: ts(-1) },
    ],
    commentsOn: true,
    kpiPrefs: {},
    form: null,
    formSetup: true,
    fieldsSetup: true,
    datesSetup: true,
    brief: {
      first_name: "Stanislas",
      partner_first_name: "Margue",
      stage: "lieu_reserve",
      team: "nous_parents",
      guests: "150-200",
      budget: "30-50k",
      region: "Provence",
      wedding_date: wedding.wedding_date,
      format: "weekend",
      vibes: ["Champêtre chic", "Grande tablée", "Fête jusqu'au bout de la nuit"],
    },
    meId: IDS.S,
    weddings: [{ id: IDS.wedding, name: "Stanislas & Margue" }],
  };
}

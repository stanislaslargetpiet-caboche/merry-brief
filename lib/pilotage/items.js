// Liste d'actions du pilotage : capture, rangement des tâches et fil du jour, qui réunit les tâches, le plan du
// réseau, les demandes d'accès et les alertes. Fonctions pures, testées (tests/pilotageItems.test.js).

import { nextWorkday } from "@/lib/server/pilotage/reseau";

export const RECURRENCES = [
  { id: "", label: "Une fois" },
  { id: "quotidien", label: "Chaque jour" },
  { id: "hebdo", label: "Chaque semaine" },
  { id: "mensuel", label: "Chaque mois" },
];

const TAGS = { tache: "Tâche", decision: "Décision", campagne: "Campagne" };
const TYPES_LISTE = new Set(Object.keys(TAGS));
const SAISIE = new Set(["tache", "decision"]);
const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const NOON = "T12:00:00Z";
const JOUR_ISO = /^\d{4}-\d{2}-\d{2}$/;

const addDays = (jour, n) => new Date(Date.parse(`${jour}${NOON}`) + n * 86400000).toISOString().slice(0, 10);

function addMonth(jour) {
  const d = new Date(`${jour}${NOON}`);
  const quantieme = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 1);
  const dernier = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(quantieme, dernier));
  return d.toISOString().slice(0, 10);
}

// « Lundi 9 novembre. »
export function titreJour(jour) {
  const texte = new Date(`${jour}${NOON}`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  return `${texte.charAt(0).toUpperCase()}${texte.slice(1)}.`;
}

// Ce que la capture comprend : « Appeler Astrid demain #perso ! » ; `defaut` est le jour pris sans date écrite
export function parseCapture(texte, today, defaut = null) {
  let reste = String(texte ?? "").trim();
  let priorite = 0;
  let projet = "";
  let echeance = defaut;
  if (/(^|\s)!$/.test(reste)) {
    priorite = 1;
    reste = reste.replace(/\s*!$/, "");
  }
  reste = reste.replace(/(^|\s)#([\p{L}\p{N}-]{1,40})(?=\s|$)/u, (_, debut, mot) => {
    projet = `${mot.charAt(0).toUpperCase()}${mot.slice(1)}`;
    return debut;
  });
  const fin = reste.trim().match(/(?:^|\s)(aujourd['’]hui|demain|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)$/i);
  if (fin) {
    const mot = fin[1].toLowerCase();
    if (mot === "demain") echeance = addDays(today, 1);
    else if (mot.startsWith("aujourd")) echeance = today;
    else {
      const ecart = (JOURS.indexOf(mot) - new Date(`${today}${NOON}`).getUTCDay() + 7) % 7;
      echeance = addDays(today, ecart || 7);
    }
    reste = reste.trim().slice(0, -fin[0].length);
  }
  return { titre: reste.replace(/\s+/g, " ").trim(), echeance, projet, priorite };
}

// Champs modifiables, relus côté serveur ; renvoie { ok, valeur } ou { ok: false, erreur }
export function validateItem(body, { creation = false } = {}) {
  const valeur = {};
  if (creation || "titre" in body) {
    const titre = String(body.titre ?? "").trim();
    if (!titre || titre.length > 300) return { ok: false, erreur: "titre" };
    valeur.titre = titre;
  }
  if (creation) {
    const type = String(body.type ?? "tache");
    if (!SAISIE.has(type)) return { ok: false, erreur: "type" };
    valeur.type = type;
  }
  if ("echeance" in body) {
    const echeance = body.echeance || null;
    if (echeance !== null && !JOUR_ISO.test(String(echeance))) return { ok: false, erreur: "echeance" };
    valeur.echeance = echeance;
  }
  if ("projet" in body) {
    const projet = String(body.projet ?? "").trim();
    if (projet.length > 40) return { ok: false, erreur: "projet" };
    valeur.projet = projet;
  }
  if ("priorite" in body) {
    if (![0, 1].includes(body.priorite)) return { ok: false, erreur: "priorite" };
    valeur.priorite = body.priorite;
  }
  if ("recurrence" in body) {
    if (!RECURRENCES.some((r) => r.id === body.recurrence)) return { ok: false, erreur: "recurrence" };
    valeur.recurrence = body.recurrence;
  }
  return { ok: true, valeur };
}

// Prochaine date d'une tâche récurrente : toujours après aujourd'hui, même si elle a pris du retard
function prochaine(echeance, recurrence, today) {
  let jour = echeance || today;
  do {
    jour = recurrence === "quotidien" ? addDays(jour, 1) : recurrence === "hebdo" ? addDays(jour, 7) : addMonth(jour);
  } while (jour <= today);
  return jour;
}

// Traduit un geste sur une ligne en champs à écrire ; renvoie { ok, valeur } ou { ok: false, erreur }
export function itemAction(item, body, today, now = new Date().toISOString()) {
  const action = String(body?.action ?? "");
  if (action === "fait") {
    if (item.recurrence) return { ok: true, valeur: { echeance: prochaine(item.echeance, item.recurrence, today) } };
    return { ok: true, valeur: { statut: "fait", fait_le: now } };
  }
  if (action === "rouvrir") return { ok: true, valeur: { statut: "a_faire", fait_le: null } };
  if (action === "plus_tard") return { ok: true, valeur: { echeance: nextWorkday(today) } };
  if (action === "modifier") return validateItem(body);
  return { ok: false, erreur: "action" };
}

const parUrgence = (a, b) => b.priorite - a.priorite || String(a.echeance || "9").localeCompare(String(b.echeance || "9")) || String(a.cree_le).localeCompare(String(b.cree_le));

// Page Tâches : à trier d'abord, puis par échéance ; un jour passé reste dans Aujourd'hui
export function rangerTaches(items, today) {
  const ouvertes = items.filter((i) => TYPES_LISTE.has(i.type) && i.statut === "a_faire").sort(parUrgence);
  const semaine = addDays(today, 7);
  return [
    { id: "trier", label: "À trier", lignes: ouvertes.filter((i) => !i.echeance) },
    { id: "jour", label: "Aujourd'hui", lignes: ouvertes.filter((i) => i.echeance && i.echeance <= today) },
    { id: "semaine", label: "Cette semaine", lignes: ouvertes.filter((i) => i.echeance > today && i.echeance < semaine) },
    { id: "tard", label: "Plus tard", lignes: ouvertes.filter((i) => i.echeance >= semaine) },
  ].filter((g) => g.lignes.length);
}

function pageAlerte(titre) {
  if (/référencement|sitemap|robots|search console/i.test(titre)) return "/pilotage/croissance/referencement";
  if (/mail/i.test(titre)) return "/pilotage/coulisses/mails";
  if (/clic|javascript|bug|déploiement/i.test(titre)) return "/pilotage/coulisses/bugs";
  return "/pilotage/coulisses/sante";
}

const ORDRE = { alerte: 0, demande: 1, reseau: 2, item: 3, vigilance: 4 };

// Le fil du jour. Chaque ligne : { cle, source, id, tag, tone, titre, sous, lien }.
// Une alerte vue reste écartée tant que son texte ne change pas : sa clé contient son titre.
export function buildFil({ items = [], reseau, demandes, sante = [], today }) {
  const vues = new Set(items.filter((i) => i.type === "alerte").map((i) => i.cle));
  const fil = [];
  for (const i of [...items].filter((x) => TYPES_LISTE.has(x.type) && x.statut === "a_faire" && x.echeance && x.echeance <= today).sort(parUrgence)) {
    const retard = i.echeance < today;
    fil.push({ cle: i.id, source: "item", id: i.id, tag: TAGS[i.type], tone: retard ? "warn" : "neutral", titre: i.titre, sous: retard ? "En retard" : i.detail, lien: i.lien, rang: ORDRE.item });
  }
  const plan = reseau?.plan?.jour === today ? reseau.plan : null;
  for (const c of plan?.creneaux || []) {
    for (const l of c.lignes.filter((x) => x.statut === "a_faire")) {
      const sous = l.nom ? l.titre || [l.entreprise, l.message ? "message prêt" : ""].filter(Boolean).join(" · ") : l.message ? "Message prêt" : "";
      fil.push({ cle: `plan:${l.id}`, source: "plan", id: l.id, tag: "Réseau", tone: "neutral", titre: l.nom || l.titre, sous, lien: "/pilotage/reseau/plan", rang: ORDRE.reseau });
    }
  }
  for (const c of reseau?.a_faire || []) {
    fil.push({ cle: `contact:${c.id}`, source: "contact", id: c.id, tag: "Réseau", tone: c.date_action < today ? "warn" : "neutral", titre: c.nom, sous: c.prochaine_action || c.entreprise, lien: "/pilotage/reseau/pipeline", rang: ORDRE.reseau });
  }
  const attente = demandes?.disponible ? demandes.en_attente : [];
  if (attente.length) {
    fil.push({ cle: "demandes", source: "demande", tag: "Demande", tone: "warn", titre: `${attente.length} demande(s) d'accès à une fiche`, sous: "À valider", lien: "/pilotage/coulisses/demandes", rang: ORDRE.demande });
  }
  for (const s of sante) {
    if ((s.tone !== "bad" && s.tone !== "warn") || /demande\(s\) d'accès/.test(s.titre)) continue;
    const cle = `alerte:${s.titre}`.slice(0, 320);
    if (vues.has(cle)) continue;
    fil.push({ cle, source: "alerte", tag: s.tone === "bad" ? "Alerte" : "À voir", tone: s.tone, titre: s.titre, sous: s.detail, lien: pageAlerte(s.titre), rang: s.tone === "bad" ? ORDRE.alerte : ORDRE.vigilance });
  }
  return fil.sort((a, b) => a.rang - b.rang);
}

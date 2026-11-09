// Liste d'actions du pilotage : capture, rangement des tâches et fil du jour, qui réunit les tâches, le plan du
// réseau, les demandes d'accès et les alertes. Fonctions pures, testées (tests/pilotageItems.test.js).

import { estBug, titreBug } from "@/lib/pilotage/agent";
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

export const RUBRIQUES = { news: "News of the Day", feature: "Feature of the Day" };
export const LANGUES = ["fr", "en"];
export const PROJET_HISTORIQUE = "Historique";
const HISTORIQUE_MAX = 100000;
const PARTIE_MAX = 11000;

// Ce qu'une routine dépose pour la page Aujourd'hui, une ligne par rubrique et par jour ; renvoie { ok, valeur } ou { ok: false, erreur }
export function validatePublication(body, today) {
  const rubrique = String(body?.rubrique ?? "");
  const titre = String(body?.titre ?? "").trim();
  const detail = String(body?.detail ?? "").trim();
  const lien = String(body?.lien ?? "").trim();
  const contenu = String(body?.contenu ?? "").trim();
  if (!RUBRIQUES[rubrique]) return { ok: false, erreur: "rubrique" };
  if (!titre || titre.length > 300) return { ok: false, erreur: "titre" };
  if (detail.length > 1000) return { ok: false, erreur: "detail" };
  if (contenu.length > 12000) return { ok: false, erreur: "contenu" };
  if (lien && (lien.length > 500 || !lien.startsWith("https://"))) return { ok: false, erreur: "lien" };
  const langue = body?.langue == null ? "" : String(body.langue);
  if (langue && !LANGUES.includes(langue)) return { ok: false, erreur: "langue" };
  return { ok: true, valeur: { type: "lecture", projet: RUBRIQUES[rubrique], titre, detail, contenu, lien, echeance: today, cle: `${rubrique}:${today}${langue ? `:${langue}` : ""}` } };
}

// Langue d'une édition, lue dans sa clé (« news:2026-11-08:en ») ; "" pour les éditions d'avant le choix de langue
export const langueEdition = (item) => String(item?.cle ?? "").match(/:(fr|en)$/)?.[1] ?? "";

// L'édition la plus récente d'une rubrique, dans la langue choisie quand elle existe, sinon la version sans langue, sinon l'autre
export function choisirLecture(items, projet, langue) {
  const lectures = items.filter((i) => i.type === "lecture" && i.projet === projet);
  const jour = lectures.reduce((max, i) => (String(i.echeance) > max ? String(i.echeance) : max), "");
  const du = lectures.filter((i) => String(i.echeance) === jour);
  return du.find((i) => langueEdition(i) === langue) || du.find((i) => !langueEdition(i)) || du[0] || null;
}

// Fenêtre de lecture de la mémoire d'une rubrique ; renvoie { ok, rubrique, depuis } ou { ok: false, erreur }
export function validateLectureMemoire(rubrique, jours, today) {
  if (!RUBRIQUES[rubrique]) return { ok: false, erreur: "rubrique" };
  const n = Number(jours ?? 120);
  if (!Number.isInteger(n) || n < 1 || n > 365) return { ok: false, erreur: "jours" };
  return { ok: true, rubrique, depuis: addDays(today, -n) };
}

// Historique antérieur au pilotage, découpé en lignes de pilotage_items sans couper une ligne de texte : la colonne contenu est bornée
export function validateHistorique(body) {
  const rubrique = String(body?.rubrique ?? "");
  const texte = String(body?.historique ?? "").trim();
  if (!RUBRIQUES[rubrique]) return { ok: false, erreur: "rubrique" };
  if (!texte || texte.length > HISTORIQUE_MAX) return { ok: false, erreur: "historique" };
  const parties = [""];
  for (const ligne of texte.split("\n")) {
    if (ligne.length > PARTIE_MAX) return { ok: false, erreur: "ligne" };
    if (parties.at(-1).length + ligne.length + 1 > PARTIE_MAX) parties.push("");
    parties[parties.length - 1] += `${ligne}\n`;
  }
  const lignes = parties.map((contenu, i) => {
    const numero = String(i + 1).padStart(2, "0");
    return { type: "lecture", projet: PROJET_HISTORIQUE, titre: `${RUBRIQUES[rubrique]}, historique ${numero}`, contenu: contenu.trim(), cle: `historique:${rubrique}:${numero}` };
  });
  return { ok: true, rubrique, lignes };
}

// Découpe une édition en blocs : { type: "titre" | "liste" | "texte", ... }, le gras et les liens https restant dans `morceaux`
export function lireEdition(texte) {
  const morceaux = (ligne) =>
    ligne
      .split(/(\*\*[^*]+\*\*|\[[^\]]+\]\(https:\/\/[^)\s]+\))/)
      .filter(Boolean)
      .map((m) => {
        const lien = m.match(/^\[([^\]]+)\]\((https:[^)]+)\)$/);
        if (lien) return { lien: lien[2], texte: lien[1] };
        return m.startsWith("**") && m.endsWith("**") ? { gras: m.slice(2, -2) } : { texte: m };
      });
  const blocs = [];
  for (const brute of String(texte ?? "").split("\n")) {
    const ligne = brute.trim();
    if (!ligne) continue;
    const puce = ligne.match(/^(?:-|\d+\.)\s+(.*)$/);
    if (/^\*\*[^*a-z]+\*\*:?$/.test(ligne)) blocs.push({ type: "titre", texte: ligne.replace(/[*:]/g, "") });
    else if (puce) {
      if (blocs.at(-1)?.type !== "liste") blocs.push({ type: "liste", lignes: [] });
      blocs.at(-1).lignes.push(morceaux(puce[1]));
    } else blocs.push({ type: "texte", morceaux: morceaux(ligne) });
  }
  return blocs;
}

// Prochaine date d'une tâche récurrente : toujours après aujourd'hui, même si elle a pris du retard
function prochaine(echeance, recurrence, today) {
  let jour = echeance || today;
  do {
    jour = recurrence === "quotidien" ? addDays(jour, 1) : recurrence === "hebdo" ? addDays(jour, 7) : addMonth(jour);
  } while (jour <= today);
  return jour;
}

const cap = (t) => `${t.charAt(0).toUpperCase()}${t.slice(1)}`;
const ecartJours = (jour, today) => Math.round((Date.parse(`${jour}${NOON}`) - Date.parse(`${today}${NOON}`)) / 86400000);
const abrege = (jour) => cap(new Date(`${jour}${NOON}`).toLocaleDateString("fr-FR", { weekday: "short", timeZone: "UTC" }).replace(".", ""));

// L'échéance telle qu'on la lit sous un titre : { texte, ton }, ton valant jour | demain | semaine | plus-tard | retard ; null sans date
export function libelleEcheance(echeance, today) {
  if (!echeance) return null;
  const ecart = ecartJours(echeance, today);
  if (ecart === 0) return { texte: "Aujourd'hui", ton: "jour" };
  if (ecart === 1) return { texte: "Demain", ton: "demain" };
  if (ecart === -1) return { texte: "Hier", ton: "retard" };
  if (ecart > 1 && ecart < 7) return { texte: cap(new Date(`${echeance}${NOON}`).toLocaleDateString("fr-FR", { weekday: "long", timeZone: "UTC" })), ton: "semaine" };
  const memeAnnee = echeance.slice(0, 4) === today.slice(0, 4);
  const texte = new Date(`${echeance}${NOON}`).toLocaleDateString("fr-FR", { day: "numeric", month: "short", ...(memeAnnee ? {} : { year: "numeric" }), timeZone: "UTC" }).replace(".", "");
  return { texte, ton: ecart < 0 ? "retard" : "plus-tard" };
}

// Les choix rapides du sélecteur de date : { id, label, jour, repere } (aujourd'hui, demain, samedi, lundi suivant)
export function raccourcisDate(today) {
  const dow = new Date(`${today}${NOON}`).getUTCDay();
  const weekend = addDays(today, (6 - dow + 7) % 7 || 7);
  const semaine = addDays(today, (1 - dow + 7) % 7 || 7);
  const demain = addDays(today, 1);
  return [
    { id: "jour", label: "Aujourd'hui", jour: today, repere: abrege(today) },
    { id: "demain", label: "Demain", jour: demain, repere: abrege(demain) },
    { id: "weekend", label: "Ce week-end", jour: weekend, repere: abrege(weekend) },
    { id: "semaine", label: "Semaine prochaine", jour: semaine, repere: `${abrege(semaine)} ${new Date(`${semaine}${NOON}`).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" }).replace(".", "")}` },
  ];
}

// Le mois du calendrier, semaines du lundi au dimanche : { titre, semaines: [[{ jour, dansMois }]] } ; mois vaut « 2026-11 »
export function grilleMois(mois) {
  const [annee, m] = mois.split("-").map(Number);
  const decalage = (new Date(Date.UTC(annee, m - 1, 1, 12)).getUTCDay() + 6) % 7;
  const nb = new Date(Date.UTC(annee, m, 0)).getUTCDate();
  const debut = addDays(`${mois}-01`, -decalage);
  const semaines = Array.from({ length: Math.ceil((decalage + nb) / 7) }, (_, s) =>
    Array.from({ length: 7 }, (_, k) => {
      const jour = addDays(debut, s * 7 + k);
      return { jour, dansMois: jour.startsWith(mois) };
    }),
  );
  return { titre: new Date(Date.UTC(annee, m - 1, 1, 12)).toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }), semaines };
}

// Le mois d'avant ou d'après : n vaut -1 ou 1
export const moisDecale = (mois, n) => {
  const [annee, m] = mois.split("-").map(Number);
  return new Date(Date.UTC(annee, m - 1 + n, 1, 12)).toISOString().slice(0, 7);
};

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

// Le fil n'est complet qu'une fois la liste et les indicateurs lus : sans eux, il manque le réseau, les demandes et les alertes
export function etatFil({ charge, err, indicateurs = "lus" }) {
  if (!charge && err) return { complet: false, message: "Liste non lue" };
  if (!charge || indicateurs === "lecture") return { complet: false, message: "Lecture de la liste et des indicateurs…" };
  if (indicateurs === "erreur") return { complet: false, message: "Réseau, demandes et alertes non lus" };
  return { complet: true, message: "Rien pour aujourd'hui" };
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
    if (estBug(i)) {
      fil.push({ cle: i.id, source: "item", id: i.id, groupe: "bugs", tag: "Bug", tone: "bad", titre: titreBug(i.titre), sous: i.detail, retard, lien: i.lien, item: i, rang: ORDRE.item });
      continue;
    }
    fil.push({ cle: i.id, source: "item", id: i.id, groupe: "taches", tag: TAGS[i.type], tone: retard ? "warn" : "neutral", titre: i.titre, sous: retard ? "En retard" : i.detail, retard, prioritaire: !!i.priorite, projet: i.projet, lien: i.lien, rang: ORDRE.item });
  }
  const plan = reseau?.plan?.jour === today ? reseau.plan : null;
  for (const c of plan?.creneaux || []) {
    for (const l of c.lignes.filter((x) => x.statut === "a_faire")) {
      const sous = l.nom ? l.titre || [l.entreprise, l.message ? "message prêt" : ""].filter(Boolean).join(" · ") : l.message ? "Message prêt" : "";
      fil.push({ cle: `plan:${l.id}`, source: "plan", id: l.id, groupe: "reseau", tag: c.label || "Réseau", tone: "neutral", titre: l.nom || l.titre, sous, canal: l.canal || "", creneau: c.id, pret: !!l.message, lien: "/pilotage/reseau/plan", rang: ORDRE.reseau });
    }
  }
  for (const c of reseau?.a_faire || []) {
    fil.push({ cle: `contact:${c.id}`, source: "contact", id: c.id, groupe: "reseau", tag: "Relance", tone: c.date_action < today ? "warn" : "neutral", titre: c.nom, sous: c.prochaine_action || c.entreprise, canal: c.canal || "", creneau: "relance", retard: c.date_action < today, lien: "/pilotage/reseau/pipeline", rang: ORDRE.reseau });
  }
  const attente = demandes?.disponible ? demandes.en_attente : [];
  if (attente.length) {
    fil.push({ cle: "demandes", source: "demande", groupe: "alertes", tag: "Demande", tone: "warn", titre: `${attente.length} demande(s) d'accès à une fiche`, sous: "À valider", lien: "/pilotage/coulisses/demandes", rang: ORDRE.demande });
  }
  for (const s of sante) {
    if ((s.tone !== "bad" && s.tone !== "warn") || /demande\(s\) d'accès/.test(s.titre)) continue;
    const cle = `alerte:${s.titre}`.slice(0, 320);
    if (vues.has(cle)) continue;
    fil.push({ cle, source: "alerte", groupe: "alertes", tag: s.tone === "bad" ? "Alerte" : "À voir", tone: s.tone, titre: s.titre, sous: s.detail, lien: pageAlerte(s.titre), rang: s.tone === "bad" ? ORDRE.alerte : ORDRE.vigilance });
  }
  return fil.sort((a, b) => a.rang - b.rang);
}

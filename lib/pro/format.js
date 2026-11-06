// Espace prestataire : textes et petits calculs partagés par les pages

import { daysBetween, euros, isoDate, shortDate, toDate, today } from "@/lib/dash/format";
import { OK_BG, OK_INK, pastel, PASTEL_KEYS } from "@/lib/dash/theme";

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const DAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const DAYS_SHORT = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

// Demandes lues (maquette Messagerie) : pas de colonne "vue" côté base, la lecture reste
// propre au navigateur. `PRO_SEEN_EVENT` prévient la barre latérale (badge Messagerie) quand
// la liste lue change ailleurs dans la page, puisque le localStorage ne déclenche pas
// d'évènement "storage" dans l'onglet qui écrit lui-même.
export const PRO_SEEN_KEY = "merry-pro-vues";
export const PRO_SEEN_EVENT = "merry-pro-vues-changed";

export function readSeenRequests() {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(window.localStorage.getItem(PRO_SEEN_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

export function writeSeenRequests(seen) {
  try {
    window.localStorage.setItem(PRO_SEEN_KEY, JSON.stringify([...seen]));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(PRO_SEEN_EVENT));
}

export function countUnreadRequests(requests) {
  const seen = readSeenRequests();
  return (requests || []).filter((r) => !r.answered && !seen.has(r.client_id)).length;
}

// Pastilles des couples (maquettes V1 à V6) : la couleur suit le nom
const FACES = ["#e0ebf6", "#ebe6fb", "#fbe5dc", "#fef6ef"];
export function faceColor(names) {
  let h = 0;
  for (const ch of String(names || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return FACES[h % FACES.length];
}

// Pastille d'un collaborateur (pro_members n'a pas de colonne couleur, contrairement à wedding_members) :
// une couleur de la même palette que les organisateurs, qui suit son identifiant
export function collabColor(id) {
  let h = 0;
  for (const ch of String(id || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return pastel(PASTEL_KEYS[h % PASTEL_KEYS.length]);
}

// Couleurs d'avatar proposées aux collaborateurs : les pastels Merry, sans le gris
export const MEMBER_COLORS = PASTEL_KEYS.filter((k) => k !== "gris");

// Collaborateur : « Prénom Nom », sinon le nom saisi à l'invitation, sinon le mail
export function memberName(m) {
  return [m?.first_name, m?.last_name].filter(Boolean).join(" ").trim() || m?.display_name || m?.email || "";
}

export function memberInitial(m) {
  return (m?.first_name || m?.display_name || m?.email || "?").trim()[0]?.toUpperCase() || "?";
}

// La couleur choisie (colonne color) si elle existe, sinon celle qui suit l'identifiant
export function memberColor(m) {
  return MEMBER_COLORS.includes(m?.color) ? pastel(m.color) : collabColor(m?.id);
}

// Qui a écrit un message du prestataire : le collaborateur d'après son identifiant (nom et couleur à jour),
// sinon le nom renvoyé par la base ; null quand l'auteur est inconnu (messages d'avant les noms)
export function messageAuthor(msg, members, user) {
  const m = msg?.author_id ? (members || []).find((x) => x.id === msg.author_id) : null;
  if (m) return { name: memberName(m), initial: memberInitial(m), color: memberColor(m), mine: !!user && m.user_id === user.id };
  if (msg?.author_name) return { name: msg.author_name, initial: msg.author_name.trim()[0]?.toUpperCase() || "?", color: MEMBER_COLORS.includes(msg.author_color) ? pastel(msg.author_color) : pastel("gris"), mine: false };
  return null;
}

// « Alice & Ben » → « AB »
export function coupleInitials(names) {
  const parts = String(names || "")
    .split(/\s*(?:&|et)\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);
  return (parts.length > 1 ? parts.slice(0, 2).map((p) => p[0]) : [String(names || "?").trim()[0] || "?"]).join("").toUpperCase();
}

// « Camille » : le premier prénom du couple
export const firstName = (names) => String(names || "").split(/\s*(?:&|et)\s*/i)[0].trim();

// « 14 juin 2027 »
export function dateLong(d) {
  const x = toDate(d);
  return x ? `${x.getDate() === 1 ? "1er" : x.getDate()} ${MONTHS[x.getMonth()]} ${x.getFullYear()}` : "";
}

// « 18 sept. 2027 »
export const dateShortYear = (d) => shortDate(d, { year: true });

// « Juin 2027 »
export function monthYearCap(d) {
  const x = toDate(d);
  return x ? `${MONTHS[x.getMonth()].charAt(0).toUpperCase()}${MONTHS[x.getMonth()].slice(1)} ${x.getFullYear()}` : "";
}

export const monthName = (d) => {
  const x = toDate(d) || d;
  const m = MONTHS[x.getMonth()];
  return m.charAt(0).toUpperCase() + m.slice(1);
};

// « Lundi 26 octobre »
export function todayLabel() {
  const t = today();
  return `${DAYS[t.getDay()]} ${t.getDate() === 1 ? "1er" : t.getDate()} ${MONTHS[t.getMonth()]}`;
}

// « lun. 26 oct. »
export function dayShort(d) {
  const x = toDate(d);
  return x ? `${DAYS_SHORT[x.getDay()]} ${shortDate(x, { year: false })}` : "";
}

// « Samedi 19 juin 2027 »
export function dayLong(d) {
  const x = toDate(d);
  return x ? `${DAYS[x.getDay()]} ${dateLong(x)}` : "";
}

// Depuis quand : « Il y a 2 h », « Hier », « 12 oct. »
export function since(iso) {
  if (!iso) return "";
  const t = new Date(iso);
  const minutes = Math.round((Date.now() - t.getTime()) / 60000);
  if (minutes < 60) return minutes <= 1 ? "À l’instant" : `Il y a ${minutes} min`;
  const days = daysBetween(isoDate(t), isoDate(today()));
  if (days <= 0) return `Il y a ${Math.round(minutes / 60)} h`;
  if (days === 1) return "Hier";
  return shortDate(isoDate(t));
}

export const guestsText = (n) => (n ? `${n} invités` : "");

// Fourchettes du brief des couples
const GUESTS = { "<50": "moins de 50", "50-100": "50 à 100", "100-150": "100 à 150", "150-200": "150 à 200", ">200": "plus de 200" };
const BUDGETS = { "<15k": "Moins de 15 000 €", "15-30k": "15 000 à 30 000 €", "30-50k": "30 000 à 50 000 €", ">50k": "Plus de 50 000 €" };
export const guestsRange = (code) => (code ? `${GUESTS[code] || code} invités` : "");
export const budgetRange = (code) => BUDGETS[code] || "";

// Date du mariage telle que le couple l'a donnée (date précise, ou période quand les dates sont flexibles)
export function weddingWhen(c, { short = false } = {}) {
  if (c?.date_label && /flexible/i.test(c.date_label)) return c.date_label.replace(/^Dates flexibles\s*:\s*/i, "");
  if (c?.wedding_date) return short ? dateShortYear(c.wedding_date) : dateLong(c.wedding_date);
  return c?.dateLabel || "Date à définir";
}

// Étapes du suivi des clients (V6)
export const STAGES = [
  { key: "nouvelle", label: "Nouvelle demande" },
  { key: "devis", label: "Devis envoyé" },
  { key: "visite", label: "Visite prévue" },
  { key: "reserve", label: "Réservé" },
  { key: "perdu", label: "Perdu" },
];

// Couleurs pastel du statut d'une demande (bandeau de la Messagerie) : les statuts confirmés
// (réservé) restent au vert des statuts, le reste suit les pastels Merry.
export const STAGE_COLORS = {
  nouvelle: { bg: "#efeeea", ink: "#4d4c46" },
  devis: { bg: "#fbe5dc", ink: "#8c4229" },
  visite: { bg: "#e0ebf6", ink: "#2b5479" },
  reserve: { bg: OK_BG, ink: OK_INK },
  perdu: { bg: "#fde0de", ink: "#9b2c2c" },
};
export const stageColor = (key) => STAGE_COLORS[key] || STAGE_COLORS.nouvelle;

// Messagerie (maquette V1, Réservations/Anciens clients) : un client perdu, ou réservé pour une
// date déjà passée, bascule dans l'historique plutôt que dans le suivi actif.
export function isPastClient(c) {
  if (c.stage === "perdu") return true;
  if (c.stage !== "reserve") return false;
  const day = c.wedding_date;
  return Boolean(day) && day < isoDate(today());
}

// Coût en crédits de la première réponse à une demande, selon le métier (notes/projet.md, 27 oct. 2026 :
// 25 lieu, 20 traiteur, 15 photographe, 10 DJ, 8 fleuriste). Les autres métiers n'ont pas de prix arrêté :
// vidéaste aligné sur photographe, musiciens sur DJ, 10 par défaut. Même grille en base (pro_reply_cost).
export const REPLY_COSTS = { lieu: 25, traiteur: 20, photographe: 15, videaste: 15, dj: 10, musiciens: 10, fleuriste: 8 };
export const DEFAULT_REPLY_COST = 10;
export const replyCost = (category) => REPLY_COSTS[category] ?? DEFAULT_REPLY_COST;

// Prix : « 9 800 € », ou ce qui reste à remplir
export const price = (n) => (n === null || n === undefined || n === "" ? "Prix à définir" : euros(n));

export const UNIT_LABEL = { forfait: "Forfait", par_invite: "Par invité" };
export const OPTION_UNIT = { forfait: "", nuit: "la nuit", par_invite: "par invité", par_heure: "par heure" };

// Les dates des saisons sont écrites en toutes lettres (« 1 mai ») : la saison d'un jour donné
const MONTH_INDEX = Object.fromEntries(MONTHS.map((m, i) => [m, i]));
function monthDay(text) {
  const m = String(text || "")
    .toLowerCase()
    .match(/(\d{1,2})(?:er)?\s+([a-zéû]+)/);
  if (!m || MONTH_INDEX[m[2]] === undefined) return null;
  return MONTH_INDEX[m[2]] * 100 + Number(m[1]);
}
export function seasonOf(day, pro) {
  const x = toDate(day);
  const from = monthDay(pro?.high_from);
  const to = monthDay(pro?.high_to);
  if (!x || from === null || to === null) return "high";
  const md = x.getMonth() * 100 + x.getDate();
  const inside = from <= to ? md >= from && md <= to : md >= from || md <= to;
  return inside ? "high" : "low";
}

// Fiche complète à … % : ce qui compte pour les couples, et la prochaine étape à proposer
export function completeness(d) {
  const v = d.vendor || {};
  const det = v.details || {};
  const isLieu = v.primary_category === "lieu";
  const steps = [
    { done: (d.photos || []).length >= 5, label: "Ajoutez cinq photos", action: "Ajouter des photos", anchor: "photos" },
    { done: !!(v.description && v.description.trim().length >= 300), label: isLieu ? "Présentez votre lieu en quelques phrases" : "Présentez votre activité en quelques phrases", action: "Écrire la présentation", anchor: "presentation" },
    { done: (v.style_tags || []).length > 0, label: "Choisissez votre style", action: "Choisir le style", anchor: "presentation" },
    ...(isLieu
      ? [
          { done: !!v.capacity_seated, label: "Indiquez vos places assises", action: "Compléter", anchor: "lieu" },
          { done: det.caterer_imposed !== undefined && det.caterer_imposed !== null, label: "Dites si le traiteur est libre", action: "Compléter", anchor: "lieu" },
          { done: !!det.music_end, label: "Indiquez l’heure de fin de soirée", action: "Compléter", anchor: "lieu" },
          { done: !!(v.airport_minutes || v.station_minutes), label: "Vérifiez l’accès", action: "Vérifier", anchor: "acces" },
        ]
      : [
          { done: !!det.service_area, label: "Indiquez votre zone d’intervention", action: "Compléter", anchor: "activite" },
          { done: !!det.team_size, label: "Indiquez la taille de votre équipe", action: "Compléter", anchor: "activite" },
        ]),
    { done: (d.formulas || []).some((f) => f.price_low || f.price_high), label: "Ajoutez vos tarifs", action: "Ajouter les tarifs", href: "/pro/tarifs" },
    // Seul un lien (YouTube, Vimeo, Matterport) est montré aux couples ; un fichier importé ne compte pas encore
    { done: /^https?:\/\//i.test(String(det.video_url || "")), label: "Ajoutez une vidéo ou une visite virtuelle", action: "Ajouter la vidéo", anchor: "video" },
  ];
  const done = steps.filter((s) => s.done).length;
  return { pct: Math.round((done / steps.length) * 100), next: steps.find((s) => !s.done) || null };
}

// Temps de réponse moyen aux demandes, en heures, à partir des clients déjà répondus
export function responseStats(d) {
  const answered = (d.clients || []).filter((c) => c.answered_at && c.created_at);
  if (!answered.length) return null;
  const hours = answered.map((c) => (new Date(c.answered_at).getTime() - new Date(c.created_at).getTime()) / 3600000).filter((h) => h >= 0);
  if (!hours.length) return null;
  const avg = hours.reduce((a, b) => a + b, 0) / hours.length;
  return { avgHours: Math.round(avg), count: hours.length };
}

// Ce que les crédits dépensés ont rapporté : réservations obtenues et coût moyen par réservation
export function creditsRoi(d) {
  const used = (d.ledger || []).filter((l) => l.kind === "utilisation").reduce((sum, l) => sum + Math.abs(l.delta || 0), 0);
  const bookings = (d.clients || []).filter((c) => c.stage === "reserve").length;
  const answered = (d.clients || []).filter((c) => c.answered_at).length;
  return { used, bookings, answered, perBooking: bookings ? Math.round(used / bookings) : null };
}

// Ce qu'une demande rapporte : total d'une formule et de ses options (V5, « Merry calcule le total »)
export function quoteTotal({ formula, options, guests, season }) {
  if (!formula) return null;
  const base = season === "low" ? formula.price_low ?? formula.price_high : formula.price_high ?? formula.price_low;
  if (base === null || base === undefined) return null;
  let total = formula.unit === "par_invite" ? base * (guests || 0) : base;
  for (const o of options) {
    if (o.price === null || o.price === undefined) return null;
    total += o.unit === "par_invite" ? o.price * (guests || 0) : o.price;
  }
  return total;
}

export const todayIsoLocal = () => isoDate(today());

// Espace prestataire : textes et petits calculs partagés par les pages

import { daysBetween, euros, isoDate, shortDate, toDate, today } from "@/lib/dash/format";

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const DAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const DAYS_SHORT = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

// Pastilles des couples (maquettes V1 à V6) : la couleur suit le nom
const FACES = ["#e0ebf6", "#ebe6fb", "#fbe5dc", "#f4f5d6"];
export function faceColor(names) {
  let h = 0;
  for (const ch of String(names || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return FACES[h % FACES.length];
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
  const steps = [
    { done: (d.photos || []).length >= 5, label: "Ajoutez cinq photos", action: "Ajouter des photos", anchor: "photos" },
    { done: !!(v.description && v.description.length > 80), label: "Présentez votre lieu en quelques phrases", action: "Écrire la présentation", anchor: "presentation" },
    { done: (v.style_tags || []).length > 0, label: "Choisissez votre style", action: "Choisir le style", anchor: "presentation" },
    { done: !!v.capacity_seated, label: "Indiquez vos places assises", action: "Compléter", anchor: "lieu" },
    { done: det.caterer_imposed !== undefined && det.caterer_imposed !== null, label: "Dites si le traiteur est libre", action: "Compléter", anchor: "lieu" },
    { done: !!det.music_end, label: "Indiquez l’heure de fin de soirée", action: "Compléter", anchor: "lieu" },
    { done: (d.formulas || []).some((f) => f.price_low || f.price_high), label: "Ajoutez vos tarifs", action: "Ajouter les tarifs", href: "/pro/tarifs" },
    { done: !!(v.airport_minutes || v.station_minutes), label: "Vérifiez l’accès", action: "Vérifier", anchor: "acces" },
    { done: !!det.video_url, label: "Ajoutez une visite virtuelle", action: "Ajouter la visite", anchor: "video" },
  ];
  const done = steps.filter((s) => s.done).length;
  return { pct: Math.round((done / steps.length) * 100), next: steps.find((s) => !s.done) || null };
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

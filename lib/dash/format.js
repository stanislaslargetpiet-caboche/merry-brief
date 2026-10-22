// Formats français : montants, dates, pourcentages.

const NNBSP = "\u00a0";

export function euros(n, { signed = false } = {}) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "–";
  const v = Math.round(Number(n));
  const abs = Math.abs(v).toLocaleString("fr-FR").replace(/\s/g, NNBSP);
  const sign = v < 0 ? "−" : signed && v > 0 ? "+" : "";
  return `${sign}${abs}${NNBSP}€`;
}

export function pct(part, total) {
  if (!total) return 0;
  return Math.round((Number(part) / Number(total)) * 100);
}

export function pctLabel(part, total) {
  return `${pct(part, total)}${NNBSP}%`;
}

const MONTHS_SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

// Les dates arrivent en "AAAA-MM-JJ" : on les lit en heure locale pour éviter les décalages.
export function toDate(d) {
  if (!d) return null;
  if (d instanceof Date) return d;
  const [y, m, day] = String(d).slice(0, 10).split("-").map(Number);
  if (!y || !m || !day) return null;
  return new Date(y, m - 1, day);
}

export function isoDate(d) {
  const x = toDate(d) || d;
  if (!(x instanceof Date)) return null;
  const mm = String(x.getMonth() + 1).padStart(2, "0");
  const dd = String(x.getDate()).padStart(2, "0");
  return `${x.getFullYear()}-${mm}-${dd}`;
}

export function today() {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
}

export function todayIso() {
  return isoDate(today());
}

export function addDays(d, n) {
  const x = toDate(d);
  return new Date(x.getFullYear(), x.getMonth(), x.getDate() + n);
}

// Nombre de jours de a à b (négatif si b est avant a)
export function daysBetween(a, b) {
  return Math.round((toDate(b) - toDate(a)) / 86400000);
}

export function daysUntil(d) {
  const x = toDate(d);
  if (!x) return null;
  return Math.round((x - today()) / 86400000);
}

// « 25 oct. », avec l'année si elle diffère de l'année en cours
export function shortDate(d, { year = "auto" } = {}) {
  const x = toDate(d);
  if (!x) return "";
  const withYear = year === true || (year === "auto" && x.getFullYear() !== today().getFullYear() && daysUntil(x) > 300);
  const day = x.getDate() === 1 ? "1er" : String(x.getDate());
  return `${day} ${MONTHS_SHORT[x.getMonth()]}${withYear ? ` ${x.getFullYear()}` : ""}`;
}

// « Samedi 12 juin 2027 »
export function longDate(d) {
  const x = toDate(d);
  if (!x) return "";
  const s = `${DAYS[x.getDay()]} ${x.getDate() === 1 ? "1er" : x.getDate()} ${MONTHS[x.getMonth()]} ${x.getFullYear()}`;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// « 30 novembre »
export function dayMonth(d) {
  const x = toDate(d);
  if (!x) return "";
  return `${x.getDate() === 1 ? "1er" : x.getDate()} ${MONTHS[x.getMonth()]}`;
}

export function monthShort(d) {
  const x = toDate(d);
  return x ? MONTHS_SHORT[x.getMonth()] : "";
}

export function initials(name) {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function fullName(g) {
  return [g.first_name, g.last_name].filter(Boolean).join(" ").trim();
}

export function normalize(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9@.]+/g, " ")
    .trim();
}

export function parseAmount(s) {
  if (s === null || s === undefined || s === "") return null;
  const n = Number(String(s).replace(/\s| |€/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

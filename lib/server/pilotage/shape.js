// Mise en forme des indicateurs de pilotage : fonctions pures, sans accès réseau, testées dans tests/pilotage.test.js.

// Une série par jour couvre 2 × days jours : la seconde moitié est la période courante, la première la précédente.
export function splitSeries(rows, days) {
  const list = Array.isArray(rows) ? rows : [];
  const n = Math.max(1, days | 0);
  const current = list.slice(-n);
  const previous = list.slice(Math.max(0, list.length - 2 * n), Math.max(0, list.length - n));
  return { current, previous };
}

// Les 2 × days derniers jours (heure de Paris), du plus ancien au plus récent : l'axe commun des graphes,
// qui ne doit dépendre d'aucune source (une lecture Supabase en échec ne vide pas les graphes PostHog).
export function dayList(days, now = Date.now()) {
  const n = 2 * Math.max(1, days | 0);
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(new Date(now - i * 86400 * 1000).toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" }));
  return out;
}

// Heure de Paris d'un instant, « AAAA-MM-JJTHH » : la clé des séries par heure (filtres 24 h et 1 h)
export function cleHeure(ms) {
  return new Date(ms).toLocaleString("sv-SE", { timeZone: "Europe/Paris", hourCycle: "h23" }).slice(0, 13).replace(" ", "T");
}

// Les 48 dernières heures, de la plus ancienne à l'heure en cours : les 24 dernières heures et les 24 d'avant, heure
// pour heure
export function heureList(now = Date.now()) {
  const h0 = Math.floor(now / 3600000) * 3600000;
  return Array.from({ length: 48 }, (_, i) => cleHeure(h0 - (47 - i) * 3600000));
}

// Une clé de série sur l'axe : « 14 h » pour une heure, « 12 nov. » pour un jour
export function fmtCle(cle) {
  return String(cle || "").length > 10 ? `${Number(String(cle).slice(11, 13))} h` : fmtDay(cle);
}

export function sumBy(rows, key) {
  return (rows || []).reduce((acc, r) => acc + (Number(r?.[key]) || 0), 0);
}

// Total d'une période seulement si chaque jour a sa mesure : un jour à null (source pas encore en place) rendrait
// la comparaison fausse, la tuile n'affiche alors pas d'écart
export function sumMesure(rows, key) {
  return rows?.length && rows.every((r) => r?.[key] !== null && r?.[key] !== undefined) ? sumBy(rows, key) : null;
}

// Variation d'une période à l'autre : pct null quand la période précédente est à zéro (rien à comparer).
export function delta(current, previous) {
  const cur = Number(current) || 0;
  const prev = Number(previous) || 0;
  const diff = cur - prev;
  const pct = prev > 0 ? Math.round((diff / prev) * 100) : null;
  return { diff, pct, sens: diff > 0 ? "hausse" : diff < 0 ? "baisse" : "stable" };
}

// Les séries PostHog arrivent sous forme de lignes [jour, ...valeurs] et peuvent sauter les jours sans événement :
// on les cale sur la liste complète des jours (celle de Supabase) pour que les graphes se superposent. Une liste
// d'heures (heureList) se cale de même, sur des lignes [AAAA-MM-JJTHH, ...valeurs].
export function alignSeries(jours, rows, keys) {
  const byDay = new Map();
  const long = jours?.[0]?.length > 10 ? 13 : 10;
  for (const row of rows || []) {
    const [jour, ...vals] = row;
    byDay.set(String(jour).slice(0, long), vals);
  }
  return (jours || []).map((jour) => {
    const vals = byDay.get(jour) || [];
    const out = { jour };
    keys.forEach((k, i) => {
      out[k] = Number(vals[i]) || 0;
    });
    return out;
  });
}

// Chemins de l'appli ramenés à leur gabarit : /dashboard/budget/prestataires/<uuid> → /dashboard/budget/prestataires/:id
export function templatePath(path) {
  return String(path || "/")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id")
    .replace(/\/s\/[^/]+/, "/s/:slug")
    .replace(/\/f\/[^/]+/, "/f/:slug")
    .replace(/\/+$/, "") || "/";
}

export function fmtInt(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "–";
  return Number(n).toLocaleString("fr-FR");
}

// Montant en euros : deux décimales sous 100 €, entier au-delà
export function fmtEur(n) {
  const v = Number(n) || 0;
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: Math.abs(v) < 100 ? 2 : 0 }).format(v)} €`;
}

export function fmtPct(part, total) {
  const t = Number(total) || 0;
  if (!t || part === null || part === undefined) return "–";
  return `${Math.round(((Number(part) || 0) / t) * 100)} %`;
}

// Pourcentage d'un sous-ensemble, ou null quand une des deux mesures manque (la tuile affiche alors « – »)
export function pctOf(part, total) {
  const t = Number(total) || 0;
  if (!t || part === null || part === undefined) return null;
  return Math.round(((Number(part) || 0) / t) * 100);
}

export function fmtDuration(seconds) {
  const s = Math.round(Number(seconds) || 0);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m < 60) return r ? `${m} min ${String(r).padStart(2, "0")} s` : `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
}

export function fmtDateTime(iso) {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  return d.toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
}

// Heure d'un envoi, heure de Paris : « 14 h 05 » le jour même, « Hier à 18 h 40 », sinon « 8 nov. à 9 h 10 »
export function fmtHeure(iso, now = Date.now()) {
  const t = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(t)) return "–";
  const paris = { timeZone: "Europe/Paris" };
  const [h, m] = new Date(t).toLocaleTimeString("fr-FR", { ...paris, hour: "2-digit", minute: "2-digit" }).split(":");
  const heure = `${Number(h)} h ${m}`;
  const jour = (ms) => new Date(ms).toLocaleDateString("sv-SE", paris);
  const aujourdhui = jour(now);
  if (jour(t) === aujourdhui) return heure;
  if (jour(t) === jour(Date.parse(`${aujourdhui}T12:00:00Z`) - 86400000)) return `Hier à ${heure}`;
  return `${new Date(t).toLocaleDateString("fr-FR", { ...paris, day: "numeric", month: "short" })} à ${heure}`;
}

// « il y a 12 min », « il y a 3 h », « il y a 5 j » ; « jamais » sans date
export function fmtAgo(iso, now = Date.now()) {
  const t = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(t)) return "jamais";
  const min = Math.max(0, Math.round((now - t) / 60000));
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  return h < 48 ? `il y a ${h} h` : `il y a ${Math.floor(h / 24)} j`;
}

export function fmtDay(iso) {
  if (!iso) return "–";
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00Z`);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" });
}

// Une exception PostHog : un titre lisible à partir de $exception_list (tableau {type, value}) ou des anciens champs.
// Lien vers un replay PostHog, ouvert au moment clé repéré par le scanner quand il y en a un
export function replayUrl(session, momentMs) {
  const t = Number(momentMs);
  const base = `https://eu.posthog.com/project/321035/replay/${encodeURIComponent(session)}`;
  return t > 0 ? `${base}?t=${Math.floor(t / 1000)}` : base;
}

export function exceptionTitle(props) {
  const p = props || {};
  let list = p.$exception_list;
  if (typeof list === "string") {
    try {
      list = JSON.parse(list);
    } catch {
      list = null;
    }
  }
  const first = Array.isArray(list) ? list[0] : null;
  const type = first?.type || p.$exception_type || "Erreur";
  const value = first?.value || p.$exception_message || "";
  return value ? `${type} : ${value}` : type;
}

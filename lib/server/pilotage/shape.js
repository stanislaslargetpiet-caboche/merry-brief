// Mise en forme des indicateurs de pilotage : fonctions pures, sans accès réseau, testées dans tests/pilotage.test.js.

// Une série par jour couvre 2 × days jours : la seconde moitié est la période courante, la première la précédente.
export function splitSeries(rows, days) {
  const list = Array.isArray(rows) ? rows : [];
  const n = Math.max(1, days | 0);
  const current = list.slice(-n);
  const previous = list.slice(Math.max(0, list.length - 2 * n), Math.max(0, list.length - n));
  return { current, previous };
}

export function sumBy(rows, key) {
  return (rows || []).reduce((acc, r) => acc + (Number(r?.[key]) || 0), 0);
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
// on les cale sur la liste complète des jours (celle de Supabase) pour que les graphes se superposent.
export function alignSeries(jours, rows, keys) {
  const byDay = new Map();
  for (const row of rows || []) {
    const [jour, ...vals] = row;
    byDay.set(String(jour).slice(0, 10), vals);
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

export function fmtDay(iso) {
  if (!iso) return "–";
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00Z`);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" });
}

// Une exception PostHog : un titre lisible à partir de $exception_list (tableau {type, value}) ou des anciens champs.
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

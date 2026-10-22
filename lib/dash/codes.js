// Colonnes de codes : « D », « P », « L », « M », « C »… une lettre par ligne qui veut dire un groupe.
// Merry ne devine pas ce que ces lettres désignent : il repère la colonne, pose la question, puis applique
// la réponse ligne par ligne (la même pour tout le fichier, sans nouvel appel à l'IA).

import { normalize } from "@/lib/dash/format";

// Mots qui ne disent rien du groupe dans « Famille de Léopold », « Amis du marié »
const NOISE = new Set(["famille", "familles", "amis", "ami", "de", "du", "des", "la", "le", "les", "d", "l", "et", "au", "aux", "a"]);
const YES_NO = new Set(["oui", "o", "non", "n", "yes", "y", "no", "x", "ok"]);

const filled = (v) => {
  const t = String(v ?? "").trim();
  return t !== "" && !/^[-–—_.]+$/.test(t);
};

// Colonnes dont toutes les valeurs sont des codes de une à trois lettres, en petit nombre :
// [{ column, total, values: [{ key, label, n }] }], la colonne la mieux remplie d'abord.
// `skip` : colonnes déjà comprises (présence à un moment du mariage).
export function findCodeColumns(extras, skip = new Set()) {
  const rows = (extras || []).filter(Boolean);
  const byColumn = new Map();
  for (const ex of rows) {
    for (const [column, raw] of Object.entries(ex)) {
      if (skip.has(column) || !filled(raw)) continue;
      const label = String(raw).trim();
      const key = normalize(label);
      if (!byColumn.has(column)) byColumn.set(column, new Map());
      const seen = byColumn.get(column);
      const cur = seen.get(key) || { key, n: 0, spellings: new Map() };
      cur.n += 1;
      cur.spellings.set(label, (cur.spellings.get(label) || 0) + 1);
      seen.set(key, cur);
    }
  }
  const out = [];
  for (const [column, seen] of byColumn) {
    const values = [...seen.values()];
    const total = values.reduce((a, v) => a + v.n, 0);
    const codes = values.every((v) => /^[a-z]{1,3}$/.test(v.key));
    const flags = values.every((v) => YES_NO.has(v.key)); // oui / non : une réponse, pas un code
    if (!codes || flags || values.length < 2 || values.length > 9) continue;
    if (total < 6 || total < rows.length * 0.2) continue;
    out.push({
      column,
      total,
      values: values
        .sort((a, b) => b.n - a.n)
        .map((v) => ({ key: v.key, label: [...v.spellings.entries()].sort((a, b) => b[1] - a[1])[0][0], n: v.n })),
    });
  }
  return out.sort((a, b) => b.total - a.total);
}

const wordsOf = (name) =>
  String(name || "")
    .split(/[\s'’-]+/)
    .map((w) => normalize(w))
    .filter((w) => w && !NOISE.has(w));

// Un groupe existant qui correspond clairement au code : même nom, ou un seul groupe dont un mot commence par le code.
// Plusieurs candidats (« Famille de Léopold » et « Amis de Léopold » pour L) : on ne choisit pas à la place de l'organisateur.
export function suggestGroup(key, groups) {
  const exact = groups.filter((g) => normalize(g.name) === key);
  if (exact.length === 1) return exact[0].id;
  const hits = groups.filter((g) => wordsOf(g.name).some((w) => w.startsWith(key)));
  return hits.length === 1 ? hits[0].id : null;
}

// Réponse par défaut : la suggestion (marquée « proposé »), sinon rien
export function initialMap(values, groups) {
  const map = {};
  for (const v of values) {
    const id = suggestGroup(v.key, groups);
    map[v.key] = id ? { kind: "group", id, suggested: true } : { kind: "none" };
  }
  return map;
}

// Un choix → un groupe existant { id }, un groupe à créer { name, vid }, ou rien
export function resolvePick(pick, groups) {
  if (!pick) return null;
  if (pick.kind === "group") return pick.id ? { id: pick.id } : null;
  if (pick.kind === "new") {
    const name = String(pick.name || "").trim().slice(0, 60);
    if (!name) return null;
    const hit = groups.find((g) => normalize(g.name) === normalize(name));
    return hit ? { id: hit.id } : { name, vid: `v:${normalize(name)}` };
  }
  return null;
}

// Groupes à créer d'après les réponses (sans doublon), avec une couleur de la palette
export function groupsToCreate(maps, groups, colors) {
  const seen = new Map();
  for (const map of maps) {
    for (const pick of Object.values(map || {})) {
      const r = resolvePick(pick, groups);
      if (r?.vid && !seen.has(r.vid)) seen.set(r.vid, { id: r.vid, name: r.name, color: colors[(groups.length + seen.size) % colors.length] });
    }
  }
  return [...seen.values()];
}

// Valeurs d'une colonne déjà dans la liste, à raison d'un invité par ligne : [{ key, label, n }] si elles sont
// assez peu nombreuses (2 à 12) pour être rangées en groupes, sinon [].
export function columnValues(guests, fieldId) {
  const seen = new Map();
  for (const g of guests) {
    const raw = g.custom?.[fieldId];
    if (!filled(raw)) continue;
    const label = String(raw).trim();
    const key = normalize(label);
    if (!key) continue;
    const cur = seen.get(key) || { key, n: 0, spellings: new Map() };
    cur.n += 1;
    cur.spellings.set(label, (cur.spellings.get(label) || 0) + 1);
    seen.set(key, cur);
  }
  if (seen.size < 2 || seen.size > 12) return [];
  return [...seen.values()]
    .sort((a, b) => b.n - a.n)
    .map((v) => ({ key: v.key, label: [...v.spellings.entries()].sort((a, b) => b[1] - a[1])[0][0], n: v.n }));
}

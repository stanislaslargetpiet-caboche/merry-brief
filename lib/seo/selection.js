// Choix des six prestataires mis en avant sur une page SEO. Le tri de base reste celui de la lecture (photos,
// puis signal mariage). Pour les métiers dont le catalogue mélange des activités voisines (wedding planners,
// décoration, coiffure et maquillage), on y ajoute un rang d'après les catégories Google et le nom :
//   0  la fiche relève du métier (catégorie ou mot du nom qui le désigne),
//   1  rien ne la désigne ni ne l'écarte,
//   2  elle ressemble à un autre métier (un lieu rangé chez les wedding planners, un vidéaste…).
// Rien n'est exclu : une zone qui n'a que des fiches de rang 2 les affiche, en dernier. Fonction pure, testée.

// Tout se compare sans accents ni majuscules : « Chateau de Rajat » et « Château de Rajat » sont la même chose.
const fold = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const foldRx = (rx) => (rx ? new RegExp(fold(rx.source), rx.flags) : null);

const folded = new WeakMap();
function prepare(rule) {
  if (!folded.has(rule)) {
    folded.set(rule, {
      core: new Set(rule.core.map(fold)),
      coreName: foldRx(rule.coreName),
      other: foldRx(rule.other),
      otherName: foldRx(rule.otherName),
      strict: Boolean(rule.strict),
    });
  }
  return folded.get(rule);
}

export function selectionRank(row, rule) {
  if (!rule) return 1;
  const r = prepare(rule);
  const cats = (row.google_categories || []).map(fold);
  const name = fold(row.name);
  if (r.coreName && r.coreName.test(name)) return 0;
  const otherByCats = cats.some((c) => r.other.test(c));
  if (r.strict) {
    // Métier à catalogue très mélangé (wedding planners) : un nom de lieu l'emporte sur les catégories, et un
    // signal de lieu dans les catégories ne passe que si la première catégorie Google est celle du métier
    if (r.otherName && r.otherName.test(name)) return 2;
    if (cats.length && r.core.has(cats[0])) return 0;
    if (otherByCats) return 2;
    return cats.some((c) => r.core.has(c)) ? 0 : 1;
  }
  if (cats.some((c) => r.core.has(c))) return 0;
  if (otherByCats || (r.otherName && r.otherName.test(name))) return 2;
  return 1;
}

// `rows` arrive déjà trié (photos, signal mariage, id) : le tri par rang est stable et garde cet ordre dedans.
export function pickVendors(rows, trade, limit = 6) {
  const rule = trade?.selection;
  if (!rule) return (rows || []).slice(0, limit);
  return (rows || [])
    .map((row, i) => ({ row, i, rank: selectionRank(row, rule) }))
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.row);
}

// Combien de candidats lire avant de choisir : assez pour que les rangs 0 ne soient pas tous coupés par le tri
// sur les photos, sans lire tout le métier.
export const CANDIDATES = 150;

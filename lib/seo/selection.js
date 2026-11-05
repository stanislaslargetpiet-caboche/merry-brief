// Choix des six prestataires mis en avant sur une page SEO. Le tri de base reste celui de la lecture (photos,
// puis signal mariage). Pour les métiers dont le catalogue mélange des activités voisines (wedding planners,
// décoration, coiffure et maquillage), on y ajoute un rang d'après les catégories Google et le nom :
//   0  la fiche relève du métier (catégorie ou mot du nom qui le désigne),
//   1  rien ne la désigne ni ne l'écarte,
//   2  elle ressemble à un autre métier (un lieu rangé chez les wedding planners, un vidéaste…).
// Rien n'est exclu : une zone qui n'a que des fiches de rang 2 les affiche, en dernier. Fonction pure, testée.

const lower = (s) => String(s || "").toLowerCase();

export function selectionRank(row, rule) {
  if (!rule) return 1;
  const cats = (row.google_categories || []).map(lower);
  const name = lower(row.name);
  if (cats.some((c) => rule.core.includes(c)) || (rule.coreName && rule.coreName.test(name))) return 0;
  if (cats.some((c) => rule.other.test(c)) || (rule.otherName && rule.otherName.test(name))) return 2;
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

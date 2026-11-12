// Tri des tableaux du pilotage au clic sur un intitulé (Table de components/pilotage/ui.js). Fonctions pures, testées
// (tests/pilotageTri.test.js). Une colonne triable porte `sort(r)`, qui rend un nombre, un texte ou un booléen.

const vide = (v) => v === null || v === undefined || v === "" || Number.isNaN(v);

const comparer = (a, b) => (typeof a === "string" && typeof b === "string" ? a.localeCompare(b, "fr", { sensitivity: "base", numeric: true }) : Number(a) - Number(b));

// Premier sens d'un tri : croissant pour un texte (de A à Z), décroissant pour un nombre ou une date (le plus grand ou
// le plus récent d'abord)
export function sensInitial(rows, valeur) {
  const v = (rows || []).map(valeur).find((x) => !vide(x));
  return typeof v === "string" ? 1 : -1;
}

// Un clic sur l'intitulé : premier sens, puis l'autre sens, puis retour à l'ordre reçu (null)
export function triSuivant(tri, key, initial) {
  if (tri?.key !== key) return { key, sens: initial };
  return tri.sens === initial ? { key, sens: -initial } : null;
}

// `sens` : 1 croissant, -1 décroissant. Sans valeur : en bas dans les deux sens. `enBas(r)` garde des lignes (les
// couples de test) sous toutes les autres. À valeur égale, l'ordre reçu est gardé.
export function trier(rows, valeur, sens, enBas) {
  return (rows || [])
    .map((r, i) => ({ r, i, v: valeur(r), bas: Boolean(enBas?.(r)) }))
    .sort((a, b) => {
      if (a.bas !== b.bas) return a.bas ? 1 : -1;
      const va = vide(a.v);
      const vb = vide(b.v);
      if (va || vb) return va === vb ? a.i - b.i : va ? 1 : -1;
      return sens * comparer(a.v, b.v) || a.i - b.i;
    })
    .map((x) => x.r);
}

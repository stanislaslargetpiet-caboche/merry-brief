// Géométrie des graphes du pilotage : fonctions pures, testées (tests/pilotageGraphes.test.js). Le dessin est dans
// components/pilotage/ui.js ; la grammaire, sur le canvas, page « 10 - Pilotage », planche Pilotage-Graphes.

// Échelle d'un axe qui part de zéro : trois graduations rondes, la moitié tombe sur un nombre rond
export function echelle(valeur) {
  const v = Number(valeur) || 0;
  if (v <= 0) return { max: 2, ticks: [0, 1, 2] };
  const puissance = 10 ** Math.floor(Math.log10(v));
  const pas = [1, 2, 4, 6, 8, 10].map((m) => m * puissance).find((c) => c >= v);
  const max = Math.max(pas, 2);
  return { max, ticks: [0, max / 2, max] };
}

// Barre à bout arrondi, carrée sur la ligne de base
export function barPath(x, y, w, h, base) {
  if (h <= 0) return "";
  const r = Math.min(4, h, w / 2);
  return `M${x},${base}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${base}Z`;
}

// Pentes de l'interpolation monotone (Fritsch-Carlson) : la courbe passe par chaque point sans jamais le dépasser
function pentes(points) {
  const n = points.length;
  const d = [];
  for (let i = 0; i < n - 1; i++) d.push((points[i + 1].y - points[i].y) / (points[i + 1].x - points[i].x));
  const m = [d[0]];
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
  m.push(d[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const k = a * a + b * b;
    if (k > 9) {
      const t = 3 / Math.sqrt(k);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  return m;
}

export function courbePath(points) {
  if (!points.length) return "";
  const debut = `M${points[0].x},${points[0].y}`;
  if (points.length === 1) return debut;
  const m = pentes(points);
  let path = debut;
  for (let i = 0; i < points.length - 1; i++) {
    const p = points[i];
    const q = points[i + 1];
    const h = (q.x - p.x) / 3;
    path += `C${p.x + h},${p.y + m[i] * h} ${q.x - h},${q.y - m[i + 1] * h} ${q.x},${q.y}`;
  }
  return path;
}

// Jours où une date tient sur l'axe : tous s'ils ont la place, sinon le début, la coupure entre périodes et la fin
export function indicesAxe(n, largeurBande, coupure = 0) {
  if (largeurBande >= 44) return Array.from({ length: n }, (_, i) => i);
  const out = [0];
  if (coupure > 0 && coupure < n - 1) out.push(coupure);
  if (n > 1) out.push(n - 1);
  return out;
}

// Dates d'une courbe : réparties à intervalles égaux, au moins 72 px entre deux, la première et la dernière toujours
export function pasAxe(n, largeur) {
  const places = Math.min(n, Math.max(2, Math.floor(largeur / 72) + 1));
  return Array.from({ length: places }, (_, i) => Math.round((i * (n - 1)) / (places - 1)));
}

// Cumul jour par jour, calé pour que le dernier jour tombe sur le total connu
export function cumulSerie(rows, cle, total) {
  const list = rows || [];
  let courant = (Number(total) || 0) - list.reduce((acc, r) => acc + (Number(r?.[cle]) || 0), 0);
  return list.map((r) => {
    courant += Number(r?.[cle]) || 0;
    return { ...r, cumul: Math.max(0, courant) };
  });
}

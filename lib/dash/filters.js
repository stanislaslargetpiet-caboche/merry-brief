// Prestataires : les envies du couple (« Préciser mes envies ») deviennent des filtres stricts sur le
// catalogue (colonnes de supabase/catalog-filtres.sql). Un lieu qui contredit un filtre n'est jamais
// proposé. Les lieux dont l'information manque viennent après, « à confirmer », avec ce qu'il faut demander.

import { distanceKm } from "./provenceMap";

// Temps de route estimé depuis une ville choisie par le couple, d'après la distance à vol d'oiseau. Rapport
// mesuré sur 11 000 trajets réels (OSRM) des lieux vers leurs aéroports et gares : 1,23 min/km en médiane,
// 1,89 pour 95 % des trajets. On prend le haut : un lieu annoncé à moins d'une heure l'est presque toujours.
export const ROAD_MIN_PER_KM = 1.9;
export const ROAD_MIN_FIXED = 3;
export function roadMinutes(a, b) {
  return Math.round(distanceKm(a, b) * ROAD_MIN_PER_KM + ROAD_MIN_FIXED);
}

// « Près d'un aéroport » sans durée choisie : une heure au plus
const DEFAULT_MAX = 60;

// [{ key, col, op, value, label }] : col est une colonne de catalog.vendors
export function hardFilters(w) {
  if (!w) return [];
  const out = [];
  const add = (key, col, op, value, label) => out.push({ key, col, op, value, label });
  if (w.seats) add("seats", "capacity_seated", "gte", w.seats, "places assises");
  if (w.beds) add("beds", "beds", "gte", w.beds, "couchages");
  if (w.caterer === "libre") add("caterer", "caterer_imposed", "eq", false, "traiteur libre");
  if (w.caterer === "impose") add("caterer", "caterer_imposed", "eq", true, "traiteur du lieu");
  if ((w.access || []).includes("parking")) add("parking", "parking", "eq", true, "parking");
  if ((w.access || []).includes("pmr")) add("pmr", "accessible", "eq", true, "accès PMR");
  if ((w.venue || []).includes("ceremonie_exterieur")) add("ceremony", "outdoor_ceremony", "eq", true, "cérémonie en extérieur");
  if ((w.venue || []).includes("exclusivite")) add("exclusive", "exclusive_use", "eq", true, "exclusivité");
  if ((w.venue || []).includes("fin_tardive")) add("late", "late_party", "eq", true, "heure de fin de soirée");
  if (w.airport?.on) add("airport", "airport_minutes", "lte", w.airport.max || DEFAULT_MAX, "trajet depuis l'aéroport");
  if (w.station?.on) add("station", "station_minutes", "lte", w.station.max || DEFAULT_MAX, "trajet depuis la gare TGV");
  return out;
}

// « Près d'une ville » : toujours connu (position du lieu), contrôlé après la requête
export function cityFilter(w) {
  const name = w?.city?.name?.trim();
  return name ? { name, max: w.city.max || DEFAULT_MAX } : null;
}

const val = (v) => (typeof v === "boolean" ? String(v) : v);

// Lieux qui tiennent chaque filtre, preuve à l'appui
export function applyConfirmed(req, filters) {
  let q = req;
  for (const f of filters) q = q[f.op](f.col, f.value);
  return q;
}

// Lieux qui ne contredisent aucun filtre (valeur conforme, ou inconnue)
export function applyOpen(req, filters) {
  let q = req;
  for (const f of filters) q = q.or(`${f.col}.${f.op}.${val(f.value)},${f.col}.is.null`);
  return q;
}

// Ce qui reste à confirmer pour un lieu (filtres dont la valeur est inconnue)
export function unknownOf(row, filters) {
  return filters.filter((f) => row[f.col] === null || row[f.col] === undefined).map((f) => f.label);
}

export const FILTER_COLUMNS = ["capacity_seated", "beds", "caterer_imposed", "parking", "accessible", "outdoor_ceremony", "exclusive_use", "late_party", "airport_minutes", "station_minutes", "airport_name", "station_name"];

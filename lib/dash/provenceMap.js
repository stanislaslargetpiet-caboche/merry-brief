// Repère des cartes (canvas « Merry · Carte brief », artboards 7d, 7e, 7p et 7q) : 1000 × 1100 unités
// pour le Sud-Est de la maquette ; le fond de toute la France est dans lib/dash/franceMap.js.
// Projection calée sur les villes de la maquette
// (Marseille, Avignon, Nîmes, Toulon, Nice, Grenoble), assez juste pour placer un lieu à quelques km près.

export const MAP_W = 1000;
export const MAP_H = 1100;

const LNG0 = 5.3698;
const LAT0 = 43.2965;
const X0 = 493.3;
const Y0 = 750.6;
const KX = 221.75; // unités par degré de longitude
const KY = 308.3; // unités par degré de latitude

export function project(lat, lng) {
  return { x: X0 + (lng - LNG0) * KX, y: Y0 - (lat - LAT0) * KY };
}

export function unproject(x, y) {
  return { lat: LAT0 + (Y0 - y) / KY, lng: LNG0 + (x - X0) / KX };
}

// Distance à vol d'oiseau, en km
export function distanceKm(a, b) {
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r;
  const dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export const MAP_BG = "#f3eee2";


// Répartition des prix de départ (histogramme du filtre « Fourchette de prix »), de 0 à 30 000 €
export const PRICE_BARS = [4.3, 4.3, 8.7, 13.0, 17.3, 26.0, 34.7, 47.7, 39.0, 52.0, 43.3, 34.7, 39.0, 30.3, 21.7, 26.0, 17.3, 13.0, 13.0, 8.7, 8.7, 4.3, 4.3];

/*
 * Suggestions de lieux pour l'onboarding (« Où »), pour que le couple choisisse
 * un lieu existant plutôt que de taper un nom avec une faute.
 *
 * Source : Photon (komoot), moteur de recherche gratuit et sans clé sur les
 * données OpenStreetMap. Contrairement à l'API Adresse de l'État, il trouve
 * aussi les régions, massifs et sites naturels (« Golfe du Morbihan »,
 * « Massif du Luberon ») et couvre toute l'Europe.
 */

const ENDPOINT = "https://photon.komoot.io/api/";
// Europe seulement (ouest, sud, est, nord) : évite les Paris du Texas.
const EUROPE_BBOX = "-25,34,45,72";

// Ordre d'affichage par type de lieu ; les types absents (hameaux, rues,
// maisons isolées, parcs…) sont écartés.
const RANK = {
  state: 1,
  region: 1,
  province: 1,
  county: 2,
  bay: 2,
  peninsula: 2,
  archipelago: 2,
  island: 3,
  city: 3,
  town: 3,
  valley: 3,
  mountain_range: 3,
  municipality: 4,
  protected_area: 4,
  village: 5,
  suburb: 6,
};

const WITH_POSTCODE = ["city", "town", "village", "suburb", "municipality"];

function labelOf(p, homeCountry) {
  const parts = [p.name];
  if (p.postcode && WITH_POSTCODE.includes(p.osm_value)) parts.push(p.postcode.split(";")[0]);
  const area = [p.county, p.state].find((x) => x && x !== p.name);
  if (area) parts.push(area);
  if (p.country && p.country !== homeCountry) parts.push(p.country);
  return parts.join(", ");
}

/**
 * Cherche des lieux pour le texte saisi. Retourne au plus `limit` suggestions
 * { label, lat, lon }, ou lève une erreur si le service ne répond pas.
 */
export async function searchPlaces(query, { lang = "fr", limit = 6, signal } = {}) {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = `${ENDPOINT}?q=${encodeURIComponent(q)}&lang=${lang === "en" ? "en" : "fr"}&limit=15&bbox=${EUROPE_BBOX}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`photon ${res.status}`);
  const json = await res.json();
  const seen = new Set();
  const out = [];
  (json.features || []).forEach((f, i) => {
    const p = f.properties || {};
    const rank = RANK[p.osm_value];
    if (!rank || !p.name) return;
    const label = labelOf(p, "France");
    if (seen.has(label)) return;
    seen.add(label);
    const [lon, lat] = f.geometry?.coordinates || [];
    out.push({ rank, i, label, lat, lon });
  });
  return out
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .slice(0, limit)
    .map(({ label, lat, lon }) => ({ label, lat, lon }));
}

// « Aix » propose Aix-en-Provence avant Aix (Corrèze)
const TOWNS = ["city", "town", "municipality", "village"];

/**
 * Villes seulement, pour « Près d'une ville » dans les filtres : { name, sub, lat, lon },
 * sub = « 13090 · Bouches-du-Rhône » pour départager les homonymes.
 */
export async function searchTowns(query, { limit = 5, signal } = {}) {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = `${ENDPOINT}?q=${encodeURIComponent(q)}&lang=fr&limit=15&bbox=${EUROPE_BBOX}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`photon ${res.status}`);
  const json = await res.json();
  const seen = new Set();
  const out = [];
  const features = (json.features || []).filter((f) => TOWNS.includes(f.properties?.osm_value) && f.properties?.name);
  // La France d'abord, puis les villes avant les villages
  const order = (p) => (p.country === "France" ? 0 : 10) + Math.min(2, TOWNS.indexOf(p.osm_value));
  features.sort((a, b) => order(a.properties) - order(b.properties));
  for (const f of features) {
    const p = f.properties;
    const area = [p.county, p.state].find((x) => x && x !== p.name);
    const sub = [p.postcode ? p.postcode.split(";")[0] : null, area, p.country && p.country !== "France" ? p.country : null].filter(Boolean).join(" · ");
    const key = `${p.name}|${sub}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const [lon, lat] = f.geometry?.coordinates || [];
    out.push({ name: p.name, sub, lat, lon });
    if (out.length >= limit) break;
  }
  return out;
}

// Aéroport et gare TGV les plus proches, à partir de l'adresse exacte de la fiche. Géocodage par la
// Géoplateforme de l'IGN (gratuite, sans clé, déjà utilisée pour revendiquer une fiche : voir
// app/api/pro/claim/route.js). Le trajet est une estimation (distance à vol d'oiseau majorée, vitesse
// moyenne 75 km/h) : pas de routage réel, donc pas de clé Google Routes à payer.

const R_KM = 6371;
const toRad = (d) => (d * Math.PI) / 180;

function haversineKm(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R_KM * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function nearestOf(point, list) {
  let best = null;
  let bestKm = Infinity;
  for (const p of list) {
    const km = haversineKm(point, p);
    if (km < bestKm) {
      bestKm = km;
      best = p;
    }
  }
  if (!best) return null;
  return { name: best.name, minutes: Math.max(1, Math.round(((bestKm * 1.3) / 75) * 60)) };
}

// Position de l'adresse exacte de la fiche (rue, sinon la commune)
export async function geocodeAdresse({ address, postal_code, city }) {
  const ask = async (q, type) => {
    const u = new URL("https://data.geopf.fr/geocodage/search");
    u.searchParams.set("q", q);
    if (postal_code) u.searchParams.set("postcode", postal_code);
    u.searchParams.set("limit", "1");
    if (type) u.searchParams.set("type", type);
    try {
      const res = await fetch(u, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return null;
      return (await res.json()).features?.[0] || null;
    } catch {
      return null;
    }
  };
  const q1 = [address, postal_code, city].filter(Boolean).join(" ").trim();
  const hit = (q1 && (await ask(q1))) || (city ? await ask(`${postal_code || ""} ${city}`.trim(), "municipality") : null);
  if (!hit) return null;
  const [lng, lat] = hit.geometry.coordinates;
  return { lat, lng };
}

// Aéroport le plus proche et gare TGV la plus proche, à partir d'un point géocodé
export function nearestAccess(point) {
  return { airport: nearestOf(point, AIRPORTS), station: nearestOf(point, STATIONS) };
}

// Aéroports commerciaux de métropole, coordonnées approximatives de l'aérogare
export const AIRPORTS = [
  { name: "Paris Charles-de-Gaulle", lat: 49.0097, lng: 2.5479 },
  { name: "Paris Orly", lat: 48.7233, lng: 2.3794 },
  { name: "Paris Beauvais", lat: 49.4544, lng: 2.1128 },
  { name: "Nice Côte d'Azur", lat: 43.6584, lng: 7.2159 },
  { name: "Lyon Saint-Exupéry", lat: 45.7256, lng: 5.0811 },
  { name: "Marseille Provence", lat: 43.4393, lng: 5.2214 },
  { name: "Toulouse Blagnac", lat: 43.6293, lng: 1.3638 },
  { name: "Bordeaux Mérignac", lat: 44.8283, lng: -0.7156 },
  { name: "Nantes Atlantique", lat: 47.1532, lng: -1.6107 },
  { name: "Montpellier Méditerranée", lat: 43.5762, lng: 3.963 },
  { name: "Strasbourg", lat: 48.5383, lng: 7.6282 },
  { name: "Brest Bretagne", lat: 48.4479, lng: -4.4185 },
  { name: "Rennes", lat: 48.0695, lng: -1.7349 },
  { name: "Clermont-Ferrand Auvergne", lat: 45.7867, lng: 3.1692 },
  { name: "Biarritz Pays Basque", lat: 43.4684, lng: -1.5231 },
  { name: "Perpignan Rivesaltes", lat: 42.7404, lng: 2.8706 },
  { name: "Lille Lesquin", lat: 50.5633, lng: 3.0893 },
  { name: "Toulon Hyères", lat: 43.0973, lng: 6.146 },
  { name: "Pau Pyrénées", lat: 43.38, lng: -0.4186 },
  { name: "La Rochelle", lat: 46.1792, lng: -1.1953 },
  { name: "Tarbes Lourdes Pyrénées", lat: 43.1787, lng: -0.0065 },
  { name: "Bergerac Dordogne Périgord", lat: 44.8252, lng: 0.5192 },
  { name: "Chambéry Savoie", lat: 45.6381, lng: 5.8803 },
  { name: "Grenoble Alpes-Isère", lat: 45.3629, lng: 5.3294 },
  { name: "Carcassonne", lat: 43.216, lng: 2.3063 },
  { name: "Béziers Cap d'Agde", lat: 43.3236, lng: 3.3538 },
  { name: "Nîmes Garons", lat: 43.7574, lng: 4.4164 },
  { name: "Ajaccio Napoléon Bonaparte", lat: 41.9236, lng: 8.8029 },
  { name: "Bastia Poretta", lat: 42.5527, lng: 9.4837 },
  { name: "Calvi Sainte-Catherine", lat: 42.5307, lng: 8.793 },
  { name: "Figari Sud Corse", lat: 41.5006, lng: 9.0978 },
];

// Gares desservies en TGV, coordonnées approximatives
export const STATIONS = [
  { name: "Paris Gare de Lyon", lat: 48.8443, lng: 2.3744 },
  { name: "Paris Gare du Nord", lat: 48.8809, lng: 2.3553 },
  { name: "Paris Montparnasse", lat: 48.8406, lng: 2.3202 },
  { name: "Paris Gare de l'Est", lat: 48.8763, lng: 2.359 },
  { name: "Lyon Part-Dieu", lat: 45.7606, lng: 4.8599 },
  { name: "Marseille Saint-Charles", lat: 43.3028, lng: 5.3805 },
  { name: "Lille Europe", lat: 50.6395, lng: 3.0755 },
  { name: "Strasbourg", lat: 48.585, lng: 7.7347 },
  { name: "Bordeaux Saint-Jean", lat: 44.8256, lng: -0.5564 },
  { name: "Nantes", lat: 47.2173, lng: -1.5423 },
  { name: "Rennes", lat: 48.1035, lng: -1.6729 },
  { name: "Toulouse Matabiau", lat: 43.6112, lng: 1.4537 },
  { name: "Montpellier Saint-Roch", lat: 43.6043, lng: 3.8808 },
  { name: "Nice Ville", lat: 43.7043, lng: 7.262 },
  { name: "Avignon TGV", lat: 43.9213, lng: 4.7881 },
  { name: "Aix-en-Provence TGV", lat: 43.4553, lng: 5.3173 },
  { name: "Valence TGV", lat: 44.991, lng: 4.9743 },
  { name: "Le Mans", lat: 48.0022, lng: 0.1967 },
  { name: "Angers Saint-Laud", lat: 47.4639, lng: -0.5548 },
  { name: "Tours", lat: 47.39, lng: 0.69 },
  { name: "Poitiers", lat: 46.5797, lng: 0.339 },
  { name: "Reims", lat: 49.2497, lng: 4.0319 },
  { name: "Metz", lat: 49.1098, lng: 6.1778 },
  { name: "Nancy", lat: 48.6893, lng: 6.1709 },
  { name: "Besançon Franche-Comté TGV", lat: 47.2378, lng: 6.0307 },
  { name: "Dijon Ville", lat: 47.322, lng: 5.026 },
  { name: "Grenoble", lat: 45.1915, lng: 5.7159 },
  { name: "Chambéry Challes-les-Eaux", lat: 45.5646, lng: 5.944 },
  { name: "Annecy", lat: 45.8991, lng: 6.1296 },
  { name: "Perpignan", lat: 42.6974, lng: 2.8713 },
  { name: "Narbonne", lat: 43.1842, lng: 3.0075 },
  { name: "Béziers", lat: 43.3444, lng: 3.2243 },
  { name: "Nîmes", lat: 43.8322, lng: 4.3613 },
  { name: "Clermont-Ferrand", lat: 45.7795, lng: 3.0896 },
  { name: "Limoges Bénédictins", lat: 45.8384, lng: 1.2772 },
  { name: "La Rochelle Ville", lat: 46.1552, lng: -1.1476 },
  { name: "Brest", lat: 48.3903, lng: -4.4857 },
  { name: "Quimper", lat: 47.9988, lng: -4.1014 },
  { name: "Caen", lat: 49.1858, lng: -0.3661 },
  { name: "Rouen Rive Droite", lat: 49.4427, lng: 1.0931 },
  { name: "Amiens", lat: 49.8886, lng: 2.2975 },
  { name: "Bayonne", lat: 43.4931, lng: -1.4745 },
  { name: "Biarritz", lat: 43.465, lng: -1.552 },
  { name: "Pau", lat: 43.3005, lng: -0.365 },
  { name: "Toulon", lat: 43.1246, lng: 5.9303 },
];

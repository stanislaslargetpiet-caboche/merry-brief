// Prestataires : catégories, sélection d'exemple (celle du canvas, artboards 7 à 7v) et lecture du
// catalogue Merry (schéma « catalog » de supabase/catalog.sql, prestataires validés seulement).
// Tant que le catalogue n'a aucun prestataire validé dans la région, la page montre la sélection d'exemple et le dit.

import { supabase } from "@/lib/supabase";
import { distanceKm, project, unproject } from "./provenceMap";
import { applyConfirmed, applyOpen, FILTER_COLUMNS, hardFilters, ROAD_MIN_FIXED, ROAD_MIN_PER_KM, roadMinutes, unknownOf } from "./filters";

// Onglets de « Trouver des prestataires » et sections de « Mes prestataires »
export const CATEGORIES = [
  { key: "lieu", tab: "Lieux", one: "lieu", many: "lieux", label: "Lieu", group: "Lieux", groupOne: "Lieu", legend: "les lieux", legendOne: "le lieu", more: "Voir d’autres lieux", catalog: ["lieu"] },
  { key: "traiteur", tab: "Traiteurs", one: "traiteur", many: "traiteurs", label: "Traiteur", group: "Traiteurs", groupOne: "Traiteur", legend: "les traiteurs", legendOne: "le traiteur", more: "Voir d’autres traiteurs", near: "traiteurs", catalog: ["traiteur"] },
  { key: "dj", tab: "DJ et animation", one: "DJ", many: "DJ", label: "DJ et animation", group: "DJ et animation", groupOne: "DJ et animation", legend: "les DJ", legendOne: "le DJ", short: "DJ", more: "Voir d’autres DJ", near: "DJ et musiciens", catalog: ["dj", "musiciens"] },
  { key: "fleuriste", tab: "Fleuristes", one: "fleuriste", many: "fleuristes", label: "Fleuriste", group: "Fleuristes", groupOne: "Fleuriste", legend: "les fleuristes", legendOne: "le fleuriste", more: "Voir les fleuristes", near: "fleuristes", catalog: ["fleuriste"] },
  { key: "photographe", tab: "Photographes", one: "photographe", many: "photographes", label: "Photographe", group: "Photographes", groupOne: "Photographe", legend: "les photographes", legendOne: "le photographe", more: "Voir d’autres photographes", near: "photographes", catalog: ["photographe", "videaste"] },
  { key: "autre", tab: "Autres", one: "prestataire", many: "prestataires", label: "Prestataire", group: "Autres", groupOne: "Autre", legend: "les autres prestataires", legendOne: "l’autre prestataire", more: "Voir d’autres prestataires", near: "prestataires", catalog: ["decoration", "wedding_planner", "patisserie", "beaute", "robe", "transport", "officiant"] },
];

export const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));

export function catOf(key) {
  return CAT[key] || CAT.autre;
}

// Catégorie d'un prestataire du catalogue (primary_category)
export function catFromCatalog(slug) {
  return (CATEGORIES.find((c) => c.catalog.includes(slug)) || CAT.autre).key;
}

// « 3 lieux », « 1 traiteur »
export function countLabel(n, key) {
  const c = catOf(key);
  return `${n} ${n > 1 ? c.many : c.short || c.one}`;
}

const NUMBERS = ["Aucun", "Un", "Deux", "Trois", "Quatre", "Cinq", "Six", "Sept", "Huit", "Neuf", "Dix", "Onze", "Douze"];
// « Six lieux », en toutes lettres jusqu'à douze
export function inWords(n, key) {
  const c = catOf(key);
  const word = NUMBERS[n] || String(n);
  return `${word} ${n > 1 ? c.many : c.one}`;
}

export function initialsOf(name) {
  return String(name || "")
    .split(/[\s-]+/)
    .filter((w) => w && !/^(de|du|des|la|le|les|et|d’|l’)$/i.test(w))
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

// Point de la carte (repère du canvas) → coordonnées
const at = (x, y) => unproject(x, y);

const PHOTO = {
  oliviers: "/prestataires/domaine-des-oliviers.jpg",
  source: "/prestataires/mas-de-la-source.jpg",
  clair: "/prestataires/bastide-saint-clair.jpg",
};

// ---------------------------------------------------------------------------
// Sélection d'exemple : textes et chiffres repris tels quels du canvas
// ---------------------------------------------------------------------------

const VENUES = [
  {
    id: "exemple:domaine-des-oliviers",
    category: "lieu",
    name: "Domaine des Oliviers",
    area: "Luberon",
    place: "Luberon, Vaucluse",
    photos: [PHOTO.oliviers, null, null, null, null],
    best: true,
    negotiated: true,
    seats: 140,
    beds: 32,
    access: "35 min de l'aéroport de Marseille",
    airport: 35,
    station: 40,
    why: "traiteur libre, cérémonie en extérieur possible",
    price: 9800,
    unit: "la location",
    priceRange: "Selon la saison et le nombre d’invités : 9 800 à 14 500 €",
    // Page « Lieux » (7b)
    upTo: "Jusqu'à 200 invités · 24 couchages · 45 min d'Avignon",
    pitch: "Une grande tablée dans l’oliveraie, et vos proches logés sur place tout le week-end.",
    unitWeekend: "le week-end",
    // Fiche (7e)
    facts: [
      ["seat", "Places assises", "140 invités"],
      ["bed", "Couchages", "32 sur place"],
      ["plane", "Aéroport le plus proche", "Marseille Provence, 35 min"],
      ["train", "Gare TGV", "Avignon TGV, 40 min"],
      ["parking", "Parking", "80 places sur le domaine"],
      ["chef", "Traiteur", "Libre, vous choisissez"],
    ],
    included: ["Le domaine du samedi 10 h au dimanche 12 h", "Tables, chaises et vaisselle pour 140 invités", "Les 32 couchages pour vos proches", "Un régisseur présent toute la soirée"],
    estimate: { extra: 1600, note: "forfait nettoyage et électricité" },
    story:
      "Vous cherchez une fête champêtre chic en Provence pour 120 invités. Le domaine accueille jusqu’à 140 personnes à une seule grande tablée sous l’oliveraie, vous laisse choisir votre traiteur et permet une cérémonie laïque dans le jardin. Avec 32 couchages, vos proches dorment sur place.",
    rating: { score: "4,8", count: 37 },
    where: "Près de Lourmarin, Vaucluse · 35 min de l’aéroport de Marseille",
    whereLabel: "près de Lourmarin dans le Luberon",
    tags: ["traiteur_libre", "ceremonie_exterieur", "exclusivite", "parking", "pmr"],
    ...at(488.9, 587.0),
  },
  {
    id: "exemple:mas-de-la-source",
    category: "lieu",
    name: "Mas de la Source",
    area: "Alpilles",
    photos: [PHOTO.source, null, null, null, null],
    seats: 160,
    beds: 16,
    access: "25 min de la gare d'Avignon TGV",
    station: 25,
    why: "cour fermée pour danser tard, cuisine équipée pour votre traiteur",
    price: 11300,
    unit: "la location",
    upTo: "Jusqu'à 180 invités · 16 couchages · 25 min d'Avignon",
    pitch: "Une cour fermée où la fête peut durer jusqu’au bout de la nuit sans gêner personne.",
    unitWeekend: "le week-end",
    tags: ["traiteur_libre", "fin_tardive", "parking"],
    ...at(362.4, 608.6),
  },
  {
    id: "exemple:bastide-saint-clair",
    category: "lieu",
    name: "Bastide Saint-Clair",
    area: "Var",
    photos: [PHOTO.clair, null, null, null, null],
    negotiated: true,
    seats: 120,
    beds: 12,
    access: "50 min de l'aéroport de Toulon",
    airport: 50,
    why: "grande tablée dans le parc, brunch du lendemain possible",
    price: 8400,
    unit: "la location",
    upTo: "Jusqu'à 170 invités · 12 couchages · 1 h de Marseille",
    pitch: "Le tarif le plus doux de la sélection, et un parc ombragé pour le brunch du dimanche.",
    unitWeekend: "le week-end",
    tags: ["ceremonie_exterieur", "parking"],
    ...at(688.7, 704.3),
  },
  {
    id: "exemple:chateau-des-aigues",
    category: "lieu",
    name: "Château des Aigues",
    area: "Pays d'Aix",
    photos: [null, null, null, null, null],
    seats: 180,
    beds: 30,
    access: "30 min de la gare d'Aix TGV",
    station: 30,
    why: "vos proches dorment sur place, chapelle sur le domaine",
    price: 12400,
    unit: "la location",
    upTo: "Jusqu'à 220 invités · 30 couchages · 30 min d'Aix-en-Provence",
    pitch: "Le plus de couchages de la sélection : tous vos proches dorment sur place.",
    unitWeekend: "le week-end",
    tags: ["exclusivite", "parking", "pmr"],
    ...at(533.3, 658.0),
  },
  {
    id: "exemple:bergerie-de-valcroze",
    category: "lieu",
    name: "Bergerie de Valcroze",
    area: "Haute-Provence",
    photos: [null, null, null, null, null],
    negotiated: true,
    seats: 130,
    beds: 10,
    access: "1 h 15 de l'aéroport de Marseille",
    airport: 75,
    why: "dîner sous les tilleuls, le tarif le plus doux de la sélection",
    price: 7900,
    unit: "la location",
    upTo: "Jusqu'à 160 invités · 10 couchages · 1 h 15 d'Avignon",
    pitch: "Une grande tablée sous les tilleuls, avec des champs de lavande autour.",
    unitWeekend: "le week-end",
    tags: ["ceremonie_exterieur", "traiteur_libre"],
    ...at(633.2, 571.6),
  },
  {
    id: "exemple:mas-des-cigales",
    category: "lieu",
    name: "Mas des Cigales",
    area: "Camargue",
    photos: [null, null, null, null, null],
    seats: 150,
    beds: 18,
    access: "35 min de la gare de Nîmes",
    station: 35,
    why: "salle de danse à part, traiteur libre",
    price: 10600,
    unit: "la location",
    upTo: "Jusqu'à 190 invités · 18 couchages · 35 min de Nîmes",
    pitch: "Une salle de danse à part, et des chevaux au bout du jardin pour vos photos.",
    unitWeekend: "le week-end",
    tags: ["traiteur_libre", "fin_tardive"],
    ...at(282.4, 664.2),
  },
];

// Prestataires autour du Domaine des Oliviers (7f) : km depuis le lieu, ville, pourquoi
const around = (category, name, town, km, why, price, unit, extra = {}) => ({
  id: `exemple:${name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")}`,
  category,
  name,
  area: town,
  km,
  why,
  price,
  unit,
  photos: [null],
  works: true,
  ...extra,
});

const AROUND = [
  around("traiteur", "Les Tables de Lou", "Pertuis", 18, "cuisine provençale en grande tablée, déjà venu douze fois au domaine", 85, "par invité", { negotiated: true }),
  around("traiteur", "Maison Sarrazin", "Cavaillon", 24, "buffet de produits locaux, pensé pour 120 invités sans service à l’assiette", 72, "par invité"),
  around("traiteur", "Le Comptoir des Vignes", "Apt", 21, "long cocktail et stands, pour une fête qui dure", 64, "par invité"),
  around("traiteur", "Fourneau et Figue", "Aix-en-Provence", 35, "menu de saison et bar à vins avec des vignerons du Luberon", 95, "par invité", { negotiated: true }),
  around("dj", "Duo Lavande", "Lourmarin", 3, "jazz pour le cocktail, puis DJ jusqu’au bout de la nuit", 1900, "la soirée"),
  around("dj", "Studio Nuit Blanche", "Avignon", 52, "connaît déjà la sonorisation et les horaires du domaine", 1400, "la soirée", { negotiated: true }),
  around("dj", "Les Platines du Sud", "Marseille", 68, "playlist construite avec vous avant le jour J", 1200, "la soirée"),
  around("photographe", "Clémence Roux", "Lourmarin", 5, "lumière douce de fin de journée, connaît les coins du domaine", 1900, "la journée"),
  around("photographe", "Atelier Lumen", "Aix-en-Provence", 38, "reportage naturel, photo et film court de 3 minutes", 2400, "la journée"),
  around("photographe", "Studio Argile", "Avignon", 50, "argentique et numérique, dans un style champêtre", 2100, "la journée", { negotiated: true }),
  around("photographe", "Paul et Ilan", "Marseille", 66, "deux photographes pour ne manquer aucun des 120 invités", 2800, "la journée"),
];

// Autres lieux de la région, regroupés par département sur la carte (7d)
const CLUSTERS = [
  { count: 8, label: "le Gard et l’Hérault", ...at(211.4, 550.0) },
  { count: 4, label: "la Drôme et l’Ardèche", ...at(333.5, 303.1) },
  { count: 3, label: "les Hautes-Alpes", ...at(744.2, 318.5) },
  { count: 5, label: "les Alpes-Maritimes", ...at(799.7, 596.3) },
  { count: 3, label: "l’Isère", ...at(677.6, 226.0) },
];

export const SAMPLE = [...VENUES, ...AROUND];
export const SAMPLE_BY_ID = Object.fromEntries(SAMPLE.map((v) => [v.id, v]));

// Ce que l'on garde d'un prestataire dans la sélection du mariage (vendor_picks.data)
export function snapshot(v) {
  const keep = ["name", "area", "photos", "price", "unit", "unitWeekend", "negotiated", "best", "seats", "beds", "access", "why", "km", "email", "phone", "website", "lat", "lng"];
  const out = {};
  for (const k of keep) if (v[k] !== undefined && v[k] !== null) out[k] = v[k];
  if (out.photos) out.photos = out.photos.filter(Boolean).slice(0, 1);
  return out;
}

// ---------------------------------------------------------------------------
// Recommandations : filtres « Préciser mes envies » appliqués aux lieux
// ---------------------------------------------------------------------------

// Sélection d'exemple : mêmes règles que le catalogue (supabase/catalog-filtres.sql). Un lieu qui contredit
// un filtre disparaît ; ceux dont l'information manque viennent après, avec ce qu'il faut confirmer.
const SAMPLE_VALUE = {
  capacity_seated: (v) => v.seats ?? null,
  beds: (v) => v.beds ?? null,
  airport_minutes: (v) => v.airport ?? null,
  station_minutes: (v) => v.station ?? null,
  caterer_imposed: (v) => (v.tags?.includes("traiteur_libre") ? false : null),
  parking: (v) => (v.tags?.includes("parking") ? true : null),
  accessible: (v) => (v.tags?.includes("pmr") ? true : null),
  outdoor_ceremony: (v) => (v.tags?.includes("ceremonie_exterieur") ? true : null),
  exclusive_use: (v) => (v.tags?.includes("exclusivite") ? true : null),
  late_party: (v) => (v.tags?.includes("fin_tardive") ? true : null),
};

function check(v, f) {
  const x = (SAMPLE_VALUE[f.col] || (() => null))(v);
  if (x === null || x === undefined) return "unknown";
  if (f.op === "gte") return x >= f.value ? "yes" : "no";
  if (f.op === "lte") return x <= f.value ? "yes" : "no";
  return x === f.value ? "yes" : "no";
}

export function rank(list, wishes, category) {
  const filters = category === "lieu" ? hardFilters(wishes) : [];
  // Le catalogue est déjà filtré par la requête ; seule la sélection d'exemple l'est ici
  if (!filters.length || !list.some((v) => String(v.id).startsWith("exemple:"))) return list;
  const out = [];
  for (const v of list) {
    const res = filters.map((f) => ({ f, r: check(v, f) }));
    if (res.some((x) => x.r === "no")) continue;
    out.push({ ...v, unknown: res.filter((x) => x.r === "unknown").map((x) => x.f.label) });
  }
  return [...out.filter((v) => !v.unknown.length), ...out.filter((v) => v.unknown.length)];
}

// Lieux : les six de la sélection ; autres catégories : ceux qui interviennent autour du lieu
export function sampleFor(category) {
  return SAMPLE.filter((v) => v.category === category);
}

export function sampleClusters() {
  return CLUSTERS;
}

// ---------------------------------------------------------------------------
// Catalogue Merry (schéma « catalog ») : prestataires validés, photos en liens signés
// ---------------------------------------------------------------------------

// Le lieu ou la région du brief est du texte libre (« etretat », « Saint Georges sur Loire (49) ») :
// merry_place (supabase/prestataires.sql) le traduit en coordonnées d'après le catalogue.
const PLACES = new Map();

export async function resolvePlace(text) {
  const q = String(text || "").trim();
  if (!q || !supabase) return null;
  if (!PLACES.has(q)) {
    PLACES.set(
      q,
      supabase.rpc("merry_place", { q }).then(({ data, error }) => {
        if (error) {
          PLACES.delete(q);
          return null;
        }
        const row = Array.isArray(data) ? data[0] : data;
        return row && row.lat !== null && row.lng !== null ? { lat: row.lat, lng: row.lng } : null;
      }),
    );
  }
  return PLACES.get(q);
}

const PRICE_UNIT = { location: "la location", par_personne: "par invité", forfait: "le forfait", par_heure: "de l'heure" };

function fromCatalog(row, photos, center, filters = []) {
  const lat = row.lat ?? null;
  const lng = row.lng ?? null;
  const km = center && lat !== null && lng !== null ? Math.round(distanceKm(center, { lat, lng })) : undefined;
  const airport = row.airport_minutes !== null && row.airport_minutes !== undefined ? `${row.airport_minutes} min de l'aéroport ${row.airport_name ? `de ${row.airport_name}` : ""}`.trim() : null;
  const station = row.station_minutes !== null && row.station_minutes !== undefined ? `${row.station_minutes} min de la gare ${row.station_name || "TGV"}` : null;
  const near = [airport, station].filter(Boolean).sort((a, b) => parseInt(a, 10) - parseInt(b, 10))[0];
  const facts = [];
  if (row.capacity_seated) facts.push(["seat", "Places assises", `${row.capacity_seated} invités`]);
  if (row.beds) facts.push(["bed", "Couchages", `${row.beds} sur place`]);
  if (airport) facts.push(["plane", "Aéroport le plus proche", `${row.airport_name}, ${row.airport_minutes} min`]);
  if (station) facts.push(["train", "Gare TGV la plus proche", `${row.station_name}, ${row.station_minutes} min`]);
  if (row.parking) facts.push(["parking", "Parking", "Sur place"]);
  if (row.caterer_imposed === false) facts.push(["chef", "Traiteur", "Libre, vous choisissez"]);
  if (row.caterer_imposed === true) facts.push(["chef", "Traiteur", "Celui du lieu"]);
  const tags = [
    row.caterer_imposed === false && "traiteur_libre",
    row.outdoor_ceremony && "ceremonie_exterieur",
    row.exclusive_use && "exclusivite",
    row.late_party && "fin_tardive",
    row.parking && "parking",
    row.accessible && "pmr",
  ].filter(Boolean);
  return {
    id: `catalog:${row.id}`,
    catalogId: row.id,
    category: catFromCatalog(row.primary_category),
    name: row.name,
    area: row.city || row.department || row.region || "",
    photos: photos.length ? photos : [null],
    seats: row.capacity_seated || undefined,
    beds: row.beds ?? undefined,
    access: near || undefined,
    airport: row.airport_minutes ?? undefined,
    station: row.station_minutes ?? undefined,
    facts: facts.length ? facts : undefined,
    price: row.price_min || undefined,
    unit: PRICE_UNIT[row.price_unit] || undefined,
    why: row.description ? String(row.description).split(/[.!?]/)[0].trim().slice(0, 140) : undefined,
    km,
    website: row.website || undefined,
    phone: row.phone || undefined,
    email: row.email || undefined,
    tags: [...(row.style_tags || []), ...tags],
    // Filtres du couple dont la valeur est inconnue pour ce lieu : « à confirmer »
    unknown: filters.length ? unknownOf(row, filters) : undefined,
    lat,
    lng,
  };
}

let filterColumnsMissing = false;

// Combien de propositions à la fois : six lieux (comme le canvas), huit pour les autres catégories
export function pageSize(category) {
  return category === "lieu" ? 6 : 8;
}

// Renvoie { vendors, source: "catalogue" | "exemple", center, hasMore }. Le catalogue n'est lu que s'il est
// exposé (Supabase > API > Exposed schemas) et qu'il a des prestataires validés pour cette catégorie.
// places : textes du brief à essayer dans l'ordre (lieu, région) ; near : coordonnées déjà connues ;
// bbox : zone de la carte ({ south, north, west, east }) ; offset, limit : page suivante (« Voir plus »).
export async function loadRecommendations({ mode, category, places = [], near, bbox, offset = 0, limit = pageSize(category), filters = [], city = null, tier = "confirmed" }) {
  const fallback = { vendors: offset ? [] : sampleFor(category), source: "exemple", center: null, hasMore: false };
  if (mode !== "live" || !supabase) return fallback;
  try {
    const cat = catOf(category);
    // « Près d'une ville » : la ville devient le centre de la recherche, dans un rayon tenu en temps de route
    const cityAt = city ? await resolvePlace(city.name) : null;
    let center = near || cityAt || null;
    for (const p of places) {
      if (center || bbox) break;
      center = await resolvePlace(p);
    }
    // Sans merry_place (fichier SQL pas encore lancé), la région du brief filtre par son nom
    const regionText = !center && !bbox ? places.map((p) => String(p || "").trim()).find((p) => p.length >= 4) : null;
    const base = "id, name, primary_category, description, city, department, region, lat, lng, capacity_seated, beds, price_min, price_unit, style_tags, website, phone, email, wedding_signal, photos_count";
    const query = (withFilters) => {
      // Ceux qui ont des photos d'abord, puis les plus « mariage » ; ordre stable pour les pages suivantes
      let req = supabase
        .schema("catalog")
        .from("vendors")
        .select(withFilters ? `${base}, ${FILTER_COLUMNS.filter((c) => !base.includes(c)).join(", ")}` : base)
        .eq("status", "active")
        .in("primary_category", cat.catalog)
        .order("photos_count", { ascending: false })
        .order("wedding_signal", { ascending: false })
        .order("id")
        .range(offset, offset + limit);
      if (bbox) req = req.gte("lat", bbox.south).lte("lat", bbox.north).gte("lng", bbox.west).lte("lng", bbox.east);
      else if (cityAt) {
        const radiusKm = Math.max(5, (city.max - ROAD_MIN_FIXED) / ROAD_MIN_PER_KM);
        const dLat = radiusKm / 111;
        const dLng = radiusKm / (111 * Math.cos((cityAt.lat * Math.PI) / 180));
        req = req.gte("lat", cityAt.lat - dLat).lte("lat", cityAt.lat + dLat).gte("lng", cityAt.lng - dLng).lte("lng", cityAt.lng + dLng);
      } else if (center) req = req.gte("lat", center.lat - 0.9).lte("lat", center.lat + 0.9).gte("lng", center.lng - 1.2).lte("lng", center.lng + 1.2);
      else if (regionText) req = req.ilike("region", `%${regionText.replace(/[%_,()]/g, " ").trim()}%`);
      if (withFilters && filters.length) req = tier === "open" ? applyOpen(req, filters) : applyConfirmed(req, filters);
      return req;
    };
    // Colonnes de supabase/catalog-filtres.sql absentes : on cherche sans les filtres, et on le dit
    // (une seule tentative par session : la page ne relance pas une requête qu'elle sait refusée)
    let filtersMissing = filterColumnsMissing;
    if (filtersMissing && tier === "open") return { vendors: [], source: "catalogue", center, hasMore: false, filtersMissing };
    let { data, error } = await query(!filtersMissing);
    if (error && !filtersMissing && /column|42703/i.test(`${error.code} ${error.message}`)) {
      filterColumnsMissing = filtersMissing = true;
      if (tier === "open") return { vendors: [], source: "catalogue", center, hasMore: false, filtersMissing };
      ({ data, error } = await query(false));
    }
    if (error) console.warn("[merry] catalogue des prestataires", error.message);
    if (error) return fallback;
    // Une ligne de plus que demandé : elle dit seulement s'il reste une page
    const hasMore = (data || []).length > limit;
    let rows = (data || []).slice(0, limit);
    // Ville : le rayon de la requête est large, le temps de route estimé tranche
    if (cityAt) rows = rows.filter((r) => r.lat !== null && roadMinutes(cityAt, { lat: r.lat, lng: r.lng }) <= city.max);
    const active = filtersMissing ? [] : filters;
    if (!rows.length) return offset || bbox || filters.length || city ? { vendors: [], source: "catalogue", center, hasMore, filtersMissing } : fallback;
    const ids = rows.map((r) => r.id);
    const { data: ph } = await supabase.schema("catalog").from("vendor_photos").select("vendor_id, position, storage_path").in("vendor_id", ids).order("position");
    const paths = (ph || []).map((p) => p.storage_path);
    const signed = paths.length ? (await supabase.storage.from("catalog-photos").createSignedUrls(paths, 3600)).data || [] : [];
    const urlOf = new Map(signed.map((x) => [x.path, x.signedUrl]));
    const byVendor = new Map();
    for (const p of ph || []) {
      const u = urlOf.get(p.storage_path);
      if (u) byVendor.set(p.vendor_id, [...(byVendor.get(p.vendor_id) || []), u]);
    }
    const anchor = center || (bbox ? { lat: (bbox.south + bbox.north) / 2, lng: (bbox.west + bbox.east) / 2 } : null);
    return { vendors: rows.map((r) => fromCatalog(r, byVendor.get(r.id) || [], center, active)), source: "catalogue", center: anchor, hasMore, filtersMissing };
  } catch (e) {
    console.warn("[merry] catalogue des prestataires indisponible", e?.message || e);
    return fallback;
  }
}

// Position d'un prestataire sur la carte (repère du canvas), ou null
export function mapPoint(v) {
  if (v?.lat === undefined || v?.lat === null || v?.lng === undefined || v?.lng === null) return null;
  return project(v.lat, v.lng);
}

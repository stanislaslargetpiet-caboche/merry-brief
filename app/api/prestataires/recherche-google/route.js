// Recherche Google (Places API (New)) pour « Ajouter un prestataire » (Mes prestataires et Trouver
// des prestataires) : quand le nom tapé ne correspond à rien dans le catalogue Merry, on cherche sur
// Google pour proposer une fiche déjà remplie (nom, adresse, téléphone, site), plutôt qu'un formulaire
// vide. Nécessite GOOGLE_PLACES_API_KEY côté serveur (Vercel > Settings > Environment Variables).
// Réservée aux organisateurs connectés.

import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 20;

const FIELD_MASK = "places.id,places.displayName,places.formattedAddress,places.addressComponents,places.internationalPhoneNumber,places.websiteUri,places.location,places.types,places.primaryType";

function cityOf(components) {
  const byType = (t) => (components || []).find((c) => (c.types || []).includes(t))?.longText;
  return byType("locality") || byType("postal_town") || byType("administrative_area_level_2") || null;
}

// Types Google (Places API (New)) → catégorie du catalogue Merry, pour pré-remplir le formulaire.
// Une suggestion seulement : le couple peut toujours la changer.
const TYPE_TO_CATEGORY = [
  [["wedding_venue", "event_venue", "banquet_hall", "castle", "historical_place", "farmstay", "winery", "resort_hotel", "bed_and_breakfast", "hotel", "guest_house", "cottage"], "lieu"],
  [["catering_service", "caterer", "restaurant", "meal_delivery"], "traiteur"],
  [["florist"], "fleuriste"],
  [["photographer", "photography_studio"], "photographe"],
  [["bakery", "pastry_shop", "confectionery", "cake_shop", "dessert_shop"], "patisserie"],
  [["beauty_salon", "hair_salon", "hair_care", "makeup_artist", "nail_salon", "spa", "barber_shop"], "beaute"],
  [["bridal_shop", "wedding_store", "clothing_store", "womens_clothing_store", "mens_clothing_store"], "robe"],
  [["car_rental", "limousine_service", "taxi_service", "bus_company", "transportation_service"], "transport"],
  [["dj", "night_club"], "dj"],
  [["event_planner", "wedding_planner"], "wedding_planner"],
];

function categoryOf(p) {
  const types = [p.primaryType, ...(p.types || [])].filter(Boolean);
  for (const t of types) for (const [list, cat] of TYPE_TO_CATEGORY) if (list.includes(t)) return cat;
  return null;
}

// En-têtes HTTP : ASCII seulement. Si la clé a été copiée avec un caractère invisible ou une puce
// (« • », repéré dans les logs en prod : « ByteString » lève une erreur 500 sur tout appel Google),
// on la nettoie plutôt que de planter sur chaque recherche.
function cleanKey(k) {
  return String(k || "").replace(/[^\x20-\x7e]/g, "").trim();
}

export async function POST(req) {
  const key = cleanKey(process.env.GOOGLE_PLACES_API_KEY);
  if (!key) return Response.json({ error: "no_key" }, { status: 501 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!url || !anon || !token) return Response.json({ error: "auth" }, { status: 401 });
  const sb = createClient(url, anon, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: user, error: authError } = await sb.auth.getUser();
  if (authError || !user?.user) return Response.json({ error: "auth" }, { status: 401 });

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const q = String(body.q || "").trim().slice(0, 120);
  if (q.length < 2) return Response.json({ results: [] });

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "content-type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELD_MASK },
    body: JSON.stringify({ textQuery: q, languageCode: "fr", regionCode: "FR" }),
  });
  if (!res.ok) {
    console.error("[merry] recherche google prestataire", res.status, await res.text().catch(() => ""));
    return Response.json({ error: "google_failed" }, { status: 502 });
  }
  const out = await res.json();
  const results = (out.places || []).slice(0, 5).map((p) => ({
    placeId: p.id || null,
    name: p.displayName?.text || "",
    address: p.formattedAddress || null,
    city: cityOf(p.addressComponents),
    phone: p.internationalPhoneNumber || null,
    website: p.websiteUri || null,
    lat: p.location?.latitude ?? null,
    lng: p.location?.longitude ?? null,
    category: categoryOf(p),
  }));
  return Response.json({ results });
}

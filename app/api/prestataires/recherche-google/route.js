// Recherche Google (Places API (New)) pour « Ajouter un prestataire » (Mes prestataires et Trouver
// des prestataires) : quand le nom tapé ne correspond à rien dans le catalogue Merry, on cherche sur
// Google pour proposer une fiche déjà remplie (nom, adresse, téléphone, site), plutôt qu'un formulaire
// vide. Nécessite GOOGLE_PLACES_API_KEY côté serveur (Vercel > Settings > Environment Variables).
// Réservée aux organisateurs connectés.

import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 20;

const FIELD_MASK = "places.id,places.displayName,places.formattedAddress,places.addressComponents,places.internationalPhoneNumber,places.websiteUri,places.location";

function cityOf(components) {
  const byType = (t) => (components || []).find((c) => (c.types || []).includes(t))?.longText;
  return byType("locality") || byType("postal_town") || byType("administrative_area_level_2") || null;
}

export async function POST(req) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
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
    name: p.displayName?.text || "",
    address: p.formattedAddress || null,
    city: cityOf(p.addressComponents),
    phone: p.internationalPhoneNumber || null,
    website: p.websiteUri || null,
    lat: p.location?.latitude ?? null,
    lng: p.location?.longitude ?? null,
  }));
  return Response.json({ results });
}

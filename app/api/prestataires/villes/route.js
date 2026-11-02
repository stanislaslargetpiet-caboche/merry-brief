// Suggestions de villes/régions (Google Places Autocomplete (New)) pour le champ « Ville ou région »
// du formulaire « Ajouter un prestataire » : on aide à taper une ville reconnue par Google, pour que la
// recherche qui suit (nom + ville, /api/prestataires/recherche-google) retrouve la bonne fiche. La saisie
// reste libre : les suggestions sont une aide, pas une obligation de sélectionner l'une d'elles.
// Nécessite GOOGLE_PLACES_API_KEY côté serveur (Vercel > Settings > Environment Variables).
// Réservée aux organisateurs connectés.

import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 20;

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
  const q = String(body.q || "").trim().slice(0, 80);
  if (q.length < 2) return Response.json({ results: [] });

  const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: { "content-type": "application/json", "X-Goog-Api-Key": key },
    body: JSON.stringify({ input: q, includedPrimaryTypes: ["locality", "administrative_area_level_2", "administrative_area_level_1"], languageCode: "fr", regionCode: "FR" }),
  });
  if (!res.ok) {
    console.error("[merry] suggestions ville", res.status, await res.text().catch(() => ""));
    return Response.json({ error: "google_failed" }, { status: 502 });
  }
  const out = await res.json();
  const results = (out.suggestions || [])
    .map((s) => s.placePrediction?.structuredFormat?.mainText?.text || s.placePrediction?.text?.text || "")
    .filter(Boolean)
    .slice(0, 5);
  return Response.json({ results });
}

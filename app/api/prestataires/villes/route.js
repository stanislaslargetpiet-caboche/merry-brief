// Suggestions de villes/régions (Google Places Autocomplete (New)) pour le champ « Ville ou région »
// du formulaire « Ajouter un prestataire » : on aide à taper une ville reconnue par Google, pour que la
// recherche qui suit (nom + ville, /api/prestataires/recherche-google) retrouve la bonne fiche. La saisie
// reste libre : les suggestions sont une aide, pas une obligation de sélectionner l'une d'elles.
// Avec placeId (au lieu de q) : renvoie le code postal de cette suggestion une fois choisie (un seul
// appel Détails par sélection, pas un par lettre tapée).
// Nécessite GOOGLE_PLACES_API_KEY côté serveur (Vercel > Settings > Environment Variables).
// Réservée aux organisateurs connectés.

import { createClient } from "@supabase/supabase-js";
import { allowUser } from "@/lib/server/rate";

export const runtime = "nodejs";
export const maxDuration = 20;

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
  // Chaque appel est facturé par Google : 600 par jour et par personne
  if (!(await allowUser(sb, "google_cities", 600, 86400))) return Response.json({ error: "quota", results: [] }, { status: 429 });

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const placeId = String(body.placeId || "").trim();
  if (placeId) {
    const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
      headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "addressComponents" },
    });
    if (!res.ok) return Response.json({ postalCode: null });
    const out = await res.json();
    const postalCode = (out.addressComponents || []).find((c) => (c.types || []).includes("postal_code"))?.longText || null;
    return Response.json({ postalCode });
  }

  const q = String(body.q || "").trim().slice(0, 80);
  if (q.length < 2) return Response.json({ results: [] });

  const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: { "content-type": "application/json", "X-Goog-Api-Key": key },
    body: JSON.stringify({ input: q, includedPrimaryTypes: ["locality", "administrative_area_level_2", "administrative_area_level_1"], includedRegionCodes: ["fr"], languageCode: "fr", regionCode: "FR" }),
  });
  if (!res.ok) {
    console.error("[merry] suggestions ville", res.status, await res.text().catch(() => ""));
    return Response.json({ error: "google_failed" }, { status: 502 });
  }
  const out = await res.json();
  // Toujours un sous-texte (France par défaut) pour une liste homogène : Google omet parfois la
  // région/le département pour les villes les plus connues, mais pas pour les autres.
  const results = (out.suggestions || [])
    .map((s) => ({
      label: s.placePrediction?.structuredFormat?.mainText?.text || s.placePrediction?.text?.text || "",
      secondary: s.placePrediction?.structuredFormat?.secondaryText?.text || "France",
      placeId: s.placePrediction?.placeId || "",
    }))
    .filter((r) => r.label)
    .slice(0, 5);
  return Response.json({ results });
}

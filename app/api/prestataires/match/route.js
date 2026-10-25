// Prestataires : l'IA compare chaque prestataire proposé à ce que cherche le couple (brief, envies,
// description libre) et renvoie une note, la phrase « Pourquoi ce lieu » des cartes, une explication
// pour la fiche et ce qu'il reste à vérifier. Réservée aux organisateurs connectés.
// Les fiches sont relues ici dans le catalogue avec la session de l'organisateur : seuls les
// prestataires validés (RLS) sont notés. Nécessite ANTHROPIC_API_KEY côté serveur.

import { createClient } from "@supabase/supabase-js";
import { isForced, refusesForcedTool, rememberNoForce, withTool } from "@/lib/aiTool";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_VENDORS = 40;
const DAILY_LIMIT = 200;
const MODEL = process.env.MERRY_AI_MODEL_FAST || process.env.MERRY_AI_MODEL || "claude-sonnet-5-5";
const API = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";

const SYSTEM = `Tu aides un couple à choisir les prestataires de son mariage en France (lieux de réception, traiteurs, DJ, fleuristes, photographes…).

On te donne ce que le couple cherche (brief, envies, description libre) et une liste de prestataires du catalogue Merry, avec ce que l'on sait d'eux : catégories Google, ville, distance au lieu ou à la région du couple, note et nombre d'avis Google, description quand il y en a une, site web.

Pour chaque prestataire, note de 0 à 100 à quel point il correspond à CE couple, puis explique-le. Règles :
- Appuie-toi seulement sur les informations fournies. N'invente ni capacité, ni prix, ni couchages, ni prestations. Ce qui n'est pas connu va dans « à vérifier ».
- La distance compte : un prestataire loin de la région ou du lieu du couple (plus de 60 km) perd des points, sauf s'il se déplace (traiteur, DJ, photographe…).
- Un établissement qui n'est manifestement pas fait pour des mariages (salle de sport, bureau, simple restaurant de quartier pour un lieu de réception…) a une note basse, sous 30.
- Les envies explicites du couple (ambiance, accès, traiteur libre, couchages, cérémonie dehors…) priment sur le reste quand les informations permettent d'en juger.
- Une bonne note Google avec beaucoup d'avis est un signe de sérieux, pas une preuve d'adéquation.
- « pourquoi » : une demi-phrase courte (90 caractères au plus), en minuscule, sans point final, qui suit « Pourquoi ce lieu : ». Concrète et propre à ce couple (ex. « à 20 km de votre région, domaine en pierre avec parc pour un dîner dehors »).
- « explication » : deux ou trois phrases, au vouvoiement, qui relient ce prestataire à ce que le couple a demandé, honnêtes sur ce qui manque.
- « a_verifier » : deux à quatre points précis à demander au prestataire (capacité, couchages, horaires de fin, traiteur imposé, prix…).
- Français, pas d'emoji. Note chaque prestataire de la liste, une seule fois, avec son identifiant exact.`;

const TOOL = {
  name: "noter_prestataires",
  description: "Enregistre la note et l'explication de chaque prestataire pour ce couple.",
  input_schema: {
    type: "object",
    properties: {
      notes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            score: { type: "integer", minimum: 0, maximum: 100 },
            pourquoi: { type: "string" },
            explication: { type: "string" },
            a_verifier: { type: "array", items: { type: "string" } },
          },
          required: ["id", "score", "pourquoi", "explication", "a_verifier"],
        },
      },
    },
    required: ["notes"],
  },
};

const CATEGORY_LABEL = { lieu: "lieux de réception", traiteur: "traiteurs", dj: "DJ et animation", fleuriste: "fleuristes", photographe: "photographes et vidéastes", autre: "autres prestataires" };

function km(a, b) {
  const r = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2;
  return Math.round(6371 * 2 * Math.asin(Math.sqrt(h)));
}

const clip = (s, n) => (s === null || s === undefined ? undefined : String(s).replace(/\s+/g, " ").trim().slice(0, n) || undefined);

export async function POST(req) {
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "no_ai" }, { status: 501 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!url || !key || !token) return Response.json({ error: "auth" }, { status: 401 });

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const ids = [...new Set((Array.isArray(body.ids) ? body.ids : []).map(String))].filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, MAX_VENDORS);
  if (!ids.length) return Response.json({ matches: [] });
  const category = CATEGORY_LABEL[body.category] ? body.category : "lieu";
  const couple = body.couple && typeof body.couple === "object" ? body.couple : {};
  const center = body.center && Number.isFinite(body.center.lat) && Number.isFinite(body.center.lng) ? body.center : null;

  const sb = createClient(url, key, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: calls, error: tickError } = await sb.rpc("merry_ai_tick");
  if (tickError) return Response.json({ error: "auth" }, { status: 403 });
  if (calls > DAILY_LIMIT) return Response.json({ error: "quota" }, { status: 429 });

  const { data: rows, error } = await sb
    .schema("catalog")
    .from("vendors")
    .select("id, name, primary_category, categories, google_categories, description, city, department, region, lat, lng, google_rating, google_review_count, website, capacity_seated, capacity_standing, beds, price_min, price_max, price_unit, style_tags, service_radius_km")
    .in("id", ids);
  if (error) {
    console.error("[merry] match prestataires : catalogue", error.message);
    return Response.json({ error: "catalog" }, { status: 502 });
  }
  if (!rows?.length) return Response.json({ matches: [] });

  const vendors = rows.map((r) => ({
    id: r.id,
    nom: clip(r.name, 120),
    categories: [...new Set([...(r.google_categories || []), ...(r.categories || [])])].slice(0, 8),
    ville: [r.city, r.department && `(${r.department})`, r.region].filter(Boolean).join(" "),
    distance_km: center && r.lat !== null && r.lng !== null ? km(center, { lat: r.lat, lng: r.lng }) : undefined,
    note_google: r.google_rating ? `${r.google_rating} sur 5 (${r.google_review_count || 0} avis)` : undefined,
    description: clip(r.description, 500),
    site: clip(r.website, 80),
    places_assises: r.capacity_seated || undefined,
    places_debout: r.capacity_standing || undefined,
    couchages: r.beds ?? undefined,
    prix: r.price_min ? `${r.price_min}${r.price_max ? ` à ${r.price_max}` : ""} € ${r.price_unit || ""}`.trim() : undefined,
    styles: (r.style_tags || []).length ? r.style_tags : undefined,
    rayon_intervention_km: r.service_radius_km || undefined,
  }));

  const content = [
    {
      type: "text",
      text: `Ce que cherche le couple :\n${JSON.stringify(couple, null, 1).slice(0, 4000)}\n\nCatégorie : ${CATEGORY_LABEL[category]}.\n${
        center ? "Les distances sont mesurées depuis le lieu ou la région du couple." : "La région du couple n'est pas connue : ne pénalise pas la distance."
      }\n\nPrestataires à noter :\n${JSON.stringify(vendors)}`,
    },
  ];

  const call = () =>
    fetch(`${API}/v1/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(withTool({ model: MODEL, max_tokens: 8000, system: SYSTEM, messages: [{ role: "user", content }] }, TOOL)),
    });
  let res = await call();
  if (res.status === 400 && isForced(MODEL) && refusesForcedTool(await res.clone().text().catch(() => ""))) {
    rememberNoForce(MODEL); // ce modèle refuse l'outil forcé : on repart en « auto »
    res = await call();
  }
  if (res.status === 429 || res.status >= 500) {
    await new Promise((r) => setTimeout(r, 1500));
    res = await call();
  }
  if (!res.ok) {
    console.error("[merry] match prestataires", res.status, await res.text().catch(() => ""));
    return Response.json({ error: "ai_failed" }, { status: 502 });
  }
  const out = await res.json();
  const used = (out.content || []).find((c) => c.type === "tool_use");
  const notes = Array.isArray(used?.input?.notes) ? used.input.notes : null;
  if (!notes) return Response.json({ error: "ai_failed" }, { status: 502 });

  const known = new Set(rows.map((r) => r.id));
  const matches = notes
    .filter((n) => n && known.has(String(n.id)))
    .map((n) => ({
      id: String(n.id),
      score: Math.max(0, Math.min(100, Math.round(Number(n.score) || 0))),
      why: clip(n.pourquoi, 140)?.replace(/\.$/, ""),
      story: clip(n.explication, 700),
      checks: (Array.isArray(n.a_verifier) ? n.a_verifier : []).map((x) => clip(x, 160)).filter(Boolean).slice(0, 5),
    }));
  return Response.json({ matches });
}

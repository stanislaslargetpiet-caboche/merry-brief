// Choix de l'icône d'une tâche ou d'un poste par l'IA, d'après le thème principal.
// Réservé aux organisateurs connectés ; sans ANTHROPIC_API_KEY, l'appli garde
// l'icône devinée par mots-clés (components/dash/icons.js).

import { createClient } from "@supabase/supabase-js";
import { isForced, refusesForcedTool, rememberNoForce, withTool } from "@/lib/aiTool";

export const runtime = "nodejs";
export const maxDuration = 20;

const DAILY_LIMIT = 200;
const MODEL = process.env.MERRY_AI_FAST_MODEL || "claude-haiku-5-5";
const API = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";

const ICONS = {
  traiteur: "repas, traiteur, cocktail, dîner, brunch, gâteau, vins et boissons, dégustation",
  lieu: "lieu de réception, salle, domaine, château, visite du lieu",
  photo: "photographe, vidéaste, photos, album",
  musique: "DJ, groupe, musique, playlist, danse, animation",
  fleurs: "fleurs, fleuriste, décoration, scénographie",
  tenues: "robe, costume, essayages, chaussures, accessoires",
  alliances: "alliances, bagues, bijoux",
  enveloppe: "faire-part, save-the-date, papeterie, courriers",
  beaute: "coiffure, maquillage, beauté, soins",
  imprevus: "imprévus, divers, assurance",
  mairie: "mairie, dossier, démarches, officiant, cérémonie civile, religieuse ou laïque",
  table: "plan de table, placement des invités",
  horloge: "déroulé du jour J, horaires, planning",
  lit: "hébergement, hôtels, chambres, gîte",
  adresse: "adresses, plans d'accès, itinéraires",
  users: "invités, liste d'invités, témoins, familles, relances",
  wallet: "budget, paiements, acomptes, compte commun",
  cadeau: "liste de mariage, cadeaux, cagnotte",
  ecran: "site de mariage, formulaire en ligne, application",
  cloche: "rappels, annonces",
  calendar: "dates, rendez-vous, calendrier",
  autre: "rien de tout ça (transport, navette, animaux, garde d'enfants…)",
};

const TOOL = {
  name: "choisir_icone",
  description: "Choisit l'icône qui illustre le mieux le thème principal.",
  input_schema: { type: "object", properties: { icon: { type: "string", enum: Object.keys(ICONS) } }, required: ["icon"] },
};

export async function POST(req) {
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "no_ai" }, { status: 501 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!url || !key || !token) return Response.json({ error: "auth" }, { status: 401 });
  const sb = createClient(url, key, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: calls, error: tickError } = await sb.rpc("merry_ai_tick");
  if (tickError) return Response.json({ error: "auth" }, { status: 403 });
  if (calls > DAILY_LIMIT) return Response.json({ error: "quota" }, { status: 429 });

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const text = String(body.text || "").slice(0, 200).trim();
  if (!text) return Response.json({ error: "bad_request" }, { status: 400 });
  const what = body.kind === "poste" ? "un poste du budget de mariage" : "une tâche du rétroplanning d'un mariage";

  const prompt =
    `Voici ${what} : « ${text} ».\nChoisis l'icône qui correspond à son thème principal (ce dont il s'agit vraiment, pas un mot isolé).\n` +
    Object.entries(ICONS)
      .map(([k, v]) => `- ${k} : ${v}`)
      .join("\n");
  const call = () =>
    fetch(`${API}/v1/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(withTool({ model: MODEL, max_tokens: 100, messages: [{ role: "user", content: prompt }] }, TOOL)),
    });
  let res = await call();
  if (res.status === 400 && isForced(MODEL) && refusesForcedTool(await res.clone().text().catch(() => ""))) {
    rememberNoForce(MODEL); // ce modèle refuse l'outil forcé : on repart en « auto »
    res = await call();
  }
  if (!res.ok) return Response.json({ error: "ai_failed" }, { status: 502 });
  const out = await res.json();
  const icon = (out.content || []).find((c) => c.type === "tool_use")?.input?.icon;
  if (!icon || !(icon in ICONS)) return Response.json({ error: "ai_failed" }, { status: 502 });
  return Response.json({ icon });
}

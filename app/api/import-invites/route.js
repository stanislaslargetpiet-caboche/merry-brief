// Lecture des listes d'invités par l'IA (photos, PDF, listes en vrac).
// Réservée aux organisateurs connectés. Nécessite ANTHROPIC_API_KEY côté serveur
// (Vercel > Settings > Environment Variables) ; sans clé, l'appli lit seulement
// les fichiers Excel, CSV et le texte collé.

import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

// Vercel refuse les requêtes de plus de 4,5 Mo : l'appli réduit les photos et limite les PDF à 3 Mo.
const MAX_BYTES = 4.4 * 1024 * 1024;
const MAX_TEXT = 60000;
const DAILY_LIMIT = 30; // lectures par compte et par jour
const MODEL = process.env.MERRY_AI_MODEL || "claude-sonnet-5-5";

const TOOL = {
  name: "enregistrer_invites",
  description: "Enregistre la liste des invités lue dans les documents.",
  input_schema: {
    type: "object",
    properties: {
      guests: {
        type: "array",
        items: {
          type: "object",
          properties: {
            first_name: { type: "string" },
            last_name: { type: "string" },
            group: { type: ["string", "null"], description: "Un des groupes existants si le document l'indique clairement, sinon null" },
            age: { type: ["integer", "null"], description: "Seulement pour les enfants" },
            diet: { type: ["string", "null"], description: "Régime ou allergie : végétarien, sans gluten, halal…" },
            address: { type: ["string", "null"] },
            email: { type: ["string", "null"] },
            phone: { type: ["string", "null"] },
            plus_one_of: { type: ["string", "null"], description: "Pour un +1 sans nom : prénom et nom de la personne qu'il accompagne" },
            uncertain: { type: "boolean", description: "true seulement si le nom est peu lisible ou ambigu" },
            note: { type: ["string", "null"], description: "Pourquoi c'est incertain, en quelques mots" },
            extra: { type: "object", description: "Autres colonnes utiles trouvées (ex. Navette, Table), clé = nom de colonne", additionalProperties: { type: "string" } },
          },
          required: ["first_name", "last_name"],
        },
      },
      extra_columns: { type: "array", items: { type: "string" } },
    },
    required: ["guests", "extra_columns"],
  },
};

export async function POST(req) {
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "no_ai" }, { status: 501 });

  // Réservé aux organisateurs connectés, avec un nombre de lectures par jour
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!url || !key || !token) return Response.json({ error: "auth" }, { status: 401 });
  const sb = createClient(url, key, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: calls, error: tickError } = await sb.rpc("merry_ai_tick");
  if (tickError) return Response.json({ error: "auth" }, { status: 403 });
  if (calls > DAILY_LIMIT) return Response.json({ error: "quota" }, { status: 429 });

  const raw = await req.text();
  if (raw.length > MAX_BYTES) return Response.json({ error: "too_big" }, { status: 413 });
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  // Un fichier par appel : la réponse reste courte et sous la limite de temps de Vercel
  const s = body.source || {};
  const name = String(s.name || "liste").slice(0, 120);
  const content = [];
  if (s.kind === "text") {
    content.push({ type: "text", text: `Fichier « ${name} » :\n${String(s.content || "").slice(0, MAX_TEXT)}` });
  } else if (s.kind === "image" && /^image\/(png|jpeg|gif|webp)$/.test(s.mime)) {
    content.push({ type: "text", text: `Fichier « ${name} » (photo) :` });
    content.push({ type: "image", source: { type: "base64", media_type: s.mime, data: String(s.content || "") } });
  } else if (s.kind === "pdf") {
    content.push({ type: "text", text: `Fichier « ${name} » (PDF) :` });
    content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: String(s.content || "") } });
  } else {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const groups = (body.groups || []).map(String).slice(0, 30);
  const fields = (body.fields || []).map(String).slice(0, 30);
  content.push({
    type: "text",
    text:
      `Lis ces listes d'invités de mariage et enregistre chaque personne avec l'outil, une entrée par personne (un couple = deux entrées, un enfant = une entrée avec son âge si indiqué, un « +1 » sans nom = une entrée vide avec plus_one_of). ` +
      `Groupes existants : ${groups.join(", ") || "aucun"}. Colonnes déjà présentes : ${fields.join(", ") || "aucune"}. ` +
      `Ne devine pas : omets les champs qui ne sont pas écrits, et marque uncertain quand un nom est mal lisible. N'invente aucun invité.`,
  });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8000,
      tools: [TOOL],
      tool_choice: { type: "tool", name: TOOL.name },
      messages: [{ role: "user", content }],
    }),
  });
  if (!res.ok) {
    console.error("[merry] import IA", res.status, await res.text().catch(() => ""));
    return Response.json({ error: "ai_failed" }, { status: 502 });
  }
  const out = await res.json();
  const call = (out.content || []).find((c) => c.type === "tool_use");
  if (!call) return Response.json({ error: "ai_failed" }, { status: 502 });
  return Response.json({ guests: call.input.guests || [], extraColumns: call.input.extra_columns || [] });
}

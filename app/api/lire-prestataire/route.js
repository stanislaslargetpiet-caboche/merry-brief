// Lecture d'un devis ou d'une facture par l'IA : coordonnées du prestataire, interlocuteur,
// RIB, montant et nature du document. Réservée aux organisateurs connectés.
// Nécessite ANTHROPIC_API_KEY côté serveur (Vercel > Settings > Environment Variables).

import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 4.4 * 1024 * 1024;
const MAX_TEXT = 60000;
const DAILY_LIMIT = 200;
const MODEL = process.env.MERRY_AI_MODEL || "claude-sonnet-5-5";
const API = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";

const SYSTEM = `Tu lis des devis, factures, contrats et mails de prestataires de mariage (traiteur, lieu, photographe, fleuriste, DJ, robe…), en français le plus souvent.

Ton travail : relever les informations utiles au couple pour sa fiche prestataire et les enregistrer avec l'outil.

Règles :
- Le prestataire est l'émetteur du document (l'entreprise qui vend), jamais le couple ni les mariés.
- L'interlocuteur est la personne nommée côté prestataire (signataire, contact, « votre conseillère »…), avec son rôle si indiqué.
- Le RIB est celui du prestataire (IBAN, BIC, titulaire), tel qu'il figure sur le document ; recopie l'IBAN exactement, groupé par 4.
- Le montant est le total TTC du document. La nature est « devis » (devis, proposition, contrat non réglé), « facture » (facture, facture d'acompte, reçu) ou « autre ».
- Les échéances sont les acomptes et soldes prévus avec leur montant et leur date si indiqués.
- N'invente rien : omets les champs absents. Pas de valeur devinée.`;

const TOOL = {
  name: "enregistrer_prestataire",
  description: "Enregistre ce que dit le document sur le prestataire.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: ["string", "null"], description: "Nom commercial du prestataire" },
      category: { type: ["string", "null"], description: "Métier : Traiteur, Lieu, Photo & vidéo, Fleurs & déco, DJ, Robe…" },
      contact_name: { type: ["string", "null"] },
      contact_role: { type: ["string", "null"] },
      phone: { type: ["string", "null"] },
      email: { type: ["string", "null"] },
      website: { type: ["string", "null"] },
      address: { type: ["string", "null"] },
      iban: { type: ["string", "null"] },
      bic: { type: ["string", "null"] },
      account_holder: { type: ["string", "null"] },
      kind: { type: "string", enum: ["devis", "facture", "autre"] },
      title: { type: ["string", "null"], description: "Titre court pour ranger le document : « Devis traiteur », « Facture d'acompte »" },
      amount: { type: ["number", "null"], description: "Total TTC en euros" },
      date: { type: ["string", "null"], description: "Date du document, AAAA-MM-JJ" },
      installments: {
        type: "array",
        items: { type: "object", properties: { label: { type: "string" }, amount: { type: ["number", "null"] }, due_date: { type: ["string", "null"], description: "AAAA-MM-JJ" } }, required: ["label"] },
      },
    },
    required: ["kind", "installments"],
  },
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

  const raw = await req.text();
  if (raw.length > MAX_BYTES) return Response.json({ error: "too_big" }, { status: 413 });
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const s = body.source || {};
  const name = String(s.name || "document").slice(0, 120);
  const content = [];
  if (s.kind === "text") content.push({ type: "text", text: `Document « ${name} » :\n${String(s.content || "").slice(0, MAX_TEXT)}` });
  else if (s.kind === "image" && /^image\/(png|jpeg|gif|webp)$/.test(s.mime)) {
    content.push({ type: "text", text: `Document « ${name} » (photo) :` });
    content.push({ type: "image", source: { type: "base64", media_type: s.mime, data: String(s.content || "") } });
  } else if (s.kind === "pdf") {
    content.push({ type: "text", text: `Document « ${name} » (PDF) :` });
    content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: String(s.content || "") } });
  } else return Response.json({ error: "bad_request" }, { status: 400 });
  if (body.vendor) content.push({ type: "text", text: `Fiche actuelle du prestataire (à compléter, pas à contredire sans raison) : ${JSON.stringify(body.vendor).slice(0, 1500)}` });
  content.push({ type: "text", text: "Relève maintenant les informations du prestataire et enregistre-les." });

  const call = () =>
    fetch(`${API}/v1/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: 2000, system: SYSTEM, tools: [TOOL], tool_choice: { type: "tool", name: TOOL.name }, messages: [{ role: "user", content }] }),
    });
  let res = await call();
  if (res.status === 429 || res.status >= 500) {
    await new Promise((r) => setTimeout(r, 1500));
    res = await call();
  }
  if (!res.ok) {
    console.error("[merry] lecture prestataire", res.status, await res.text().catch(() => ""));
    return Response.json({ error: "ai_failed" }, { status: 502 });
  }
  const out = await res.json();
  const used = (out.content || []).find((c) => c.type === "tool_use");
  if (!used) return Response.json({ error: "ai_failed" }, { status: 502 });
  return Response.json({ found: used.input });
}

// Lecture d'un devis ou d'une facture par l'IA : type de document, prestataire, poste,
// montant, dates, ce qui est déjà payé, échéances à venir et RIB.
// Réservée aux organisateurs connectés (même compteur quotidien que l'import des invités).
// Nécessite ANTHROPIC_API_KEY ; sans clé, l'appli demande au couple de remplir les champs.

import { createClient } from "@supabase/supabase-js";
import { isForced, refusesForcedTool, rememberNoForce, withTool } from "@/lib/aiTool";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 4.4 * 1024 * 1024;
const DAILY_LIMIT = 200;
const MODEL = process.env.MERRY_AI_MODEL || "claude-sonnet-5-5";
const API = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";

const SYSTEM = `Tu lis des devis, contrats et factures de prestataires de mariage (lieu, traiteur, photographe, DJ, fleuriste, alliances, tenues…), en PDF, en photo ou en capture d'écran, y compris des reçus d'acompte et des captures de virement.

Ton travail : remplir l'outil avec ce que dit le document, rien de plus.

- doc_type : "devis_signe" si le document porte une signature, un « bon pour accord », une mention de signature électronique ou un acompte déjà versé ; "facture" pour une facture ou un reçu de paiement ; "devis_non_signe" pour une proposition sans signature ni paiement. Pour un reçu ou une capture de virement seule, "devis_signe" si elle concerne un acompte, "facture" si elle solde tout.
- vendor_name : le nom commercial du prestataire (pas le couple). category : le poste, en un ou deux mots français (Lieu, Traiteur, Photo & vidéo, Musique, Fleurs & déco, Alliances, Tenues, Faire-part, Beauté, Hébergement…).
- total : le montant total TTC en euros, nombre sans symbole. S'il n'y a que du HT, mets le HT et ajoute "total" à uncertain.
- doc_date : date de signature pour un devis signé, date de règlement pour une facture, date d'émission sinon, au format AAAA-MM-JJ.
- paid : chaque paiement déjà effectué que le document mentionne (acompte reçu, facture réglée), avec sa date si elle figure. payer_hint : le nom qui apparaît pour celui qui a payé (titulaire du compte, de la carte, signataire), sinon null.
- upcoming : chaque échéance encore à payer, avec son libellé (Acompte, 2e acompte, Solde) et sa date si elle figure. Une échéance exprimée en délai (« J-30 », « un mois avant ») : laisse la date vide et mets le délai dans le libellé.
- iban, bic : seulement s'ils figurent sur le document.
- uncertain : la liste des champs mal lisibles, ambigus ou déduits (ex. "doc_date" pour une date manuscrite, "doc_type" pour un devis sans signature visible sur le scan).

Ne devine jamais un montant, une date ou un nom absent : laisse null.`;

const TOOL = {
  name: "enregistrer_document",
  description: "Enregistre ce que dit le devis ou la facture.",
  input_schema: {
    type: "object",
    properties: {
      doc_type: { type: "string", enum: ["devis_signe", "devis_non_signe", "facture"] },
      vendor_name: { type: ["string", "null"] },
      category: { type: ["string", "null"] },
      total: { type: ["number", "null"] },
      doc_date: { type: ["string", "null"] },
      paid: {
        type: "array",
        items: { type: "object", properties: { label: { type: "string" }, amount: { type: "number" }, date: { type: ["string", "null"] } }, required: ["label", "amount"] },
      },
      upcoming: {
        type: "array",
        items: { type: "object", properties: { label: { type: "string" }, amount: { type: "number" }, due_date: { type: ["string", "null"] } }, required: ["label", "amount"] },
      },
      payer_hint: { type: ["string", "null"] },
      iban: { type: ["string", "null"] },
      bic: { type: ["string", "null"] },
      uncertain: { type: "array", items: { type: "string" } },
    },
    required: ["doc_type", "vendor_name", "category", "total", "doc_date", "paid", "upcoming", "uncertain"],
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
  if (s.kind === "image" && /^image\/(png|jpeg|gif|webp)$/.test(s.mime)) {
    content.push({ type: "text", text: `Fichier « ${name} » (photo) :` });
    content.push({ type: "image", source: { type: "base64", media_type: s.mime, data: String(s.content || "") } });
  } else if (s.kind === "pdf") {
    content.push({ type: "text", text: `Fichier « ${name} » (PDF) :` });
    content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: String(s.content || "") } });
  } else {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const postes = (body.postes || []).map(String).slice(0, 40);
  const people = (body.people || []).map(String).slice(0, 20);
  content.push({
    type: "text",
    text: `Postes déjà dans le budget du couple : ${postes.join(", ") || "aucun"} (reprends le libellé exact quand c'est le même poste). Organisateurs du mariage : ${people.join(", ") || "inconnus"}. Enregistre maintenant ce document.`,
  });

  const call = () =>
    fetch(`${API}/v1/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(withTool({ model: MODEL, max_tokens: 2000, system: SYSTEM, messages: [{ role: "user", content }] }, TOOL)),
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
    console.error("[merry] lecture devis", res.status, await res.text().catch(() => ""));
    return Response.json({ error: "ai_failed" }, { status: 502 });
  }
  const out = await res.json();
  const used = (out.content || []).find((c) => c.type === "tool_use");
  if (!used) return Response.json({ error: "ai_failed" }, { status: 502 });
  return Response.json({ doc: used.input });
}

// Classe les photos du catalogue : capture d'écran/logo à écarter, extérieur/intérieur pour les lieux.
// Après supabase/qualite-photos.sql. Lancer : SUPABASE_SERVICE_ROLE_KEY=... ANTHROPIC_API_KEY=... node scripts/catalog/12-photos-qualite.mjs
// Relançable sans risque : ne reprend que les photos dont classified_at est encore vide.
// Modèle volontairement bon marché (classification courte, pas de raisonnement) : MERRY_AI_MODEL_FAST
// s'il est défini, sinon Haiku 5.5 par défaut — ne jamais retomber sur MERRY_AI_MODEL (Sonnet), ~30x plus cher ici.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const API = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";
const MODEL = process.env.MERRY_AI_MODEL_FAST || "claude-haiku-5-5";
const BATCH = 200;
const CONCURRENCY = 8;
const MAX_IMAGE_BYTES = 4.4 * 1024 * 1024;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Il manque NEXT_PUBLIC_SUPABASE_URL et/ou SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
if (!ANTHROPIC_KEY) {
  console.error("Il manque ANTHROPIC_API_KEY.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const SYSTEM = `Tu examines des photos de fiches de prestataires de mariage (lieux de réception, traiteurs, photographes, DJ, fleuristes…), récupérées sur leur site ou leur fiche Google. Beaucoup sont de vraies photos, certaines sont des captures d'écran du site, des logos, des visuels promotionnels avec du texte, ou des bandeaux de chargement flous. Ton travail : dire si c'est une vraie photo ou pas, et pour un lieu de réception, si la photo montre l'extérieur (façade, jardin, terrasse, parc) ou l'intérieur (salle, réception).`;

const TOOL = {
  name: "classer_photo",
  description: "Classe une photo de fiche prestataire.",
  input_schema: {
    type: "object",
    properties: {
      screenshot: {
        type: "boolean",
        description: "Vrai si ce n'est pas une vraie photographie : capture d'écran, logo, visuel promo avec du texte, image de chargement/placeholder floue.",
      },
      shot_type: {
        type: ["string", "null"],
        enum: ["exterieur", "interieur", "autre", null],
        description: "Seulement pour un lieu de réception et si screenshot est faux : \"exterieur\" ou \"interieur\". \"autre\" si la catégorie n'est pas un lieu, si le cadrage ne le dit pas clairement, ou si screenshot est vrai.",
      },
    },
    required: ["screenshot", "shot_type"],
  },
};

const EXT_MEDIA_TYPE = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };

function mediaTypeOf(path) {
  const ext = String(path).split(".").pop()?.toLowerCase();
  return EXT_MEDIA_TYPE[ext] || "image/jpeg";
}

async function classify(photo, vendorCategory) {
  const { data: blob, error: dlError } = await supabase.storage.from("catalog-photos").download(photo.storage_path);
  if (dlError || !blob) return { screenshot: null, shot_type: null, skip: `téléchargement : ${dlError?.message || "vide"}` };
  const bytes = Buffer.from(await blob.arrayBuffer());
  if (bytes.byteLength > MAX_IMAGE_BYTES) return { screenshot: null, shot_type: null, skip: "trop lourde" };

  const content = [
    { type: "text", text: `Catégorie du prestataire : ${vendorCategory || "inconnue"}. Classe cette photo.` },
    { type: "image", source: { type: "base64", media_type: mediaTypeOf(photo.storage_path), data: bytes.toString("base64") } },
  ];
  const payload = {
    model: MODEL,
    max_tokens: 200,
    system: SYSTEM,
    tools: [TOOL],
    tool_choice: { type: "tool", name: TOOL.name },
    messages: [{ role: "user", content }],
  };

  const call = () =>
    fetch(`${API}/v1/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(payload),
    });

  let res = await call();
  if (res.status === 429 || res.status >= 500) {
    await new Promise((r) => setTimeout(r, 1500));
    res = await call();
  }
  if (!res.ok) return { screenshot: null, shot_type: null, skip: `IA ${res.status} : ${await res.text().catch(() => "")}` };
  const out = await res.json();
  const used = (out.content || []).find((c) => c.type === "tool_use");
  if (!used) return { screenshot: null, shot_type: null, skip: "pas de réponse exploitable" };
  return { screenshot: Boolean(used.input.screenshot), shot_type: used.input.shot_type || null };
}

async function runBatch(rows, categoryOf) {
  let i = 0;
  let done = 0;
  async function worker() {
    while (i < rows.length) {
      const row = rows[i++];
      const result = await classify(row, categoryOf.get(row.vendor_id));
      if (result.skip) console.warn(`[photos-qualite] ${row.vendor_id}/${row.storage_path} : ${result.skip}`);
      const { error } = await supabase
        .schema("catalog")
        .from("vendor_photos")
        .update({ screenshot: result.screenshot, shot_type: result.shot_type, classified_at: new Date().toISOString() })
        .eq("id", row.id);
      if (error) console.error(`[photos-qualite] écriture ${row.id} :`, error.message);
      done++;
      if (done % 50 === 0) console.log(`[photos-qualite] ${done}/${rows.length}`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}

async function main() {
  let total = 0;
  for (;;) {
    const { data: rows, error } = await supabase
      .schema("catalog")
      .from("vendor_photos")
      .select("id, vendor_id, storage_path")
      .is("classified_at", null)
      .limit(BATCH);
    if (error) {
      console.error("[photos-qualite] lecture :", error.message);
      process.exit(1);
    }
    if (!rows?.length) break;
    const vendorIds = [...new Set(rows.map((r) => r.vendor_id))];
    const { data: vendors, error: vError } = await supabase.schema("catalog").from("vendors").select("id, primary_category").in("id", vendorIds);
    if (vError) {
      console.error("[photos-qualite] lecture prestataires :", vError.message);
      process.exit(1);
    }
    const categoryOf = new Map((vendors || []).map((v) => [v.id, v.primary_category]));
    await runBatch(rows, categoryOf);
    total += rows.length;
    console.log(`[photos-qualite] lot terminé, ${total} photos classées au total`);
  }
  console.log(total ? `[photos-qualite] terminé : ${total} photos classées.` : "[photos-qualite] rien à classer.");
}

main();

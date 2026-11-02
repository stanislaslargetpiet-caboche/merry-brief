// Source une photo de couverture via Google Places (New) pour les prestataires actifs, toutes catégories,
// sans aucune photo (photos_count = 0) — le scraping du site n'a rien trouvé pour eux. Le libellé du métier
// est ajouté à la recherche (ex. « Nom Ville Photographe ») pour limiter les faux positifs sur les noms
// courants, fréquents chez les indépendants (DJ, vidéaste, wedding planner). Une seule photo pour l'instant.
// Lancer : GOOGLE_PLACES_API_KEY=... node scripts/catalog/13-photos-google-places.mjs
// Nécessite "Places API (New)" activée et facturée sur le projet Google Cloud de la clé.
// Relançable sans risque : ne reprend que les prestataires dont photos_count est encore 0.
// Après ce script, relancer scripts/catalog/12-photos-qualite.mjs pour classer les nouvelles photos
// (la position en couverture reste la seule de toute façon, mais ça les marque comme vraies photos).

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY;
const CONCURRENCY = 5;
const MAX_WIDTH_PX = 1600;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Il manque NEXT_PUBLIC_SUPABASE_URL et/ou SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
if (!GOOGLE_KEY) {
  console.error("Il manque GOOGLE_PLACES_API_KEY (Places API (New) activée et facturée).");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function withRetry(call) {
  let res = await call();
  if (res.status === 429 || res.status >= 500) {
    await new Promise((r) => setTimeout(r, 1500));
    res = await call();
  }
  return res;
}

// Cherche le prestataire sur Google Places et renvoie sa meilleure photo (nom de ressource), ou une erreur.
async function findCoverPhoto(vendor, categoryLabel) {
  const query = [vendor.name, vendor.city, vendor.postal_code, categoryLabel].filter(Boolean).join(" ");
  const res = await withRetry(() =>
    fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Goog-Api-Key": GOOGLE_KEY,
        "X-Goog-FieldMask": "places.id,places.displayName,places.photos",
      },
      body: JSON.stringify({ textQuery: query, languageCode: "fr", regionCode: "FR" }),
    }),
  );
  if (!res.ok) return { error: `recherche ${res.status} : ${await res.text().catch(() => "")}` };
  const out = await res.json();
  const place = (out.places || [])[0];
  const photo = place?.photos?.[0];
  if (!photo) return { error: "pas de résultat Google ou pas de photo" };
  return { name: photo.name, matched: place.displayName?.text };
}

async function downloadPhoto(photoName) {
  const url = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${MAX_WIDTH_PX}&key=${GOOGLE_KEY}`;
  const res = await withRetry(() => fetch(url));
  if (!res.ok) return { error: `téléchargement ${res.status}` };
  const contentType = res.headers.get("content-type") || "image/jpeg";
  const ext = contentType.includes("png") ? "png" : "jpg";
  return { bytes: Buffer.from(await res.arrayBuffer()), contentType, ext };
}

async function processVendor(vendor, categoryLabel) {
  const found = await findCoverPhoto(vendor, categoryLabel);
  if (found.error) return { ok: false, reason: found.error };
  const dl = await downloadPhoto(found.name);
  if (dl.error) return { ok: false, reason: dl.error };

  const path = `${vendor.id}/google-1.${dl.ext}`;
  const { error: upError } = await supabase.storage.from("catalog-photos").upload(path, dl.bytes, { contentType: dl.contentType, upsert: true });
  if (upError) return { ok: false, reason: `stockage : ${upError.message}` };

  const { error: insError } = await supabase.schema("catalog").from("vendor_photos").insert({ vendor_id: vendor.id, position: 0, storage_path: path });
  if (insError) return { ok: false, reason: `écriture photo : ${insError.message}` };

  const { error: updError } = await supabase.schema("catalog").from("vendors").update({ photos_count: 1 }).eq("id", vendor.id);
  if (updError) return { ok: false, reason: `écriture prestataire : ${updError.message}` };

  return { ok: true, matched: found.matched };
}

// Les échecs (rien trouvé côté Google) laissent photos_count à 0 : une relecture filtrée sur ce critère
// les reprendrait à l'infini dans la même exécution. On charge donc une fois tous les prestataires à
// traiter, en page, puis on les traite en mémoire ; relancer le script plus tard reprend les échecs.
async function loadAll() {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .schema("catalog")
      .from("vendors")
      .select("id, name, city, postal_code, primary_category")
      .eq("status", "active")
      .eq("photos_count", 0)
      .range(from, from + 999);
    if (error) {
      console.error("[photos-google] lecture :", error.message);
      process.exit(1);
    }
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

async function loadCategoryLabels() {
  const { data, error } = await supabase.schema("catalog").from("categories").select("slug, label");
  if (error) {
    console.error("[photos-google] lecture catégories :", error.message);
    process.exit(1);
  }
  return new Map((data || []).map((c) => [c.slug, c.label]));
}

async function main() {
  const [rows, labelOf] = await Promise.all([loadAll(), loadCategoryLabels()]);
  console.log(`[photos-google] ${rows.length} prestataires sans photo à traiter.`);
  let totalOk = 0;
  let totalFail = 0;
  let i = 0;
  async function worker() {
    while (i < rows.length) {
      const vendor = rows[i++];
      const result = await processVendor(vendor, labelOf.get(vendor.primary_category));
      if (result.ok) {
        totalOk++;
        console.log(`[photos-google] (${i}/${rows.length}) ${vendor.name} ← "${result.matched}"`);
      } else {
        totalFail++;
        console.warn(`[photos-google] (${i}/${rows.length}) ${vendor.name} : ${result.reason}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`[photos-google] terminé : ${totalOk} photos ajoutées, ${totalFail} prestataires sans résultat exploitable.`);
}

main();

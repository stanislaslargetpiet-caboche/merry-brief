// Photos Google (Places API (New)) pour une fiche que le couple vient de créer depuis un résultat
// Google (« Ajouter un prestataire ») : on télécharge jusqu'à 5 photos de l'établissement dans le
// catalogue (bucket catalog-photos, table catalog.vendor_photos), comme scripts/catalog/13-photos-
// google-places.mjs le fait en lot, et on renvoie leurs liens signés pour la fiche et la sélection.
// Nécessite GOOGLE_PLACES_API_KEY et SUPABASE_SERVICE_ROLE_KEY côté serveur. Réservée aux
// organisateurs du mariage qui a créé la fiche (catalog.vendors.created_by_wedding) ; ne touche qu'une
// fiche encore sans photo ; 40 fiches par jour et par personne.

import { createClient } from "@supabase/supabase-js";
import { allowUser } from "@/lib/server/rate";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_PHOTOS = 5;
const MAX_WIDTH_PX = 1600;

function cleanKey(k) {
  return String(k || "").replace(/[^\x20-\x7e]/g, "").trim();
}

async function signed(admin, paths) {
  if (!paths.length) return [];
  const { data } = await admin.storage.from("catalog-photos").createSignedUrls(paths, 3600);
  const urlOf = new Map((data || []).map((x) => [x.path, x.signedUrl]));
  return paths.map((p) => urlOf.get(p)).filter(Boolean);
}

async function download(photoName, key) {
  const res = await fetch(`https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${MAX_WIDTH_PX}&key=${key}`);
  if (!res.ok) return null;
  const contentType = res.headers.get("content-type") || "image/jpeg";
  return { bytes: Buffer.from(await res.arrayBuffer()), contentType, ext: contentType.includes("png") ? "png" : "jpg" };
}

export async function POST(req) {
  const key = cleanKey(process.env.GOOGLE_PLACES_API_KEY);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || !url || !anon || !service) {
    const missing = [!key && "GOOGLE_PLACES_API_KEY", !service && "SUPABASE_SERVICE_ROLE_KEY"].filter(Boolean).join(", ");
    return Response.json({ error: "indisponible", reason: `clé manquante côté serveur : ${missing || "Supabase"}`, photos: [] }, { status: 501 });
  }

  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return Response.json({ error: "auth" }, { status: 401 });
  const sb = createClient(url, anon, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: user, error: authError } = await sb.auth.getUser();
  if (authError || !user?.user) return Response.json({ error: "auth" }, { status: 401 });

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const vendorId = String(body.vendorId || "");
  const placeId = String(body.placeId || "");
  if (!/^[0-9a-f-]{36}$/i.test(vendorId) || !/^[A-Za-z0-9_-]{5,300}$/.test(placeId)) return Response.json({ error: "bad_request" }, { status: 400 });

  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data: vendor } = await admin.schema("catalog").from("vendors").select("id, photos_count, created_by_wedding").eq("id", vendorId).maybeSingle();
  if (!vendor) return Response.json({ error: "not_found" }, { status: 404 });
  // Seule l'équipe du mariage qui a créé la fiche peut y rattacher des photos Google : une fiche du
  // catalogue ne doit pas recevoir les photos d'un autre établissement choisi par n'importe quel compte
  if (!vendor.created_by_wedding) return Response.json({ error: "forbidden", photos: [] }, { status: 403 });
  const { data: member } = await sb.from("wedding_members").select("id").eq("wedding_id", vendor.created_by_wedding).eq("user_id", user.user.id).maybeSingle();
  if (!member) return Response.json({ error: "forbidden", photos: [] }, { status: 403 });
  // Chaque appel coûte des photos Google : 40 fiches par jour et par personne
  if (!(await allowUser(sb, "google_photos", 40, 86400))) return Response.json({ error: "quota", photos: [] }, { status: 429 });

  // Déjà des photos (fiche du catalogue retrouvée plutôt que créée) : on renvoie sa couverture
  if (vendor.photos_count > 0) {
    const { data: ph } = await admin.schema("catalog").from("vendor_photos").select("storage_path").eq("vendor_id", vendorId).order("position").limit(1);
    return Response.json({ photos: await signed(admin, (ph || []).map((p) => p.storage_path)) });
  }

  const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "photos" },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[merry] photos google prestataire", res.status, text);
    return Response.json({ photos: [], reason: `Google ${res.status} : ${text.slice(0, 200)}` });
  }
  const place = await res.json();
  const wanted = (place.photos || []).slice(0, MAX_PHOTOS);
  if (!wanted.length) return Response.json({ photos: [], reason: "aucune photo sur Google pour ce lieu" });

  const files = await Promise.all(wanted.map((p) => download(p.name, key).catch(() => null)));
  const rows = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (!f) continue;
    const path = `${vendorId}/google-${i + 1}.${f.ext}`;
    const { error: upError } = await admin.storage.from("catalog-photos").upload(path, f.bytes, { contentType: f.contentType, upsert: true });
    if (upError) {
      console.error("[merry] photos google stockage", upError.message);
      continue;
    }
    rows.push({ vendor_id: vendorId, position: rows.length, storage_path: path, width: wanted[i].widthPx || null, height: wanted[i].heightPx || null });
  }
  if (!rows.length) return Response.json({ photos: [], reason: "téléchargement ou stockage impossible" });

  let { error: insError } = await admin.schema("catalog").from("vendor_photos").insert(rows);
  // Colonnes width/height absentes (supabase/qualite-photos.sql pas encore passé) : on écrit sans
  if (insError && /column|42703/i.test(`${insError.code} ${insError.message}`)) {
    ({ error: insError } = await admin.schema("catalog").from("vendor_photos").insert(rows.map(({ vendor_id, position, storage_path }) => ({ vendor_id, position, storage_path }))));
  }
  if (insError) {
    console.error("[merry] photos google écriture", insError.message);
    return Response.json({ photos: [], reason: `écriture catalogue : ${insError.message}` });
  }
  await admin.schema("catalog").from("vendors").update({ photos_count: rows.length }).eq("id", vendorId);
  return Response.json({ photos: await signed(admin, rows.map((r) => r.storage_path)) });
}

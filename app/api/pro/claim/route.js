// Espace prestataire : revendiquer sa fiche du catalogue (maquette V0, « Vérifions que c'est bien vous »).
// 1. send   : Supabase envoie un code à 6 chiffres à l'adresse mail de la fiche (jamais montrée en entier)
// 2. verify : le code ouvre une session pour cette adresse, et rattache la fiche au compte (pro_members)
// Créer sa fiche (maquette V0c), pour un établissement absent du catalogue :
// 1. create_send   : le code part à l'adresse que le prestataire a saisie
// 2. create_verify : le code ouvre la session, l'adresse est géocodée (Géoplateforme de l'IGN), la fiche est
//    créée dans catalog.vendors, active tout de suite, et rattachée au compte. Si une fiche active porte déjà
//    cette adresse mail, c'est elle qui est rattachée : pas de doublon.
// Nécessite SUPABASE_SERVICE_ROLE_KEY côté serveur (Vercel > Settings > Environment Variables) pour lire
// l'adresse de la fiche et la rattacher. Sans clé, la route répond 501 et l'écran le dit.
// Le mail « Magic Link » de Supabase doit contenir {{ .Token }} pour que le code y figure (README).

import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CATEGORIES = ["lieu", "photographe", "videaste", "traiteur", "dj", "musiciens", "fleuriste", "decoration", "wedding_planner", "patisserie", "beaute", "robe", "transport", "officiant"];

const clean = (v, max) => String(v || "").replace(/\s+/g, " ").trim().slice(0, max);

// Les champs de « Créer votre fiche », vérifiés ; null si l'un manque
function newVendor(raw) {
  const f = {
    name: clean(raw?.name, 120),
    category: clean(raw?.category, 40),
    address: clean(raw?.address, 200),
    postal_code: clean(raw?.postal_code, 10).replace(/\s/g, ""),
    city: clean(raw?.city, 80),
    phone: clean(raw?.phone, 30),
    siret: clean(raw?.siret, 20).replace(/\s/g, ""),
  };
  if (f.name.length < 2 || !CATEGORIES.includes(f.category) || !f.address || !/^\d{5}$/.test(f.postal_code) || !f.city) return null;
  if (f.siret && !/^\d{14}$/.test(f.siret)) return null;
  return f;
}

// Position, département et région de l'adresse (la rue, sinon la commune)
async function geocode(f) {
  const ask = async (q, type) => {
    const u = new URL("https://data.geopf.fr/geocodage/search");
    u.searchParams.set("q", q);
    u.searchParams.set("postcode", f.postal_code);
    u.searchParams.set("limit", "1");
    if (type) u.searchParams.set("type", type);
    try {
      const res = await fetch(u, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return null;
      return (await res.json()).features?.[0] || null;
    } catch {
      return null;
    }
  };
  const hit = (await ask(`${f.address} ${f.postal_code} ${f.city}`)) || (await ask(`${f.postal_code} ${f.city}`, "municipality"));
  if (!hit) return null;
  const [lng, lat] = hit.geometry.coordinates;
  const ctx = String(hit.properties.context || "").split(",").map((x) => x.trim());
  return { lat, lng, department: hit.properties.depcode || ctx[0] || null, region: ctx[2] || ctx[1] || null };
}

export async function POST(req) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) return Response.json({ error: "not_configured" }, { status: 501 });

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

  // 0. search : « Retrouvez votre établissement », avec la photo de couverture (stockage privé)
  if (body.action === "search") {
    const q = String(body.q || "").slice(0, 120);
    const { data, error } = await admin.rpc("pro_search", { q });
    if (error) return Response.json({ error: /PGRST202|Could not find/i.test(error.message) ? "setup" : "search_failed" }, { status: 500 });
    const paths = (data || []).map((r) => r.photo).filter(Boolean);
    const { data: urls } = paths.length ? await admin.storage.from("catalog-photos").createSignedUrls(paths, 3600) : { data: [] };
    const byPath = new Map((urls || []).map((u) => [u.path, u.signedUrl]));
    return Response.json({ results: (data || []).map((r) => ({ ...r, photo: r.photo ? byPath.get(r.photo) || null : null })) });
  }

  if (body.action === "create_send" || body.action === "create_verify") return create(body, admin, url, anon);

  const vendorId = String(body.vendorId || "");
  if (!UUID_RE.test(vendorId)) return Response.json({ error: "bad_request" }, { status: 400 });
  const { data: vendor } = await admin.schema("catalog").from("vendors").select("id, email, status").eq("id", vendorId).maybeSingle();
  if (!vendor || vendor.status !== "active") return Response.json({ error: "not_found" }, { status: 404 });
  const email = String(vendor.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return Response.json({ error: "no_email" }, { status: 422 });

  const auth = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });

  if (body.action === "send") {
    const { error } = await auth.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (error) {
      const wait = /rate|seconds|too many/i.test(error.message);
      return Response.json({ error: wait ? "wait" : "send_failed" }, { status: wait ? 429 : 502 });
    }
    return Response.json({ ok: true });
  }

  if (body.action === "verify") {
    const code = String(body.code || "").replace(/\D/g, "");
    if (code.length < 6 || code.length > 8) return Response.json({ error: "bad_code" }, { status: 400 });
    const { data, error } = await auth.auth.verifyOtp({ email, token: code, type: "email" });
    if (error || !data?.session || !data.user) return Response.json({ error: "bad_code" }, { status: 401 });

    // La fiche est à cette adresse : on la rattache au compte (une fois suffit)
    const { error: e1 } = await admin.from("pro_vendors").upsert({ vendor_id: vendorId }, { onConflict: "vendor_id", ignoreDuplicates: true });
    const { error: e2 } = await admin.from("pro_members").upsert({ vendor_id: vendorId, user_id: data.user.id, email }, { onConflict: "vendor_id,user_id", ignoreDuplicates: true });
    return linked(e1 || e2, data.session);
  }

  return Response.json({ error: "bad_request" }, { status: 400 });
}

function linked(error, session) {
  if (error) {
    const missing = /PGRST205|42P01|Could not find/i.test(`${error.code} ${error.message}`);
    return Response.json({ error: missing ? "setup" : "link_failed" }, { status: 500 });
  }
  return Response.json({ ok: true, session: { access_token: session.access_token, refresh_token: session.refresh_token } });
}

async function create(body, admin, url, anon) {
  const email = String(body.email || "").trim().toLowerCase();
  const fields = newVendor(body.fields);
  if (!EMAIL_RE.test(email) || email.length > 160 || !fields) return Response.json({ error: "bad_request" }, { status: 400 });
  const auth = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });

  if (body.action === "create_send") {
    const { error } = await auth.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (error) {
      const wait = /rate|seconds|too many/i.test(error.message);
      return Response.json({ error: wait ? "wait" : "send_failed" }, { status: wait ? 429 : 502 });
    }
    return Response.json({ ok: true });
  }

  const code = String(body.code || "").replace(/\D/g, "");
  if (code.length < 6 || code.length > 8) return Response.json({ error: "bad_code" }, { status: 400 });
  const { data, error } = await auth.auth.verifyOtp({ email, token: code, type: "email" });
  if (error || !data?.session || !data.user) return Response.json({ error: "bad_code" }, { status: 401 });

  // Une fiche active porte déjà cette adresse : on rattache celle-là
  const { data: same } = await admin.schema("catalog").from("vendors").select("id").eq("status", "active").ilike("email", email.replace(/[\\%_]/g, "\\$&")).limit(1);
  let vendorId = same?.[0]?.id;
  if (!vendorId) {
    const place = await geocode(fields);
    if (!place) return Response.json({ error: "address" }, { status: 422 });
    const { data: row, error: e0 } = await admin
      .schema("catalog")
      .from("vendors")
      .insert({
        name: fields.name,
        primary_category: fields.category,
        categories: [fields.category],
        address: fields.address,
        postal_code: fields.postal_code,
        city: fields.city,
        department: place.department,
        region: place.region,
        lat: place.lat,
        lng: place.lng,
        location: `SRID=4326;POINT(${place.lng} ${place.lat})`,
        email,
        phone: fields.phone || null,
        siret: fields.siret || null,
        siren: fields.siret ? fields.siret.slice(0, 9) : null,
        status: "active",
      })
      .select("id")
      .single();
    if (e0 || !row) return Response.json({ error: "create_failed" }, { status: 500 });
    vendorId = row.id;
  }
  const { error: e1 } = await admin.from("pro_vendors").upsert({ vendor_id: vendorId }, { onConflict: "vendor_id", ignoreDuplicates: true });
  const { error: e2 } = await admin.from("pro_members").upsert({ vendor_id: vendorId, user_id: data.user.id, email }, { onConflict: "vendor_id,user_id", ignoreDuplicates: true });
  return linked(e1 || e2, data.session);
}

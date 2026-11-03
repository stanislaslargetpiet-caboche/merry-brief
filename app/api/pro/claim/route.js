// Espace prestataire : revendiquer sa fiche du catalogue (maquette V0, « Vérifions que c'est bien vous »).
// 1. send   : Supabase envoie un code à 6 chiffres à l'adresse mail de la fiche (jamais montrée en entier)
// 2. verify : le code ouvre une session pour cette adresse, et rattache la fiche au compte (pro_members)
// Créer sa fiche (maquette V0c), pour un établissement absent du catalogue :
// 1. create_send   : le code part à l'adresse que le prestataire a saisie
// 2. create_verify : le code ouvre la session, l'adresse est géocodée (Géoplateforme de l'IGN), la fiche est
//    créée dans catalog.vendors, active tout de suite, et rattachée au compte. Si une fiche active que
//    personne ne gère encore porte déjà cette adresse mail, c'est elle qui est rattachée : pas de doublon.
// verify et create_verify : si l'écran envoie le jeton d'un prestataire déjà connecté, la fiche rejoint ce
// compte et aucune nouvelle session n'est renvoyée.
// Se connecter (un prestataire qui revient) : login_send envoie le code à l'adresse tapée, login_verify ouvre la session ;
// l'écran retrouve ensuite ses fiches (pro_me). lookup : une fiche par son identifiant (lien d'un mail : /pro?fiche=…).
// Première fiche rattachée à un compte : les crédits de bienvenue (MERRY_PRO_WELCOME_CREDITS, 100 par défaut) sont versés.
// Nécessite SUPABASE_SERVICE_ROLE_KEY côté serveur (Vercel > Settings > Environment Variables) pour lire
// l'adresse de la fiche et la rattacher. Sans clé, la route répond 501 et l'écran le dit.
// Le mail « Magic Link » de Supabase doit contenir {{ .Token }} pour que le code y figure (README).

import { createClient } from "@supabase/supabase-js";
import { clientIp } from "@/lib/server/origin";
import { allowKey } from "@/lib/server/rate";

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

const WELCOME_CREDITS = Math.max(0, Number(process.env.MERRY_PRO_WELCOME_CREDITS ?? 100) || 0);

// Un code par mail coûte un envoi et peut servir à importuner un établissement : par adresse IP
// (20 par heure), par fiche (5 par heure) et par adresse mail (5 par heure). Renvoie la réponse à
// rendre quand la limite est atteinte, sinon null.
async function throttled(admin, req, keys) {
  const all = [`claim-ip:${clientIp(req)}`, ...keys];
  const limits = { "claim-ip": [20, 3600], "claim-vendor": [5, 3600], "claim-email": [5, 3600] };
  for (const key of all) {
    const [max, seconds] = limits[key.split(":")[0]] || [5, 3600];
    if (!(await allowKey(admin, key, max, seconds))) return Response.json({ error: "wait" }, { status: 429 });
  }
  return null;
}

// Mail et téléphone masqués, comme pro_search
const emailHint = (email) => (/@/.test(String(email || "")) ? `${email[0]}•••${email.slice(email.indexOf("@"))}` : null);
const phoneHint = (phone) => {
  const d = String(phone || "").replace(/\D/g, "");
  return d.length >= 8 ? `${d.slice(0, 2)} •• •• •• ${d.slice(-2)}` : null;
};

// Déjà connecté (jeton envoyé par l'écran) : la fiche revendiquée ou créée rejoint ce compte, sans
// basculer sur celui de l'adresse qui a reçu le code
async function currentUser(admin, req) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data } = await admin.auth.getUser(token);
  return data?.user || null;
}

// Rattache la fiche au compte ; la première fois, les crédits de bienvenue sont versés (une seule fois par fiche)
async function attach(admin, vendorId, user, email) {
  const { data: existing, error: e0 } = await admin.from("pro_vendors").select("vendor_id").eq("vendor_id", vendorId).maybeSingle();
  if (e0) return e0;
  if (!existing) {
    const { error: e1 } = await admin.from("pro_vendors").insert({ vendor_id: vendorId, credits: WELCOME_CREDITS });
    if (e1 && !/23505/.test(String(e1.code))) return e1;
    if (!e1 && WELCOME_CREDITS > 0) {
      await admin.from("pro_ledger").insert({ vendor_id: vendorId, kind: "remboursement", label: `Bienvenue sur Merry : ${WELCOME_CREDITS} crédits offerts`, delta: WELCOME_CREDITS, balance: WELCOME_CREDITS });
    }
  }
  const { error: e2 } = await admin.from("pro_members").upsert({ vendor_id: vendorId, user_id: user.id, email }, { onConflict: "vendor_id,user_id", ignoreDuplicates: true });
  return e2 || null;
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
    if (!(await allowKey(admin, `claim-search:${clientIp(req)}`, 120, 600))) return Response.json({ error: "wait", results: [] }, { status: 429 });
    const q = String(body.q || "").slice(0, 120);
    const { data, error } = await admin.rpc("pro_search", { q });
    if (error) return Response.json({ error: /PGRST202|Could not find/i.test(error.message) ? "setup" : "search_failed" }, { status: 500 });
    const paths = (data || []).map((r) => r.photo).filter(Boolean);
    const { data: urls } = paths.length ? await admin.storage.from("catalog-photos").createSignedUrls(paths, 3600) : { data: [] };
    const byPath = new Map((urls || []).map((u) => [u.path, u.signedUrl]));
    return Response.json({ results: (data || []).map((r) => ({ ...r, photo: r.photo ? byPath.get(r.photo) || null : null })) });
  }

  if (body.action === "create_send" || body.action === "create_verify") return create(body, admin, url, anon, req);
  if (body.action === "login_send" || body.action === "login_verify") return login(body, admin, url, anon, req);

  // lookup : une fiche par son identifiant, pour ouvrir l'écran directement dessus (/pro?fiche=…)
  if (body.action === "lookup") {
    const id = String(body.vendorId || "");
    if (!UUID_RE.test(id)) return Response.json({ error: "bad_request" }, { status: 400 });
    const { data: v } = await admin
      .schema("catalog")
      .from("vendors")
      .select("id, name, city, address, postal_code, primary_category, email, phone, google_rating, google_review_count, status")
      .eq("id", id)
      .maybeSingle();
    if (!v || v.status !== "active") return Response.json({ error: "not_found" }, { status: 404 });
    const [{ data: cat }, { data: ph }, { data: claimed }] = await Promise.all([
      admin.schema("catalog").from("categories").select("label").eq("slug", v.primary_category).maybeSingle(),
      admin.schema("catalog").from("vendor_photos").select("storage_path").eq("vendor_id", id).order("position").limit(1),
      admin.from("pro_vendors").select("vendor_id").eq("vendor_id", id).maybeSingle(),
    ]);
    const path = ph?.[0]?.storage_path || null;
    const { data: signedUrl } = path ? await admin.storage.from("catalog-photos").createSignedUrl(path, 3600) : { data: null };
    return Response.json({
      result: {
        id: v.id,
        name: v.name,
        city: v.city,
        address: v.address,
        postal_code: v.postal_code,
        category: cat?.label || v.primary_category,
        photo: signedUrl?.signedUrl || null,
        email_hint: emailHint(String(v.email || "").trim().toLowerCase()),
        phone_hint: phoneHint(v.phone),
        rating: v.google_rating,
        reviews: v.google_review_count,
        claimed: !!claimed,
      },
    });
  }

  const vendorId = String(body.vendorId || "");
  if (!UUID_RE.test(vendorId)) return Response.json({ error: "bad_request" }, { status: 400 });
  const { data: vendor } = await admin.schema("catalog").from("vendors").select("id, email, status").eq("id", vendorId).maybeSingle();
  if (!vendor || vendor.status !== "active") return Response.json({ error: "not_found" }, { status: 404 });
  const email = String(vendor.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return Response.json({ error: "no_email" }, { status: 422 });

  const auth = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });

  if (body.action === "send") {
    const limited = await throttled(admin, req, [`claim-vendor:${vendorId}`, `claim-email:${email}`]);
    if (limited) return limited;
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

    // Le code prouve que la fiche est à vous : elle rejoint le compte connecté s'il y en a un, sinon
    // le compte de cette adresse
    const me = await currentUser(admin, req);
    const owner = me || data.user;
    return linked(await attach(admin, vendorId, owner, me?.email || email), me ? null : data.session, vendorId);
  }

  return Response.json({ error: "bad_request" }, { status: 400 });
}

// session : null quand le prestataire était déjà connecté (rien à changer côté navigateur)
function linked(error, session, vendorId) {
  if (error) {
    const missing = /PGRST205|42P01|Could not find/i.test(`${error.code} ${error.message}`);
    return Response.json({ error: missing ? "setup" : "link_failed" }, { status: 500 });
  }
  return Response.json({ ok: true, vendorId: vendorId || null, session: session ? { access_token: session.access_token, refresh_token: session.refresh_token } : null });
}

async function create(body, admin, url, anon, req) {
  const email = String(body.email || "").trim().toLowerCase();
  const fields = newVendor(body.fields);
  if (!EMAIL_RE.test(email) || email.length > 160 || !fields) return Response.json({ error: "bad_request" }, { status: 400 });
  const auth = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });

  if (body.action === "create_send") {
    const limited = await throttled(admin, req, [`claim-email:${email}`]);
    if (limited) return limited;
    // L'adresse est vérifiée avant d'envoyer le code : une adresse introuvable se corrige sans consommer de code
    if (!(await geocode(fields))) return Response.json({ error: "address" }, { status: 422 });
    const { error } = await auth.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (error) {
      const wait = /rate|seconds|too many/i.test(error.message);
      return Response.json({ error: wait ? "wait" : "send_failed" }, { status: wait ? 429 : 502 });
    }
    return Response.json({ ok: true });
  }

  const code = String(body.code || "").replace(/\D/g, "");
  if (code.length < 6 || code.length > 8) return Response.json({ error: "bad_code" }, { status: 400 });

  // Une fiche active du catalogue porte déjà cette adresse et personne ne la gère encore : on rattache
  // celle-là (pas de doublon). Une fiche déjà gérée sur Merry n'est jamais reprise : un prestataire
  // connecté qui crée une deuxième fiche avec sa propre adresse obtient bien une nouvelle fiche.
  // Sinon l'adresse est placée sur la carte avant de consommer le code (un code ne sert qu'une fois).
  const { data: same } = await admin.schema("catalog").from("vendors").select("id").eq("status", "active").ilike("email", email.replace(/[\\%_]/g, "\\$&")).limit(10);
  const sameIds = (same || []).map((r) => r.id);
  const { data: managed } = sameIds.length ? await admin.from("pro_vendors").select("vendor_id").in("vendor_id", sameIds) : { data: [] };
  const taken = new Set((managed || []).map((r) => r.vendor_id));
  let vendorId = sameIds.find((id) => !taken.has(id));
  const place = vendorId ? null : await geocode(fields);
  if (!vendorId && !place) return Response.json({ error: "address" }, { status: 422 });

  const { data, error } = await auth.auth.verifyOtp({ email, token: code, type: "email" });
  if (error || !data?.session || !data.user) return Response.json({ error: "bad_code" }, { status: 401 });

  if (!vendorId) {
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
  const me = await currentUser(admin, req);
  return linked(await attach(admin, vendorId, me || data.user, me?.email || email), me ? null : data.session, vendorId);
}

// Se connecter avec son adresse : un code, puis l'écran retrouve les fiches du compte
async function login(body, admin, url, anon, req) {
  const email = String(body.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 160) return Response.json({ error: "bad_request" }, { status: 400 });
  const auth = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  if (body.action === "login_send") {
    const limited = await throttled(admin, req, [`claim-email:${email}`]);
    if (limited) return limited;
    // Pas de compte à cette adresse : on ne crée rien, l'écran propose de retrouver ou créer sa fiche
    const { error } = await auth.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    if (error) {
      if (/signup|not allowed|not found/i.test(error.message)) return Response.json({ error: "no_account" }, { status: 404 });
      const wait = /rate|seconds|too many/i.test(error.message);
      return Response.json({ error: wait ? "wait" : "send_failed" }, { status: wait ? 429 : 502 });
    }
    return Response.json({ ok: true });
  }
  const code = String(body.code || "").replace(/\D/g, "");
  if (code.length < 6 || code.length > 8) return Response.json({ error: "bad_code" }, { status: 400 });
  const { data, error } = await auth.auth.verifyOtp({ email, token: code, type: "email" });
  if (error || !data?.session || !data.user) return Response.json({ error: "bad_code" }, { status: 401 });
  return linked(null, data.session);
}

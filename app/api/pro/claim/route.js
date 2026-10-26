// Espace prestataire : revendiquer sa fiche du catalogue (maquette V0, « Vérifions que c'est bien vous »).
// 1. send   : Supabase envoie un code à 6 chiffres à l'adresse mail de la fiche (jamais montrée en entier)
// 2. verify : le code ouvre une session pour cette adresse, et rattache la fiche au compte (pro_members)
// Nécessite SUPABASE_SERVICE_ROLE_KEY côté serveur (Vercel > Settings > Environment Variables) pour lire
// l'adresse de la fiche et la rattacher. Sans clé, la route répond 501 et l'écran le dit.
// Le mail « Magic Link » de Supabase doit contenir {{ .Token }} pour que le code y figure (README).

import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    if (e1 || e2) {
      const missing = /PGRST205|42P01|Could not find/i.test(`${(e1 || e2).code} ${(e1 || e2).message}`);
      return Response.json({ error: missing ? "setup" : "link_failed" }, { status: 500 });
    }
    return Response.json({ ok: true, session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token } });
  }

  return Response.json({ error: "bad_request" }, { status: 400 });
}

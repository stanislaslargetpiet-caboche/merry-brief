// Rejoindre l'équipe d'un établissement avec un lien d'invitation (/pro?invitation=…), depuis l'espace
// prestataire : le collaborateur invité n'est plus envoyé vers l'inscription des couples (audit du 3 nov.
// 2026). Le jeton de la ligne pro_members fait office de secret, comme pro_join.
//   info   : le nom de l'établissement et l'adresse invitée (masquée), pour l'écran d'accueil
//   accept : déjà connecté (jeton de session envoyé) : le compte rejoint l'équipe tout de suite
//   send   : pas encore connecté : un code part à l'adresse invitée
//   verify : le code ouvre la session de cette adresse et le compte rejoint l'équipe
// Nécessite SUPABASE_SERVICE_ROLE_KEY ; sans clé, la route répond 501.

import { createClient } from "@supabase/supabase-js";
import { clientIp } from "@/lib/server/origin";
import { allowKey } from "@/lib/server/rate";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const emailHint = (email) => (/@/.test(String(email || "")) ? `${email[0]}•••${email.slice(email.indexOf("@"))}` : null);

// Le compte rejoint l'équipe ; s'il en faisait déjà partie, l'invitation devenue inutile est retirée
async function join(admin, member, user) {
  const { data: already } = await admin.from("pro_members").select("id").eq("vendor_id", member.vendor_id).eq("user_id", user.id).maybeSingle();
  if (already) {
    await admin.from("pro_members").delete().eq("id", member.id).is("user_id", null);
    return null;
  }
  const { error } = await admin
    .from("pro_members")
    .update({ user_id: user.id, joined_at: new Date().toISOString(), invite_token: crypto.randomUUID(), email: member.email || user.email })
    .eq("id", member.id)
    .is("user_id", null);
  return error;
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
  const token = String(body.token || "");
  if (!UUID_RE.test(token)) return Response.json({ error: "bad_link" }, { status: 400 });

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  if (!(await allowKey(admin, `invite-ip:${clientIp(req)}`, 30, 3600))) return Response.json({ error: "wait" }, { status: 429 });

  const { data: member } = await admin.from("pro_members").select("id, vendor_id, email, user_id").eq("invite_token", token).maybeSingle();
  if (!member || member.user_id) return Response.json({ error: "bad_link" }, { status: 404 });
  const email = String(member.email || "").trim().toLowerCase();

  if (body.action === "info") {
    const { data: v } = await admin.schema("catalog").from("vendors").select("name").eq("id", member.vendor_id).maybeSingle();
    // Le lien ouvert par un membre déjà dans l'équipe, connecté avec une autre adresse : l'écran le dit
    // d'emblée au lieu de proposer « Rejoindre l'équipe » puis de refuser (retour de Stan, 5 nov. 2026)
    let alreadyMember = false;
    const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: who } = bearer ? await admin.auth.getUser(bearer) : { data: null };
    if (who?.user && String(who.user.email || "").trim().toLowerCase() !== email) {
      const { data: already } = await admin.from("pro_members").select("id").eq("vendor_id", member.vendor_id).eq("user_id", who.user.id).maybeSingle();
      alreadyMember = !!already;
    }
    return Response.json({ vendor_name: v?.name || "cet établissement", email_hint: emailHint(email), already_member: alreadyMember });
  }

  if (body.action === "accept") {
    const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const { data } = bearer ? await admin.auth.getUser(bearer) : { data: null };
    if (!data?.user) return Response.json({ error: "auth" }, { status: 401 });
    // Un membre de l'équipe qui ouvre le lien d'un collègue (pour le vérifier, par exemple) ne doit pas
    // le consommer : sans cette garde, join() retirait l'invitation et la personne invitée trouvait un lien mort.
    if (String(data.user.email || "").trim().toLowerCase() !== email) {
      const { data: already } = await admin.from("pro_members").select("id").eq("vendor_id", member.vendor_id).eq("user_id", data.user.id).maybeSingle();
      if (already) return Response.json({ error: "already_member" }, { status: 409 });
    }
    const error = await join(admin, member, data.user);
    if (error) return Response.json({ error: "link_failed" }, { status: 500 });
    return Response.json({ ok: true, vendorId: member.vendor_id, session: null });
  }

  if (!EMAIL_RE.test(email)) return Response.json({ error: "no_email" }, { status: 422 });
  const auth = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });

  if (body.action === "send") {
    if (!(await allowKey(admin, `claim-email:${email}`, 5, 3600))) return Response.json({ error: "wait" }, { status: 429 });
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
    // Le mot de passe choisi avant le code (canvas Vendor-Invite-MotDePasse) : posé une fois le code vérifié
    const password = body.password === undefined ? undefined : String(body.password);
    if (password !== undefined && (password.length < 8 || password.length > 72)) return Response.json({ error: "bad_password" }, { status: 400 });
    const { data, error } = await auth.auth.verifyOtp({ email, token: code, type: "email" });
    if (error || !data?.session || !data.user) return Response.json({ error: "bad_code" }, { status: 401 });
    const e2 = await join(admin, member, data.user);
    if (e2) return Response.json({ error: "link_failed" }, { status: 500 });
    if (password !== undefined) {
      const { error: e3 } = await admin.auth.admin.updateUserById(data.user.id, { password, user_metadata: { ...(data.user.user_metadata || {}), merry_password: true } });
      if (e3) console.warn("[merry pro] mot de passe invité", e3.message);
    }
    return Response.json({ ok: true, vendorId: member.vendor_id, session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token } });
  }

  return Response.json({ error: "bad_request" }, { status: 400 });
}

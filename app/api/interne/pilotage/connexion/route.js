// Connexion au pilotage, étape 1 : envoyer le code. POST { email }. Une adresse sans compte en reçoit un (créé
// confirmé, sans mail), pour que le mail parti soit toujours « Magic Link » avec {{ .Token }} : pour un compte
// neuf, signInWithOtp enverrait « Confirm signup », qui n'a qu'un lien. Le code se vérifie dans le navigateur
// (verifyOtp) ; avoir un compte n'ouvre rien, l'accès se décide dans Coulisses › Accès.

import { createClient } from "@supabase/supabase-js";
import { clientIp } from "@/lib/server/origin";
import { allowKey } from "@/lib/server/rate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "private, no-store" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) return Response.json({ error: "indisponible" }, { status: 501, headers: NO_STORE });
  const body = await req.json().catch(() => null);
  const email = String(body?.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 160) return Response.json({ error: "invalide" }, { status: 400, headers: NO_STORE });
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  if (!(await allowKey(admin, `pilotage-code-ip:${clientIp(req)}`, 10, 3600)) || !(await allowKey(admin, `pilotage-code-email:${email}`, 5, 3600))) {
    return Response.json({ error: "attente" }, { status: 429, headers: NO_STORE });
  }
  const { error: e0 } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (e0 && !/already|exists|registered/i.test(e0.message || "") && e0.code !== "email_exists") {
    console.error("[merry] connexion pilotage, compte", e0.message);
    return Response.json({ error: "envoi" }, { status: 502, headers: NO_STORE });
  }
  const auth = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await auth.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  if (error) {
    const wait = /rate|seconds|too many/i.test(error.message);
    if (!wait) console.error("[merry] connexion pilotage, code", error.message);
    return Response.json({ error: wait ? "attente" : "envoi" }, { status: wait ? 429 : 502, headers: NO_STORE });
  }
  return Response.json({ ok: true }, { headers: NO_STORE });
}

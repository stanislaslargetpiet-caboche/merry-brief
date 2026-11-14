// Connexion au pilotage, étape 1 : envoyer le code. POST { email }. Une adresse sans compte en reçoit un (créé
// confirmé, sans mail). Le code vient de admin.generateLink (type "magiclink") : par conception, cette méthode
// ne part jamais de mail toute seule (contrairement à signInWithOtp, qui passerait par le template « Magic
// Link » de Supabase, collé à la main dans son dashboard) ; elle rend le code à 6 chiffres dans
// `properties.email_otp`, qu'on envoie nous-mêmes par Resend (codeMail.js, même pistache que les autres mails
// Merry). Le code se vérifie toujours dans le navigateur avec verifyOtp (type "email", inchangé) ; avoir un
// compte n'ouvre rien, l'accès se décide dans Coulisses › Accès.

import { createClient } from "@supabase/supabase-js";
import { sendCodePilotage } from "@/lib/server/pilotage/codeMail";
import { clientIp } from "@/lib/server/origin";
import { allowKey } from "@/lib/server/rate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "private, no-store" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return Response.json({ error: "indisponible" }, { status: 501, headers: NO_STORE });
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
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const token = data?.properties?.email_otp;
  if (error || !token) {
    console.error("[merry] connexion pilotage, code", error?.message || "pas de code rendu");
    return Response.json({ error: "envoi" }, { status: 502, headers: NO_STORE });
  }
  if (!(await sendCodePilotage(email, token))) {
    console.error("[merry] connexion pilotage, mail non parti");
    return Response.json({ error: "envoi" }, { status: 502, headers: NO_STORE });
  }
  return Response.json({ ok: true }, { headers: NO_STORE });
}

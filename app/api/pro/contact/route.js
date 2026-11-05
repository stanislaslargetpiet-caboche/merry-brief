// Espace prestataire : vérifier le mail de contact de la fiche (Ma fiche > Présentation), qui peut
// différer du mail du compte. Réservé aux membres connectés de la fiche.
// 1. send   : si l'adresse est celle du compte, déjà prouvée par le code de connexion, elle est validée
//             tout de suite ; sinon un code à 6 chiffres part à cette adresse (Resend), valable 15 minutes
// 2. verify : le bon code enregistre l'adresse dans pro_vendors.email_verified
// Nécessite SUPABASE_SERVICE_ROLE_KEY et supabase/pro-fiche-mail-verifie.sql ; sans le fichier SQL la
// route répond « setup », sans RESEND_API_KEY elle répond « no_mail ».

import { createHash, randomInt } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { allowKey } from "@/lib/server/rate";
import { mailShell } from "@/lib/server/mailShell";
import { renderMail } from "@/lib/server/mailTemplate";
import { sendMail } from "@/lib/server/sendMail";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_MINUTES = 15;
const MAX_ATTEMPTS = 5;

const missing = (error) => /PGRST204|PGRST205|42P01|42703|Could not find/i.test(`${error?.code} ${error?.message}`);
const hashOf = (vendorId, email, code) => createHash("sha256").update(`${vendorId}:${email}:${code}`).digest("hex");

async function markVerified(admin, vendorId, email) {
  const { error } = await admin.from("pro_vendors").update({ email_verified: email, email_verified_at: new Date().toISOString() }).eq("vendor_id", vendorId);
  if (error) return Response.json({ error: missing(error) ? "setup" : "save_failed" }, { status: 500 });
  await admin.from("pro_contact_codes").delete().eq("vendor_id", vendorId);
  return Response.json({ verified: true, email });
}

export async function POST(req) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return Response.json({ error: "not_configured" }, { status: 501 });
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return Response.json({ error: "auth" }, { status: 401 });

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const vendorId = String(body.vendorId || "");
  if (!UUID_RE.test(vendorId) || !["send", "verify"].includes(body.action)) return Response.json({ error: "bad_request" }, { status: 400 });

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth } = await admin.auth.getUser(token);
  const user = auth?.user;
  if (!user) return Response.json({ error: "auth" }, { status: 401 });
  const { data: member } = await admin.from("pro_members").select("id").eq("vendor_id", vendorId).eq("user_id", user.id).maybeSingle();
  if (!member) return Response.json({ error: "not_found" }, { status: 404 });

  const { data: vendor } = await admin.schema("catalog").from("vendors").select("name, email").eq("id", vendorId).maybeSingle();
  const email = String(vendor?.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return Response.json({ error: "no_email" }, { status: 422 });

  if (body.action === "send") {
    // Le compte s'est ouvert avec un code reçu à cette adresse : rien à renvoyer
    if (user.email_confirmed_at && String(user.email || "").toLowerCase() === email) return markVerified(admin, vendorId, email);
    if (!process.env.RESEND_API_KEY) return Response.json({ error: "no_mail" }, { status: 501 });
    for (const key of [`contact-vendor:${vendorId}`, `contact-email:${email}`]) {
      if (!(await allowKey(admin, key, 5, 3600))) return Response.json({ error: "wait" }, { status: 429 });
    }
    const code = String(randomInt(0, 1000000)).padStart(6, "0");
    const { error } = await admin
      .from("pro_contact_codes")
      .upsert({ vendor_id: vendorId, email, code_hash: hashOf(vendorId, email, code), attempts: 0, expires_at: new Date(Date.now() + CODE_MINUTES * 60000).toISOString(), created_at: new Date().toISOString() }, { onConflict: "vendor_id" });
    if (error) return Response.json({ error: missing(error) ? "setup" : "save_failed" }, { status: 500 });

    const name = vendor?.name || "ta fiche";
    const subject = `${code} : ton code Merry`;
    const paras = [`Voici le code pour vérifier l'adresse mail de ${name} sur Merry : ${code}`, `Il est valable ${CODE_MINUTES} minutes. Si tu n'as rien demandé, ignore ce mail.`];
    const html = mailShell({ title: subject, preheader: paras[0], body: renderMail({ title: "Ton code de vérification.", paras, why: `Tu reçois ce mail car cette adresse a été saisie sur la fiche ${name}.` }) });
    const sent = await sendMail({ to: email, subject, text: paras.join("\n\n"), html, label: "mail code contact prestataire" });
    if (!sent) return Response.json({ error: "send_failed" }, { status: 502 });
    return Response.json({ sent: true });
  }

  const code = String(body.code || "").replace(/\D/g, "");
  if (code.length !== 6) return Response.json({ error: "bad_code" }, { status: 400 });
  const { data: row, error } = await admin.from("pro_contact_codes").select("email, code_hash, attempts, expires_at").eq("vendor_id", vendorId).maybeSingle();
  if (error) return Response.json({ error: missing(error) ? "setup" : "bad_code" }, { status: 500 });
  // Un code demandé pour une autre adresse ne vaut plus rien dès que le mail de la fiche change
  if (!row || row.email !== email || new Date(row.expires_at) < new Date() || row.attempts >= MAX_ATTEMPTS) return Response.json({ error: "expired" }, { status: 410 });
  if (row.code_hash !== hashOf(vendorId, email, code)) {
    await admin.from("pro_contact_codes").update({ attempts: row.attempts + 1 }).eq("vendor_id", vendorId);
    return Response.json({ error: "bad_code" }, { status: 401 });
  }
  return markVerified(admin, vendorId, email);
}

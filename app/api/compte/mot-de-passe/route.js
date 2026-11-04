// Prévient la personne que son mot de passe vient de changer (planche V37). Envoyé par Merry plutôt
// que par la notification Supabase, pour passer dans tous les cas par le même chemin d'envoi.

import { createClient } from "@supabase/supabase-js";
import { allowUser } from "@/lib/server/rate";
import { mailShell } from "@/lib/server/mailShell";
import { sendMail } from "@/lib/server/sendMail";
import { renderMail } from "@/lib/server/mailTemplate";

export const runtime = "nodejs";

export async function POST(req) {
  if (!process.env.RESEND_API_KEY) return Response.json({ error: "no_mail" }, { status: 501 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!url || !key || !token) return Response.json({ error: "auth" }, { status: 401 });
  const sb = createClient(url, key, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data } = await sb.auth.getUser(token);
  const to = String(data?.user?.email || "").trim();
  if (!to) return Response.json({ error: "auth" }, { status: 401 });
  if (!(await allowUser(sb, "password_mail", 5, 86400))) return Response.json({ error: "quota" }, { status: 429 });

  const subject = "Ton mot de passe a été modifié";
  const para = "Si ce changement ne vient pas de toi, écris-nous tout de suite à bonjour@withmerry.com.";
  const body = renderMail({ title: `${subject}.`, paras: [para], why: "Tu reçois ce mail pour protéger ton compte Merry." });
  const html = mailShell({ title: subject, preheader: "Si ce n'est pas toi, écris-nous tout de suite.", body });
  const sent = await sendMail({ to, subject, text: `${subject}.\n\n${para}`, html, label: "mot de passe modifié" });
  return sent ? Response.json({ ok: true }) : Response.json({ error: "send_failed" }, { status: 502 });
}

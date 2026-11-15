// Bouton Aide du tableau de bord (option « Envoyer un message ») : part par mail à l'adresse de
// support Merry (MERRY_SUPPORT_EMAIL, Vercel > Settings > Environment Variables — jamais en dur ici,
// ce dépôt est public), avec reply-to l'adresse de la personne pour répondre directement.
// Nécessite RESEND_API_KEY et MERRY_SUPPORT_EMAIL ; sans l'une des deux, la route répond "no_mail".

import { createClient } from "@supabase/supabase-js";
import { allowUser } from "@/lib/server/rate";
import { mailShell } from "@/lib/server/mailShell";
import { renderMail } from "@/lib/server/mailTemplate";
import { sendMail } from "@/lib/server/sendMail";

export const runtime = "nodejs";

const MAX_LEN = 2000;

export async function POST(req) {
  const support = (process.env.MERRY_SUPPORT_EMAIL || "").trim();
  if (!process.env.RESEND_API_KEY || !support) return Response.json({ error: "no_mail" }, { status: 501 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!url || !key || !token) return Response.json({ error: "auth" }, { status: 401 });
  const sb = createClient(url, key, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: auth } = await sb.auth.getUser(token);
  const user = auth?.user;
  if (!user) return Response.json({ error: "auth" }, { status: 401 });

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const message = String(body.message || "").trim().slice(0, MAX_LEN);
  if (!message) return Response.json({ error: "bad_request" }, { status: 400 });
  const name = String(body.name || "").trim().slice(0, 80);
  const weddingName = String(body.weddingName || "").trim().slice(0, 120);

  if (!(await allowUser(sb, "aide_message", 5, 3600))) return Response.json({ error: "quota" }, { status: 429 });

  const from = name || user.email || "Un organisateur";
  const subject = weddingName ? `${from} a besoin d'aide (${weddingName})` : `${from} a besoin d'aide`;
  const paras = [message, `Répondre à : ${user.email || "adresse inconnue"}`];
  const html = mailShell({
    title: subject,
    preheader: message.slice(0, 140),
    body: renderMail({ title: "Message depuis le tableau de bord.", paras: [message], why: `Envoyé par ${from}${weddingName ? ` · ${weddingName}` : ""}` }),
  });
  const sent = await sendMail({ to: support, subject, text: paras.join("\n\n"), html, replyTo: user.email || undefined, label: "mail aide tableau de bord" });
  if (!sent) return Response.json({ error: "send_failed" }, { status: 502 });
  return Response.json({ ok: true });
}

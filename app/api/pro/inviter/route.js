// Envoi automatique de l'invitation d'un collaborateur par mail (via Resend), sur le modèle de
// /api/inviter (organisateurs côté couple). Réservé aux membres déjà connectés de la fiche.
// Nécessite RESEND_API_KEY côté serveur (Vercel > Settings > Environment Variables).
// Sans clé, la route répond 501 et l'espace prestataire retombe sur l'ouverture de la messagerie.

import { createClient } from "@supabase/supabase-js";
import { publicOrigin } from "@/lib/server/origin";
import { allowUser } from "@/lib/server/rate";

export const runtime = "nodejs";

const FROM = process.env.MERRY_MAIL_FROM || "Merry <onboarding@resend.dev>";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export async function POST(req) {
  if (!process.env.RESEND_API_KEY) return Response.json({ error: "no_mail" }, { status: 501 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!url || !key || !token) return Response.json({ error: "auth" }, { status: 401 });
  const sb = createClient(url, key, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const memberId = String(body.memberId || "");
  if (!memberId) return Response.json({ error: "bad_request" }, { status: 400 });

  const { data: user } = await sb.auth.getUser(token);
  if (!user?.user) return Response.json({ error: "auth" }, { status: 401 });

  // La lecture passe par les règles d'accès : seul un membre de la fiche voit cette ligne.
  const { data: member } = await sb.from("pro_members").select("id, vendor_id, display_name, email, invite_token, user_id").eq("id", memberId).maybeSingle();
  if (!member) return Response.json({ error: "not_found" }, { status: 404 });
  if (member.user_id) return Response.json({ error: "already_member" }, { status: 409 });
  const to = String(member.email || "").trim();
  if (!EMAIL_RE.test(to)) return Response.json({ error: "no_email" }, { status: 422 });

  const { data: vendor } = await sb.schema("catalog").from("vendors").select("name").eq("id", member.vendor_id).maybeSingle();
  const vendorName = vendor?.name || "votre établissement";

  if (!(await allowUser(sb, "invite_mail", 20, 86400))) return Response.json({ error: "quota" }, { status: 429 });
  const link = `${publicOrigin(req)}/pro?invitation=${member.invite_token}`;

  const subject = `Rejoignez ${vendorName} sur Merry`;
  const text = `Bonjour,\n\nJe vous invite à rejoindre notre espace prestataire sur Merry pour ${vendorName}.\n\n${link}`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#111">
<p>Bonjour,</p>
<p>Je vous invite à rejoindre notre espace prestataire sur Merry pour ${esc(vendorName)}.</p>
<p><a href="${esc(link)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600">Rejoindre Merry</a></p>
<p style="font-size:13px;color:#666">Ce lien ne sert qu'une fois. S'il ne s'ouvre pas, copiez-le dans votre navigateur :<br>${esc(link)}</p></div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    body: JSON.stringify({ from: FROM, to: [to], subject, text, html, reply_to: user.user.email || undefined, cc: user.user.email && user.user.email.toLowerCase() !== to.toLowerCase() ? [user.user.email] : undefined }),
  });
  if (!res.ok) {
    console.error("[merry] envoi invitation prestataire", res.status, await res.text().catch(() => ""));
    return Response.json({ error: "send_failed" }, { status: 502 });
  }
  return Response.json({ ok: true, to });
}

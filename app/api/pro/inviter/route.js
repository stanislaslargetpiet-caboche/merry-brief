// Envoi automatique de l'invitation d'un collaborateur par mail (via Resend), sur le modèle de
// /api/inviter (organisateurs côté couple). Réservé aux membres déjà connectés de la fiche.
// Nécessite RESEND_API_KEY côté serveur (Vercel > Settings > Environment Variables).
// Sans clé, la route répond 501 et l'espace prestataire retombe sur l'ouverture de la messagerie.

import { createClient } from "@supabase/supabase-js";
import { publicOrigin } from "@/lib/server/origin";
import { allowUser } from "@/lib/server/rate";
import { esc, logoBlock, mailShell } from "@/lib/server/mailShell";
import { sendMail } from "@/lib/server/sendMail";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const vendorName = vendor?.name || "ton établissement";

  if (!(await allowUser(sb, "invite_mail", 20, 86400))) return Response.json({ error: "quota" }, { status: 429 });
  const link = `${publicOrigin(req)}/pro?invitation=${member.invite_token}`;

  const initials =
    String(vendorName)
      .trim()
      .split(/\s+/)
      .map((w) => w[0] || "")
      .join("")
      .slice(0, 2)
      .toUpperCase() || "M";

  const subject = `Rejoins ${vendorName} sur Merry`;
  const text = `On t'invite à rejoindre l'équipe ${vendorName} sur Merry.\n\nTu pourras consulter et répondre aux demandes, gérer la fiche, les disponibilités et les crédits de ${vendorName}.\n\n${link}`;

  // Reprend à l'identique la planche V28 du canvas (page « 7 - mails ») : logo, titre, carte,
  // bouton, pied de page — sans le bloc vidéo du mock, en attendant l'export du GIF.

  const titleBlock = `<h1 style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:26px;line-height:1.15;color:#1c1c1a">Rejoins ${esc(vendorName)} sur Merry.</h1>`;

  const memberCard = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f1;border-radius:20px;border-collapse:separate"><tr><td style="padding:16px">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td width="36" height="36" align="center" valign="middle" style="width:36px;height:36px;border-radius:18px;background:#fffdb8;color:#574e00;font-size:13px;font-weight:700;line-height:36px">${esc(initials)}</td>
<td style="padding-left:10px;font-size:15px;font-weight:700">${esc(vendorName)}</td>
</tr></table>
</td></tr></table>`;

  const ctaBlock = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px"><tr><td align="center">
<a href="${esc(link)}" style="display:inline-block;background:#1c1c1a;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:700;font-size:15px">Rejoindre ${esc(vendorName)}</a>
</td></tr></table>`;

  const footerBlock = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;background:#f6f5f1;border-top:1px solid #ecebe6"><tr><td style="padding:18px 4px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="font-size:12px;color:#9c9a90;line-height:1.5">Merry · withmerry.com<br>Tu reçois ce mail car on t'a invité à rejoindre ${esc(vendorName)} sur Merry.</td>
</tr></table>
</td></tr></table>`;

  const preheader = `Tu pourras consulter et répondre aux demandes, gérer la fiche, les disponibilités et les crédits de ${vendorName}.`;
  const bodyHtml = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1c1c1a;max-width:560px">
${logoBlock}
${titleBlock}
${memberCard}
<p style="margin:20px 0 0;font-size:15px;line-height:1.6">Tu pourras consulter et répondre aux demandes, gérer la fiche, les disponibilités et les crédits de ${esc(vendorName)} sur Merry.</p>
${ctaBlock}
<p style="margin:20px 0 0;font-size:13px;color:#9c9a90">Ce lien d'invitation est personnel et à usage unique.</p>
${footerBlock}
</div>`;
  const html = mailShell({ title: subject, preheader, body: bodyHtml });

  if (!(await sendMail({ to, subject, text, html, replyTo: user.user.email, fromName: vendor?.name, label: "invitation prestataire" }))) return Response.json({ error: "send_failed" }, { status: 502 });
  return Response.json({ ok: true, to });
}

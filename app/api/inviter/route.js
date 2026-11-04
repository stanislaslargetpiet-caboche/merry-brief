// Envoi automatique de l'invitation d'un organisateur par mail (via Resend), sans passer
// par la messagerie de l'ordinateur de l'expéditeur. Réservé aux organisateurs connectés.
// Nécessite RESEND_API_KEY côté serveur (Vercel > Settings > Environment Variables).
// Sans clé, la route répond 501 et le tableau de bord retombe sur l'ouverture de la messagerie.

import { createClient } from "@supabase/supabase-js";
import { publicOrigin } from "@/lib/server/origin";
import { allowUser } from "@/lib/server/rate";
import { esc, logoBlock, mailShell } from "@/lib/server/mailShell";
import { sendMail } from "@/lib/server/sendMail";
import { displayName } from "@/lib/server/names";

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

  // La lecture passe par les règles d'accès : seul un organisateur du mariage voit cette ligne.
  const { data: member } = await sb.from("wedding_members").select("id, wedding_id, display_name, email, invite_token, user_id").eq("id", memberId).maybeSingle();
  if (!member) return Response.json({ error: "not_found" }, { status: 404 });
  if (member.user_id) return Response.json({ error: "already_member" }, { status: 409 });
  const to = String(member.email || "").trim();
  if (!EMAIL_RE.test(to)) return Response.json({ error: "no_email" }, { status: 422 });

  const { data: wedding } = await sb.from("weddings").select("partner1, partner2").eq("id", member.wedding_id).maybeSingle();
  const couple = [wedding?.partner1, wedding?.partner2].filter(Boolean).map(displayName).join(" et ") || "nos proches";

  // Signature : le prénom de l'organisateur qui envoie l'invitation
  const { data: me } = await sb.from("wedding_members").select("display_name").eq("wedding_id", member.wedding_id).eq("user_id", user.user.id).maybeSingle();
  const sender = displayName(me?.display_name || user.user.user_metadata?.first_name);

  // 20 invitations par jour et par personne : de quoi inviter toute une équipe, pas de quoi spammer
  if (!(await allowUser(sb, "invite_mail", 20, 86400))) return Response.json({ error: "quota" }, { status: 429 });
  const link = `${publicOrigin(req)}/connexion?invitation=${member.invite_token}`;

  const initials = [wedding?.partner1, wedding?.partner2].map((n) => String(n || "").trim()[0] || "").join("").toUpperCase() || "M";

  const subject = sender ? `${sender} t'invite à rejoindre Merry` : "Tu es invité(e) à rejoindre Merry";
  const text = `${sender ? `${sender} t'invite` : "Tu es invité(e)"} à rejoindre l'équipe qui organise le mariage de ${couple} sur Merry.\n\nTu pourras y gérer les invités, le budget, les prestataires et le rétroplanning, et c'est gratuit du début à la fin.\n\n${link}`;

  // Reprend à l'identique la planche V23 du canvas (page « 7 - mails ») : logo, titre, carte,
  // bouton, pied de page — sans le bloc vidéo du mock, en attendant l'export du GIF.

  const titleBlock = `<h1 style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:26px;line-height:1.15;color:#1c1c1a">${sender ? `${esc(sender)} t'invite à rejoindre Merry.` : "Tu es invité·e à rejoindre Merry."}</h1>`;

  const memberCard = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f1;border-radius:20px;border-collapse:separate"><tr><td style="padding:16px">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td width="36" height="36" align="center" valign="middle" style="width:36px;height:36px;border-radius:18px;background:#fffdb8;color:#574e00;font-size:13px;font-weight:700;line-height:36px">${esc(initials)}</td>
<td style="padding-left:10px;font-size:15px;font-weight:700">${esc(couple)}</td>
</tr></table>
</td></tr></table>`;

  const ctaBlock = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px"><tr><td align="center">
<a href="${esc(link)}" style="display:inline-block;background:#1c1c1a;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:700;font-size:15px">Rejoindre Merry</a>
</td></tr></table>`;

  const footerBlock = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;background:#f6f5f1;border-top:1px solid #ecebe6"><tr><td style="padding:18px 4px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="font-size:12px;color:#9c9a90;line-height:1.5">Merry · withmerry.com<br>Tu reçois ce mail car ${sender ? `${esc(sender)} t'a invité` : "on t'a invité"} à rejoindre son mariage sur Merry.</td>
</tr></table>
</td></tr></table>`;

  const preheader = `${sender ? `${sender} t'invite` : "Tu es invité·e"} à rejoindre l'équipe qui organise le mariage de ${couple} sur Merry.`;
  const bodyHtml = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1c1c1a;max-width:560px">
${logoBlock}
${titleBlock}
${memberCard}
<p style="margin:20px 0 0;font-size:15px;line-height:1.6">${sender ? esc(sender) : "On"} t'invite à rejoindre l'équipe qui organise le mariage de ${esc(couple)} sur Merry. Tu pourras y gérer les invités, le budget, les prestataires et le rétroplanning, et c'est gratuit du début à la fin.</p>
${ctaBlock}
<p style="margin:20px 0 0;font-size:13px;color:#9c9a90">Ce lien d'invitation est personnel et à usage unique.</p>
${footerBlock}
</div>`;
  const html = mailShell({ title: subject, preheader, body: bodyHtml });

  if (!(await sendMail({ to, subject, text, html, replyTo: user.user.email, fromName: sender, label: "invitation organisateur" }))) return Response.json({ error: "send_failed" }, { status: 502 });
  return Response.json({ ok: true, to });
}

// Prévient le reste de l'équipe par mail quand quelqu'un rejoint le mariage via un lien
// d'invitation (merry_join dans /connexion). Nécessite RESEND_API_KEY et
// SUPABASE_SERVICE_ROLE_KEY côté serveur (Vercel > Settings > Environment Variables) et
// supabase/wedding-notifier-nouveau-membre.sql (merry_notify_new_member_payload) collé dans
// Supabase. Sans clé, sans RPC ou sans autre membre à prévenir, la route répond sans rien
// envoyer : l'arrivée du nouveau membre reste de toute façon enregistrée dans Merry.

import { createClient } from "@supabase/supabase-js";
import { publicOrigin } from "@/lib/server/origin";
import { allowUser } from "@/lib/server/rate";
import { esc, heroBlock, mailShell } from "@/lib/server/mailShell";
import { sendMail } from "@/lib/server/sendMail";
import { displayName } from "@/lib/server/names";
import { optedOut } from "@/lib/server/mailOptouts";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req) {
  if (!process.env.RESEND_API_KEY) return Response.json({ error: "no_mail" }, { status: 501 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!url || !key || !token) return Response.json({ error: "auth" }, { status: 401 });
  const sb = createClient(url, key, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: user } = await sb.auth.getUser(token);
  if (!user?.user) return Response.json({ error: "auth" }, { status: 401 });

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const weddingId = String(body.weddingId || "");
  if (!weddingId) return Response.json({ error: "bad_request" }, { status: 400 });

  // La lecture passe par les règles d'accès : on ne retrouve que SA PROPRE ligne, celle que
  // merry_join vient de faire passer de invité à membre.
  const { data: me } = await sb.from("wedding_members").select("id").eq("wedding_id", weddingId).eq("user_id", user.user.id).maybeSingle();
  if (!me) return Response.json({ error: "not_found" }, { status: 404 });

  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!service) return Response.json({ error: "no_mail" }, { status: 501 });
  if (!(await allowUser(sb, "new_member_mail", 20, 86400))) return Response.json({ error: "quota" }, { status: 429 });
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: rows, error } = await admin.rpc("merry_notify_new_member_payload", { new_member_id: me.id });
  if (error) return Response.json({ error: "no_mail" }, { status: 501 });
  const valid = (rows || []).filter((r) => EMAIL_RE.test(String(r.to_email || "").trim()));
  const out = await optedOut(admin, valid.map((r) => r.to_email), "new_member");
  const recipients = valid.filter((r) => !out.has(String(r.to_email).trim().toLowerCase()));
  if (!recipients.length) return Response.json({ ok: true, sent: 0 });

  const newMemberName = displayName(recipients[0].new_member_name) || "Un nouvel organisateur";
  const link = `${publicOrigin(req)}/dashboard`;
  const initials =
    String(newMemberName)
      .trim()
      .split(/\s+/)
      .map((w) => w[0] || "")
      .join("")
      .slice(0, 2)
      .toUpperCase() || "M";

  const subject = `${newMemberName} a rejoint ton mariage sur Merry`;
  // Le mail part à toute l'équipe, pas seulement à la personne qui a invité : pas de « votre invitation »
  const text = `${newMemberName} fait maintenant partie de l'équipe qui organise ton mariage.\n\nVoir mes organisateurs : ${link}`;

  // Reprend à l'identique la planche V26 du canvas (page « 7 - mails ») : logo, titre, carte,
  // bouton, pied de page.

  const titleBlock = `${esc(newMemberName)} a rejoint ton mariage.`;

  const memberCard = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f1;border-radius:20px;border-collapse:separate"><tr><td style="padding:16px">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td width="36" height="36" align="center" valign="middle" style="width:36px;height:36px;border-radius:18px;background:#e6f7dc;color:#2f5a1a;font-size:13px;font-weight:700;line-height:36px">${esc(initials)}</td>
<td style="padding-left:10px;font-size:15px;font-weight:700">${esc(newMemberName)}</td>
</tr></table>
</td></tr></table>`;

  const ctaBlock = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px"><tr><td align="center">
<a href="${esc(link)}" style="display:inline-block;background:#1c1c1a;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:700;font-size:15px">Voir mes organisateurs</a>
</td></tr></table>`;

  const footerBlock = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;background:#f6f5f1;border-top:1px solid #ecebe6"><tr><td style="padding:18px 4px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="font-size:12px;color:#9c9a90;line-height:1.5">Merry · withmerry.com<br>Tu reçois ce mail car tu organises ce mariage sur Merry.</td>
<td align="right" valign="top"><a href="${esc(publicOrigin(req))}/dashboard/reglages" style="color:#9c9a90;text-decoration:underline;white-space:nowrap;font-size:12px">Gérer mes notifications</a></td>
</tr></table>
</td></tr></table>`;

  const preheader = `${newMemberName} fait maintenant partie de l'équipe qui organise ton mariage.`;
  const bodyHtml = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1c1c1a;max-width:560px">
${heroBlock({ title: titleBlock })}
${memberCard}
<p style="margin:20px 0 0;font-size:15px;line-height:1.6">${esc(newMemberName)} fait maintenant partie de l'équipe et peut consulter et modifier ton tableau de bord Merry&nbsp;: invités, budget, prestataires, rétroplanning.</p>
${ctaBlock}
${footerBlock}
</div>`;
  const html = mailShell({ title: subject, preheader, body: bodyHtml });

  let sent = 0;
  for (const r of recipients) {
    const to = String(r.to_email).trim();
    if (await sendMail({ to, subject, text, html, label: "notification nouveau membre" })) sent += 1;
  }
  return Response.json({ ok: true, sent });
}

// Prévient le reste de l'équipe par mail quand quelqu'un rejoint le mariage via un lien
// d'invitation (merry_join dans /connexion). Nécessite RESEND_API_KEY et
// SUPABASE_SERVICE_ROLE_KEY côté serveur (Vercel > Settings > Environment Variables) et
// supabase/wedding-notifier-nouveau-membre.sql (merry_notify_new_member_payload) collé dans
// Supabase. Sans clé, sans RPC ou sans autre membre à prévenir, la route répond sans rien
// envoyer : l'arrivée du nouveau membre reste de toute façon enregistrée dans Merry.

import { createClient } from "@supabase/supabase-js";
import { publicOrigin } from "@/lib/server/origin";
import { allowUser } from "@/lib/server/rate";
import { mailShell } from "@/lib/server/mailShell";

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
  const recipients = (rows || []).filter((r) => EMAIL_RE.test(String(r.to_email || "").trim()));
  if (!recipients.length) return Response.json({ ok: true, sent: 0 });

  const newMemberName = recipients[0].new_member_name || "Un nouvel organisateur";
  const link = `${publicOrigin(req)}/dashboard`;
  const initials =
    String(newMemberName)
      .trim()
      .split(/\s+/)
      .map((w) => w[0] || "")
      .join("")
      .slice(0, 2)
      .toUpperCase() || "M";

  const subject = `${newMemberName} a rejoint votre mariage sur Merry`;
  const text = `${newMemberName} a accepté votre invitation et fait maintenant partie de l'équipe.\n\nVoir mes organisateurs : ${link}`;

  // Reprend à l'identique la planche V26 du canvas (page « 7 - mails ») : logo, titre, carte,
  // bouton, pied de page.
  const logoBlock = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px"><tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" style="background:#fff700;border-radius:999px"><tr><td style="padding:10px 24px;font-size:22px;font-weight:800;letter-spacing:-0.01em;color:#1c1c1a">Merry</td></tr></table>
</td></tr></table>`;

  const titleBlock = `<h1 style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:26px;line-height:1.15;color:#1c1c1a">${esc(newMemberName)} a rejoint votre mariage.</h1>`;

  const memberCard = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f1;border-radius:20px;border-collapse:separate"><tr><td style="padding:16px">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td width="36" height="36" align="center" valign="middle" style="width:36px;height:36px;border-radius:18px;background:#fffdb8;color:#574e00;font-size:13px;font-weight:700;line-height:36px">${esc(initials)}</td>
<td style="padding-left:10px;font-size:15px;font-weight:700">${esc(newMemberName)}</td>
</tr></table>
</td></tr></table>`;

  const ctaBlock = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px"><tr><td align="center">
<a href="${esc(link)}" style="display:inline-block;background:#1c1c1a;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:700;font-size:15px">Voir mes organisateurs</a>
</td></tr></table>`;

  const footerBlock = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;background:#f6f5f1;border-top:1px solid #ecebe6"><tr><td style="padding:18px 4px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="font-size:12px;color:#9c9a90;line-height:1.5">Merry · withmerry.com<br>Vous recevez ce mail car vous aviez invité ${esc(newMemberName)} à rejoindre votre mariage.</td>
</tr></table>
</td></tr></table>`;

  const preheader = `${newMemberName} a accepté votre invitation et fait maintenant partie de l'équipe.`;
  const bodyHtml = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1c1c1a;max-width:560px">
${logoBlock}
${titleBlock}
${memberCard}
<p style="margin:20px 0 0;font-size:15px;line-height:1.6">${esc(newMemberName)} a accepté votre invitation et peut désormais consulter et modifier votre tableau de bord Merry&nbsp;: invités, budget, prestataires, rétroplanning.</p>
${ctaBlock}
${footerBlock}
</div>`;
  const html = mailShell({ title: subject, preheader, body: bodyHtml });

  let sent = 0;
  for (const r of recipients) {
    const to = String(r.to_email).trim();
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      body: JSON.stringify({ from: FROM, to: [to], subject, text, html }),
    });
    if (res.ok) sent += 1;
    else console.error("[merry] notification nouveau membre", res.status, await res.text().catch(() => ""));
  }
  return Response.json({ ok: true, sent });
}

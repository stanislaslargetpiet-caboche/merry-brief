// Prévient le couple par mail quand un prestataire leur répond via /pro/demandes (pro_send).
// Nécessite RESEND_API_KEY et SUPABASE_SERVICE_ROLE_KEY côté serveur (Vercel > Settings > Environment
// Variables) et supabase/prestataires-notifier-couple.sql (pro_notify_couple_payload) collé dans Supabase.
// Sans clé, sans RPC ou sans mail connu pour les organisateurs, la route répond sans rien
// envoyer : la réponse reste de toute façon enregistrée dans Merry, seul le mail est facultatif.

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
  const clientId = String(body.clientId || "");
  if (!clientId) return Response.json({ error: "bad_request" }, { status: 400 });

  // Les adresses des organisateurs ne sont lues que par le serveur (clé service_role), après avoir
  // vérifié avec le jeton du prestataire que ce client est bien l'un des siens (is_pro_member, RLS)
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!service) return Response.json({ error: "no_mail" }, { status: 501 });
  const { data: client } = await sb.from("pro_clients").select("id, vendor_id").eq("id", clientId).maybeSingle();
  if (!client) return Response.json({ error: "not_found" }, { status: 404 });
  const { data: mine } = await sb.rpc("is_pro_member", { v: client.vendor_id });
  if (mine !== true) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!(await allowUser(sb, "couple_mail", 60, 86400))) return Response.json({ error: "quota" }, { status: 429 });
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: rows, error } = await admin.rpc("pro_notify_couple_payload", { c: clientId });
  if (error) return Response.json({ error: "no_mail" }, { status: 501 });
  const recipients = (rows || []).filter((r) => EMAIL_RE.test(String(r.to_email || "").trim()));
  if (!recipients.length) return Response.json({ error: "no_email" }, { status: 422 });

  const link = `${publicOrigin(req)}/dashboard/prestataires/messagerie`;
  const vendorName = recipients[0].vendor_name || "Un prestataire";

  // Proposition depuis « Projets » : le prestataire écrit en premier, il ne « répond » à personne
  const verb = body.kind === "proposition" ? "vous a écrit" : "vous a répondu";
  const subject = `${vendorName} ${verb}`;
  // Plus de phrases grises sous le bouton (demande de Stan, 3 nov. 2026)
  const text = `Bonjour,\n\n${vendorName} ${verb} sur Merry.\n\nLire le message : ${link}`;
  const initials =
    String(vendorName)
      .trim()
      .split(/\s+/)
      .map((w) => w[0] || "")
      .join("")
      .slice(0, 2)
      .toUpperCase() || "M";

  // Reprend à l'identique la planche V20 du canvas (page « 7 - mails ») : logo, titre, carte
  // prestataire, bouton, bandeau sécurité, pied de page. Le mock montre en plus un aperçu du
  // message et la catégorie/zone du prestataire : pro_notify_couple_payload ne renvoie aujourd'hui
  // ni l'un ni l'autre, donc la carte reste au nom du prestataire seul tant que ce n'est pas ajouté
  // côté Supabase.
  const logoBlock = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px"><tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" style="background:#fff700;border-radius:999px"><tr><td style="padding:10px 24px;font-size:22px;font-weight:800;letter-spacing:-0.01em;color:#1c1c1a">Merry</td></tr></table>
</td></tr></table>`;

  const titleBlock = `<h1 style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:26px;line-height:1.15;color:#1c1c1a">${esc(vendorName)} ${verb}.</h1>`;

  const messageBox = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f1;border-radius:20px;border-collapse:separate"><tr><td style="padding:16px">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td width="36" height="36" align="center" valign="middle" style="width:36px;height:36px;border-radius:18px;background:#fffdb8;color:#574e00;font-size:13px;font-weight:700;line-height:36px">${esc(initials)}</td>
<td style="padding-left:10px;font-size:15px;font-weight:700">${esc(vendorName)}</td>
</tr></table>
</td></tr></table>`;

  const ctaBlock = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px"><tr><td align="center">
<a href="${esc(link)}" style="display:inline-block;background:#1c1c1a;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:700;font-size:15px">Répondre à ${esc(vendorName)}</a>
</td></tr></table>`;

  const securityBlock = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;background:#f6f5f1;border-radius:12px;border-collapse:separate"><tr><td style="padding:14px 16px;font-size:13px;line-height:1.5;color:#6b6a63">Pour votre sécurité, échangez et réglez toujours vos prestataires depuis Merry. N'envoyez jamais d'argent ou de coordonnées bancaires en dehors de la plateforme.</td></tr></table>`;

  const footerBlock = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;background:#f6f5f1;border-top:1px solid #ecebe6"><tr><td style="padding:18px 4px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="font-size:12px;color:#9c9a90;line-height:1.5">Merry · withmerry.com<br>Un message de votre tableau de bord Mariage.</td>
<td align="right" valign="top"><a href="${esc(publicOrigin(req))}/dashboard/reglages" style="color:#9c9a90;text-decoration:underline;white-space:nowrap;font-size:12px">Gérer mes notifications</a></td>
</tr></table>
</td></tr></table>`;

  const preheader = `Lisez le message de ${vendorName} et répondez directement depuis Merry.`;
  const bodyHtml = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1c1c1a;max-width:560px">
${logoBlock}
${titleBlock}
${messageBox}
${ctaBlock}
${securityBlock}
${footerBlock}
</div>`;
  const html = mailShell({ title: subject, preheader, body: bodyHtml });

  let sent = 0;
  for (const r of recipients) {
    const to = String(r.to_email).trim();
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      // Identifiant unique : sans lui, Gmail regroupe les messages et replie le bouton derrière « ••• »
      body: JSON.stringify({ from: FROM, to: [to], subject, text, html, headers: { "X-Entity-Ref-ID": crypto.randomUUID() } }),
    });
    if (res.ok) sent += 1;
    else console.error("[merry] notification couple", res.status, await res.text().catch(() => ""));
  }
  if (!sent) return Response.json({ error: "send_failed" }, { status: 502 });
  return Response.json({ ok: true, sent });
}

// Prévient le couple par mail quand un prestataire leur répond via /pro/demandes (pro_send).
// Nécessite RESEND_API_KEY et SUPABASE_SERVICE_ROLE_KEY côté serveur (Vercel > Settings > Environment
// Variables) et supabase/prestataires-notifier-couple.sql (pro_notify_couple_payload) collé dans Supabase.
// Sans clé, sans RPC ou sans mail connu pour les organisateurs, la route répond sans rien
// envoyer : la réponse reste de toute façon enregistrée dans Merry, seul le mail est facultatif.

import { createClient } from "@supabase/supabase-js";
import { publicOrigin } from "@/lib/server/origin";
import { allowUser } from "@/lib/server/rate";
import { esc, logoBlock, mailShell } from "@/lib/server/mailShell";
import { sendMail } from "@/lib/server/sendMail";
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
  const valid = (rows || []).filter((r) => EMAIL_RE.test(String(r.to_email || "").trim()));
  if (!valid.length) return Response.json({ error: "no_email" }, { status: 422 });
  const out = await optedOut(admin, valid.map((r) => r.to_email), "couple_reply");
  const recipients = valid.filter((r) => !out.has(String(r.to_email).trim().toLowerCase()));
  if (!recipients.length) return Response.json({ ok: true, sent: 0 });

  const link = `${publicOrigin(req)}/dashboard/prestataires/messagerie`;
  const vendorName = recipients[0].vendor_name || "Un prestataire";

  // Aperçu du message, catégorie et zone (planche V20). Sans la fonction SQL, la carte reste au nom seul.
  const { data: details } = await admin.rpc("pro_notify_couple_details", { client_id: clientId });
  const { last_message: lastMessage, category, area } = details?.[0] || {};
  const full = String(lastMessage || "").trim();
  const excerpt = full.length > 280 ? `${full.slice(0, 280).trimEnd()}…` : full;

  // Proposition depuis « Projets » : le prestataire écrit en premier, il ne « répond » à personne
  const verb = body.kind === "proposition" ? "t'a écrit" : "t'a répondu";
  const subject = `${vendorName} ${verb}`;
  // Plus de phrases grises sous le bouton (demande de Stan, 3 nov. 2026)
  const text = `Bonjour,\n\n${vendorName} ${verb} sur Merry.${excerpt ? `\n\n« ${excerpt} »` : ""}\n\nLire le message : ${link}`;
  const initials =
    String(vendorName)
      .trim()
      .split(/\s+/)
      .map((w) => w[0] || "")
      .join("")
      .slice(0, 2)
      .toUpperCase() || "M";

  // Reprend la planche V20 du canvas (page « 7 - mails ») : logo, titre, carte prestataire et aperçu,
  // bouton, bandeau sécurité, pied de page.

  const titleBlock = `<h1 style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:26px;line-height:1.15;color:#1c1c1a">${esc(vendorName)} ${verb}.</h1>`;

  const areaPill = area ? `<span style="background:#ebe6fb;color:#4a3d99;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:600">${esc(area)}</span>` : "";
  const subtitle = category || area ? `<div style="margin-top:3px;font-size:12px;line-height:1.6;color:#6b6a63">${category ? `${esc(category)} ` : ""}${areaPill}</div>` : "";
  const excerptBox = excerpt
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;background:#ffffff;border:1px solid #ecebe6;border-radius:12px;border-collapse:separate"><tr><td style="padding:14px;font-size:14.5px;line-height:1.55;white-space:pre-line;color:#1c1c1a">${esc(excerpt)}</td></tr></table>`
    : "";

  const messageBox = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f1;border-radius:20px;border-collapse:separate"><tr><td style="padding:16px">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td width="36" height="36" align="center" valign="middle" style="width:36px;height:36px;border-radius:18px;background:#fffdb8;color:#574e00;font-size:13px;font-weight:700;line-height:36px">${esc(initials)}</td>
<td style="padding-left:10px;font-size:15px;font-weight:700">${esc(vendorName)}${subtitle}</td>
</tr></table>
${excerptBox}
</td></tr></table>`;

  const ctaBlock = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px"><tr><td align="center">
<a href="${esc(link)}" style="display:inline-block;background:#1c1c1a;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:700;font-size:15px">Répondre à ${esc(vendorName)}</a>
</td></tr></table>`;

  const securityBlock = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;background:#f6f5f1;border-radius:12px;border-collapse:separate"><tr><td style="padding:14px 16px;font-size:13px;line-height:1.5;color:#6b6a63">Pour ta sécurité, échange avec tes prestataires et règle-les toujours depuis Merry. N'envoie jamais d'argent ou de coordonnées bancaires en dehors de la plateforme.</td></tr></table>`;

  const footerBlock = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;background:#f6f5f1;border-top:1px solid #ecebe6"><tr><td style="padding:18px 4px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="font-size:12px;color:#9c9a90;line-height:1.5">Merry · withmerry.com<br>Un message de ton tableau de bord Mariage.</td>
<td align="right" valign="top"><a href="${esc(publicOrigin(req))}/dashboard/reglages" style="color:#9c9a90;text-decoration:underline;white-space:nowrap;font-size:12px">Gérer mes notifications</a></td>
</tr></table>
</td></tr></table>`;

  const preheader = excerpt.slice(0, 140) || `Lis le message de ${vendorName} et réponds directement depuis Merry.`;
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
    if (await sendMail({ to, subject, text, html, label: "notification couple" })) sent += 1;
  }
  if (!sent) return Response.json({ error: "send_failed" }, { status: 502 });
  return Response.json({ ok: true, sent });
}

// Mail de bienvenue, envoyé juste après la confirmation d'adresse (retour du lien de
// confirmation Supabase sur /connexion, avant la redirection vers le tableau de bord).
// Nécessite RESEND_API_KEY côté serveur (Vercel > Settings > Environment Variables).
// Sans clé, la route répond 501 : la redirection vers le tableau de bord n'attend pas ce mail.

import { createClient } from "@supabase/supabase-js";
import { publicOrigin } from "@/lib/server/origin";
import { allowUser } from "@/lib/server/rate";
import { mailShell } from "@/lib/server/mailShell";

export const runtime = "nodejs";

const FROM = process.env.MERRY_MAIL_FROM || "Merry <onboarding@resend.dev>";

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
  const to = String(user.user.email || "").trim();
  if (!to) return Response.json({ error: "no_email" }, { status: 422 });

  if (!(await allowUser(sb, "welcome_mail", 1, 86400))) return Response.json({ error: "quota" }, { status: 429 });

  // Le mariage n'existe pas forcément encore à cet instant (il se crée au premier chargement du
  // tableau de bord à partir du questionnaire d'accueil) : on personnalise quand on peut, sinon
  // on retombe sur un mail générique plutôt que de bloquer l'envoi.
  const { data: member } = await sb.from("wedding_members").select("wedding_id").eq("user_id", user.user.id).maybeSingle();
  let couple = "";
  if (member?.wedding_id) {
    const { data: wedding } = await sb.from("weddings").select("partner1, partner2").eq("id", member.wedding_id).maybeSingle();
    couple = [wedding?.partner1, wedding?.partner2].filter(Boolean).join(" et ");
  }
  const meta = user.user.user_metadata || {};
  const greeting = couple || [meta.first_name, meta.partner_first_name].map((n) => String(n || "").trim()).filter(Boolean).join(" et ");

  const link = `${publicOrigin(req)}/dashboard`;
  const subject = "Bienvenue sur Merry !";
  const text = `Bienvenue sur Merry${greeting ? `, ${greeting}` : ""} !\n\nVotre tableau de bord est prêt. Invités, budget, prestataires, rétroplanning : tout est là, et c'est gratuit du début à la fin.\n\n${link}`;

  // Reprend à l'identique la planche V22 du canvas (page « 7 - mails ») : logo, titre, tuiles,
  // bouton, pied de page — sans le bloc vidéo du mock, en attendant l'export du GIF.
  const logoBlock = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px"><tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" style="background:#fff700;border-radius:999px"><tr><td style="padding:10px 24px;font-size:22px;font-weight:800;letter-spacing:-0.01em;color:#1c1c1a">Merry</td></tr></table>
</td></tr></table>`;

  const titleBlock = `<h1 style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:26px;line-height:1.15;color:#1c1c1a;text-align:center">Bienvenue sur Merry${greeting ? `, ${esc(greeting)}` : ""}&nbsp;!</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:1.6;text-align:center;color:#1c1c1a">Votre tableau de bord est prêt. Invités, budget, prestataires, rétroplanning&nbsp;: tout est là, et c'est gratuit du début à la fin.</p>`;

  const tile = (label) =>
    `<td width="33%" style="padding:0 4px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #ecebe6;border-radius:12px;border-collapse:separate"><tr><td align="center" style="padding:16px 6px;font-size:13px;font-weight:600;color:#1c1c1a">${label}</td></tr></table></td>`;
  const tilesBlock = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${tile("Invités")}${tile("Budget")}${tile("Rétroplanning")}</tr></table>`;

  const ctaBlock = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px"><tr><td align="center">
<a href="${esc(link)}" style="display:inline-block;background:#1c1c1a;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:700;font-size:15px">Découvrir mon tableau de bord</a>
</td></tr></table>`;

  const footerBlock = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;background:#f6f5f1;border-top:1px solid #ecebe6"><tr><td style="padding:18px 4px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="font-size:12px;color:#9c9a90;line-height:1.5">Merry · withmerry.com<br>Vous recevez ce mail car vous venez de créer votre mariage sur Merry.</td>
</tr></table>
</td></tr></table>`;

  const preheader = "Votre tableau de bord est prêt. Invités, budget, prestataires, rétroplanning : tout est là, et c'est gratuit du début à la fin.";
  const bodyHtml = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1c1c1a;max-width:560px">
${logoBlock}
${titleBlock}
${tilesBlock}
${ctaBlock}
<p style="margin:20px 0 0;font-size:14px;color:#6b6a63;text-align:center">Une question&nbsp;? Il suffit de répondre à ce mail.</p>
${footerBlock}
</div>`;
  const html = mailShell({ title: subject, preheader, body: bodyHtml });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    body: JSON.stringify({ from: FROM, to: [to], subject, text, html }),
  });
  if (!res.ok) {
    console.error("[merry] mail bienvenue", res.status, await res.text().catch(() => ""));
    return Response.json({ error: "send_failed" }, { status: 502 });
  }
  return Response.json({ ok: true, to });
}

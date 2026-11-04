// Mail de bienvenue d'un prestataire, envoyé quand sa fiche est rattachée pour la première fois
// (/api/pro/claim). Reprend les planches V29 et V29m du canvas (page « 7 - mails »), sans les icônes
// SVG, qu'Outlook desktop ne rend pas.

import { publicOrigin } from "@/lib/server/origin";
import { esc, mailShell } from "@/lib/server/mailShell";

const FROM = process.env.MERRY_MAIL_FROM || "Merry <onboarding@resend.dev>";

export async function sendVendorWelcome({ to, vendorName, credits }) {
  if (!process.env.RESEND_API_KEY || !to) return;
  const origin = publicOrigin();
  const link = `${origin}/pro/fiche`;
  const name = String(vendorName || "").trim();
  const subject = `Bienvenue sur Merry${name ? `, ${name}` : ""}`;
  const intro = "Votre fiche est prête. Complétez-la pour que les couples vous trouvent et vous écrivent.";
  const creditsLine = "Les demandes sont gratuites à consulter. Vos crédits servent à y répondre.";
  const preheader = credits > 0 ? `Votre fiche est prête et ${credits} crédits vous attendent.` : "Votre fiche est prête.";
  const text = [`Bienvenue sur Merry${name ? `, ${name}` : ""} !`, intro, ...(credits > 0 ? [`${credits} crédits offerts. ${creditsLine}`] : []), `Compléter ma fiche : ${link}`].join("\n\n");

  const logoBlock = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px"><tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" style="background:#fff700;border-radius:999px"><tr><td style="padding:10px 24px;font-size:22px;font-weight:800;letter-spacing:-0.01em;color:#1c1c1a">Merry</td></tr></table>
</td></tr></table>`;

  const titleBlock = `<h1 style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:26px;line-height:1.15;color:#1c1c1a;text-align:center">Bienvenue sur Merry${name ? `, ${esc(name)}` : ""}&nbsp;!</h1>
<p style="margin:0;font-size:15px;line-height:1.6;text-align:center;color:#1c1c1a">${esc(intro)}</p>`;

  const creditsBlock =
    credits > 0
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;background:#f6f5f1;border-radius:20px;border-collapse:separate"><tr>
<td valign="middle" style="padding:16px 0 16px 16px;font-size:28px;font-weight:700;line-height:1.1;color:#1c1c1a">${esc(credits)}</td>
<td valign="middle" style="padding:16px 16px 16px 14px"><div style="font-size:15px;font-weight:700;color:#1c1c1a">crédits offerts</div><div style="margin-top:2px;font-size:12px;line-height:1.4;color:#6b6a63">${esc(creditsLine)}</div></td>
</tr></table>`
      : "";

  const tile = (label) =>
    `<td width="33%" style="padding:0 4px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #ecebe6;border-radius:12px;border-collapse:separate"><tr><td align="center" style="padding:16px 6px;font-size:13px;font-weight:600;color:#1c1c1a">${label}</td></tr></table></td>`;
  const tilesBlock = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px"><tr>${tile("Ma fiche")}${tile("Mes disponibilités")}${tile("Mes demandes")}</tr></table>`;

  const ctaBlock = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px"><tr><td align="center">
<a href="${esc(link)}" style="display:inline-block;background:#1c1c1a;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:700;font-size:15px">Compléter ma fiche</a>
</td></tr></table>`;

  const footerBlock = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;background:#f6f5f1;border-top:1px solid #ecebe6"><tr><td style="padding:18px 4px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="font-size:12px;color:#9c9a90;line-height:1.5">Merry · withmerry.com<br>Vous recevez ce mail car vous venez de créer votre fiche sur Merry.</td>
<td align="right" valign="top"><a href="${esc(origin)}/pro/compte" style="color:#9c9a90;text-decoration:underline;white-space:nowrap;font-size:12px">Gérer mes notifications</a></td>
</tr></table>
</td></tr></table>`;

  const body = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1c1c1a;max-width:560px">
${logoBlock}
${titleBlock}
${creditsBlock}
${tilesBlock}
${ctaBlock}
<p style="margin:20px 0 0;font-size:14px;color:#6b6a63;text-align:center">Une question&nbsp;? Il suffit de répondre à ce mail.</p>
${footerBlock}
</div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    body: JSON.stringify({ from: FROM, to: [to], subject, text, html: mailShell({ title: subject, preheader, body }) }),
  });
  if (!res.ok) console.error("[merry] mail bienvenue prestataire", res.status, await res.text().catch(() => ""));
}

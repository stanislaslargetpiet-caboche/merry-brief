// Mail de bienvenue d'un prestataire, envoyé quand sa fiche est rattachée pour la première fois
// (/api/pro/claim) ou quand Stan valide sa demande d'accès (lib/server/proDemande.js). Reprend les
// planches V29 et V29m du canvas (page « 7 - mails »), sans les icônes SVG, qu'Outlook desktop ne rend
// pas. Depuis le 19 nov. 2026 : vouvoiement, mot signé de Stan avec son agenda Calendly en fin de mail,
// expéditeur « Stan de Merry » et réponse vers l'adresse de contact.

import { CALENDLY_URL } from "@/lib/site";
import { CREDITS_ON } from "@/lib/pro/format";
import { publicOrigin } from "@/lib/server/origin";
import { esc, heroBlock, mailShell } from "@/lib/server/mailShell";
import { personalFrom, sendMail } from "@/lib/server/sendMail";

const CONTACT = "bonjour@withmerry.com";

export function vendorWelcomeMail({ vendorName, credits: granted, origin, rdv = CALENDLY_URL }) {
  // D-382 : crédits suspendus, le mail ne les mentionne plus tant que CREDITS_ON est faux
  const credits = CREDITS_ON ? granted : 0;
  const link = `${origin}/pro/fiche`;
  const name = String(vendorName || "").trim();
  const title = `Bienvenue sur Merry${name ? `, ${name}` : ""}`;
  const subject = title;
  const intro = "Votre fiche est prête. Complétez-la pour que les couples vous trouvent et vous écrivent.";
  const creditsLine = "Les demandes sont gratuites à consulter. Vos crédits servent à y répondre.";
  const preheader = credits > 0 ? `Votre fiche est prête et ${credits} crédits vous attendent.` : "Votre fiche est prête.";
  const stan = "Je suis Stan, fondateur de Merry. N'hésitez pas à me contacter si vous avez des questions sur l'utilisation de la plateforme : répondez simplement à ce mail, ou prenez rendez-vous sur mon agenda.";
  const text = [
    `${title} !`,
    intro,
    ...(credits > 0 ? [`${credits} crédits offerts. ${creditsLine}`] : []),
    `Compléter ma fiche : ${link}`,
    stan,
    `Prendre rendez-vous : ${rdv}`,
    "À bientôt,\nStan\nFondateur de Merry",
  ].join("\n\n");

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

  // Le mot de Stan : texte simple, comme un mail écrit à la main, avec un lien secondaire vers son agenda
  const stanBlock = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:32px;border-top:1px solid #ecebe6"><tr><td style="padding:24px 4px 0;font-size:15px;line-height:1.6;color:#1c1c1a">
<p style="margin:0 0 16px">${esc(stan)}</p>
<p style="margin:0 0 16px"><a href="${esc(rdv)}" style="color:#1c1c1a;font-weight:700;text-decoration:underline">Prendre rendez-vous avec Stan</a></p>
<p style="margin:0">À bientôt,<br>Stan<br><span style="color:#6b6a63">Fondateur de Merry</span></p>
</td></tr></table>`;

  const footerBlock = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;background:#f6f5f1;border-top:1px solid #ecebe6"><tr><td style="padding:18px 4px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="font-size:12px;color:#9c9a90;line-height:1.5">Merry · withmerry.com<br>Vous recevez ce mail car vous venez de créer votre fiche sur Merry.</td>
<td align="right" valign="top"><a href="${esc(origin)}/pro/compte" style="color:#9c9a90;text-decoration:underline;white-space:nowrap;font-size:12px">Gérer mes notifications</a></td>
</tr></table>
</td></tr></table>`;

  const body = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1c1c1a;max-width:560px">
${heroBlock({ title: `${esc(title)}&nbsp;!`, intro: esc(intro) })}
${creditsBlock}
${tilesBlock}
${ctaBlock}
${stanBlock}
${footerBlock}
</div>`;

  return { subject, text, html: mailShell({ title: subject, preheader, body }) };
}

export async function sendVendorWelcome({ to, vendorName, credits }) {
  if (!process.env.RESEND_API_KEY || !to) return;
  const mail = vendorWelcomeMail({ vendorName, credits, origin: publicOrigin() });
  await sendMail({ to, ...mail, from: personalFrom("Stan de Merry", ""), replyTo: CONTACT, label: "mail bienvenue prestataire" });
}

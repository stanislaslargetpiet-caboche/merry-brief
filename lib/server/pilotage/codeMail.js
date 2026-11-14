// Code de connexion au pilotage (planche V24 du canvas, page « 7 - mails »). Le code vient de
// supabase.auth.admin.generateLink (qui ne part jamais de mail tout seul, par conception : voir le
// commentaire de app/api/interne/pilotage/connexion/route.js), le mail lui-même part par Resend, avec notre
// propre HTML — le format ne dépend donc plus du template « Magic Link » collé à la main dans le dashboard
// Supabase (contrairement aux autres mails Supabase : inscription, mot de passe, changement d'adresse,
// qui restent dans supabase/email-templates/ pour l'instant).

import { esc, heroBlock, mailShell } from "@/lib/server/mailShell";
import { sendMail } from "@/lib/server/sendMail";

const MINUTES = 10;

export function codeMail({ token }) {
  const subject = `${token} est ton code Merry`;
  const preheader = `Ton code : ${token} — valable ${MINUTES} minutes.`;
  const text = [
    `Voici ton code : ${token}`,
    `Ce code expire dans ${MINUTES} minutes.`,
    "Merry ne te demande jamais ce code par téléphone ou par un autre moyen que l'écran de connexion. Si tu n'es pas à l'origine de cette demande, ignore ce mail.",
  ].join("\n\n");

  const codeBox = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f1;border-radius:20px;border-collapse:separate"><tr><td align="center" style="padding:28px 16px">
<span style="font-weight:700;font-size:40px;letter-spacing:0.12em;color:#1c1c1a">${esc(token)}</span>
<div style="margin-top:10px;font-size:13px;color:#6b6a63">Ce code expire dans ${MINUTES} minutes.</div>
</td></tr></table>`;

  const tip = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;background:#f6f5f1;border-radius:12px;border-collapse:separate"><tr><td style="padding:14px 16px;font-size:13px;line-height:1.5;color:#6b6a63">Merry ne te demande jamais ce code par téléphone ou par un autre moyen que l'écran de connexion. Si tu n'es pas à l'origine de cette demande, ignore ce mail.</td></tr></table>`;

  const footer = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;background:#f6f5f1;border-top:1px solid #ecebe6"><tr><td style="padding:18px 4px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="font-size:12px;color:#9c9a90;line-height:1.5">Merry · withmerry.com<br>Tu reçois ce mail suite à une demande de connexion sur Merry.</td>
<td align="right" valign="top" style="font-size:12px"><a href="mailto:bonjour@withmerry.com" style="color:#9c9a90;text-decoration:underline;white-space:nowrap">Besoin d'aide&nbsp;?</a></td>
</tr></table>
</td></tr></table>`;

  const body = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1c1c1a;max-width:560px">
${heroBlock({ title: "Voici ton code.", intro: "Saisis-le pour te connecter à Merry." })}
${codeBox}
${tip}
${footer}
</div>`;

  return { subject, text, html: mailShell({ title: subject, preheader, body }) };
}

export async function sendCodePilotage(email, token) {
  if (!process.env.RESEND_API_KEY) return false;
  return sendMail({ to: email, ...codeMail({ token }), label: "code pilotage" });
}

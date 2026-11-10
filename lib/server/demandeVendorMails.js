// Mails envoyés au demandeur d'une fiche (action « request » de /api/pro/claim et décision de Stan dans le
// pilotage) : « demande bien reçue » à l'envoi, « demande non validée » au refus. La validation, elle, envoie le
// mail de bienvenue (lib/server/vendorWelcome.js). Ajoutés le 5 nov. 2026 sur remarque de Stan : le demandeur ne
// recevait rien tant qu'il n'était pas validé, ni quand il était refusé.

import { publicOrigin } from "@/lib/server/origin";
import { esc, heroBlock, mailShell } from "@/lib/server/mailShell";
import { sendMail } from "@/lib/server/sendMail";

const CONTACT = "bonjour@withmerry.com";

const footer = `<p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#9c9a90;text-align:center">Merry · withmerry.com</p>`;

function layout({ title, intro, extra = "", subject, preheader }) {
  const body = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1c1c1a;max-width:560px">
${heroBlock({ title: esc(title), intro: esc(intro) })}
${extra}
${footer}
</div>`;
  return mailShell({ title: subject, preheader, body });
}

export function demandeRecueMail({ vendorName }) {
  const name = String(vendorName || "ta fiche").trim();
  const subject = "Ta demande est bien reçue";
  const intro = `Nous vérifions que la fiche ${name} est bien à toi. Nous te joignons par mail ou par téléphone dans l'heure.`;
  const note = "Ton espace s'ouvre dès que la vérification est faite : tu recevras un mail, et la page de connexion se met à jour toute seule.";
  const extra = `<p style="margin:16px 0 0;font-size:14px;line-height:1.6;text-align:center;color:#6b6a63">${esc(note)}</p>`;
  return { subject, text: [`Ta demande est bien reçue.`, intro, note].join("\n\n"), html: layout({ title: "Ta demande est bien reçue.", intro, extra, subject, preheader: "Nous te joignons dans l'heure pour confirmer." }) };
}

export function demandeRefuseeMail({ vendorName }) {
  const name = String(vendorName || "cette fiche").trim();
  const subject = "Ta demande d'accès n'a pas pu être validée";
  const intro = `Nous n'avons pas pu confirmer que tu gères la fiche ${name}, donc l'accès ne t'a pas été ouvert.`;
  const note = `Si c'est une erreur, réponds à ce mail ou écris-nous à ${CONTACT} avec le numéro SIRET de ton établissement : nous regardons ça tout de suite.`;
  const retry = `${publicOrigin()}/pro`;
  const extra = `<p style="margin:16px 0 0;font-size:14px;line-height:1.6;text-align:center;color:#6b6a63">${esc(note)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px"><tr><td align="center"><a href="${esc(retry)}" style="display:inline-block;background:#1c1c1a;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:700;font-size:15px">Retrouver ma fiche</a></td></tr></table>`;
  return { subject, text: [`Ta demande d'accès n'a pas pu être validée.`, intro, note, `Retrouver ma fiche : ${retry}`].join("\n\n"), html: layout({ title: "Ta demande n'a pas pu être validée.", intro, extra, subject, preheader: "Réponds à ce mail avec ton SIRET si c'est une erreur." }) };
}

// Ne bloquent jamais la demande ni la décision : renvoient false si le mail n'est pas parti
export async function sendDemandeRecue({ to, vendorName }) {
  if (!process.env.RESEND_API_KEY || !to) return false;
  return sendMail({ to, replyTo: CONTACT, ...demandeRecueMail({ vendorName }), label: "demande d'accès reçue" });
}

export async function sendDemandeRefusee({ to, vendorName }) {
  if (!process.env.RESEND_API_KEY || !to) return false;
  return sendMail({ to, replyTo: CONTACT, ...demandeRefuseeMail({ vendorName }), label: "demande d'accès refusée" });
}

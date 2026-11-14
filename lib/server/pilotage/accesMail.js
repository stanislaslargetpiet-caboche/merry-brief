// Mails de l'accès au pilotage : l'alerte à l'équipe quand une adresse demande l'accès, et le mail à la personne
// quand Stan l'approuve. Un refus n'envoie rien.

import { alertTo } from "@/lib/server/demandeMail";
import { esc, heroBlock, mailShell } from "@/lib/server/mailShell";
import { publicOrigin } from "@/lib/server/origin";
import { sendMail } from "@/lib/server/sendMail";

const bouton = (href, label) =>
  `<a href="${esc(href)}" style="display:inline-block;background:#1c1c1a;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:700;font-size:14px">${esc(label)}</a>`;

export function demandeAccesMail({ email, origin }) {
  const link = `${origin}/pilotage/coulisses/acces`;
  const subject = `Accès au pilotage demandé : ${email}`;
  const text = [`${email} demande l'accès au pilotage.`, `Approuver ou refuser : ${link}`].join("\n");
  const body = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1c1c1a;max-width:560px">
${heroBlock({ title: "Accès au pilotage demandé" })}
<p style="margin:0 0 20px;font-size:15px;line-height:1.5"><strong>${esc(email)}</strong> s'est connecté au pilotage et attend ton accord.</p>
${bouton(link, "Approuver ou refuser")}
</div>`;
  return { subject, text, html: mailShell({ title: subject, preheader: `${email} attend ton accord.`, body }) };
}

export function accesOuvertMail({ origin }) {
  const link = `${origin}/pilotage`;
  const subject = "Ton accès au pilotage Merry est ouvert";
  const text = [`Ton accès au pilotage Merry est ouvert.`, `Connecte-toi avec cette adresse : ${link}`].join("\n");
  const body = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1c1c1a;max-width:560px">
${heroBlock({ title: "Ton accès est ouvert" })}
<p style="margin:0 0 20px;font-size:15px;line-height:1.5">Connecte-toi au pilotage avec cette adresse, un code te sera envoyé.</p>
${bouton(link, "Ouvrir le pilotage")}
</div>`;
  return { subject, text, html: mailShell({ title: subject, preheader: "Connecte-toi avec cette adresse.", body }) };
}

// Ne bloquent jamais la demande ni la décision : false si le mail n'est pas parti
export async function sendDemandeAcces(email) {
  if (!process.env.RESEND_API_KEY) return false;
  return sendMail({ to: alertTo(), ...demandeAccesMail({ email, origin: publicOrigin() }), label: "accès pilotage demandé" });
}

export async function sendAccesOuvert(email) {
  if (!process.env.RESEND_API_KEY) return false;
  return sendMail({ to: email, ...accesOuvertMail({ origin: publicOrigin() }), label: "accès pilotage ouvert" });
}

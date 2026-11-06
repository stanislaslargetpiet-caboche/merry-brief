// Alerte « nouvelle demande d'accès » envoyée à l'équipe quand un prestataire demande une fiche
// (/api/pro/claim, action « request »). Elle donne tout ce qu'il faut pour vérifier à la main : les
// coordonnées d'origine de la fiche (à contacter, elles seules prouvent quelque chose), ce que le demandeur
// a répondu ou saisi, et le lien du pilotage où valider ou refuser.

import { publicOrigin } from "@/lib/server/origin";
import { esc, mailShell } from "@/lib/server/mailShell";
import { sendMail } from "@/lib/server/sendMail";

export const alertTo = () => process.env.MERRY_NOTIFY_TO || "contact@withmerry.com";

// Les lignes du récapitulatif : [libellé, valeur], pour le texte brut comme pour le HTML
export function demandeLines({ vendor, claim }) {
  const coordLine = (label, fiche, choice, given) => {
    if (choice === "oui") return [label, `${fiche} : confirmé par le demandeur`];
    if (choice === "non") return [label, `fiche : ${fiche || "aucune"} · le demandeur dit que non, et donne : ${given}`];
    return [label, `la fiche n'en avait pas · le demandeur donne : ${given}`];
  };
  return [
    ["Fiche", [vendor.name, vendor.city].filter(Boolean).join(" · ")],
    ["Métier", vendor.category || "inconnu"],
    coordLine("Email de la fiche", claim.fiche_email, claim.email_choice, claim.email_given),
    coordLine("Téléphone de la fiche", claim.fiche_phone, claim.phone_choice, claim.phone_given),
    ["Compte créé avec", `${claim.account_email} · ${claim.account_phone}`],
  ];
}

export function demandeMail({ vendor, claim, origin }) {
  const lines = demandeLines({ vendor, claim });
  const changed = Boolean(claim.email_given || claim.phone_given);
  const link = `${origin}/pilotage/aujourdhui/demandes`;
  const hint = changed
    ? "Des coordonnées ont été changées : contacte la fiche par ses coordonnées d'origine, pas par celles du demandeur."
    : "Contacte la fiche par ses coordonnées d'origine (mail ou téléphone) pour confirmer.";
  const subject = `Demande d'accès : ${vendor.name}${changed ? " (coordonnées changées)" : ""}`;
  const text = [`Nouvelle demande d'accès à une fiche.`, ...lines.map(([k, v]) => `${k} : ${v}`), hint, `Valider ou refuser : ${link}`].join("\n");
  const rows = lines
    .map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;font-size:13px;color:#6b6a63;white-space:nowrap" valign="top">${esc(k)}</td><td style="padding:6px 0;font-size:14px;color:#1c1c1a">${esc(v)}</td></tr>`)
    .join("");
  const body = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1c1c1a;max-width:560px">
<h1 style="margin:0 0 14px;font-size:22px;line-height:1.2">Nouvelle demande d'accès</h1>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:14px">${rows}</table>
<p style="margin:0 0 20px;font-size:14px;line-height:1.5">${esc(hint)}</p>
<a href="${esc(link)}" style="display:inline-block;background:#1c1c1a;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:700;font-size:14px">Valider ou refuser</a>
</div>`;
  return { subject, text, html: mailShell({ title: subject, preheader: hint, body }) };
}

// Ne bloque jamais la demande : renvoie false si le mail n'est pas parti
export async function sendDemandeAlert({ vendor, claim }) {
  if (!process.env.RESEND_API_KEY) return false;
  const mail = demandeMail({ vendor, claim, origin: publicOrigin() });
  return sendMail({ to: alertTo(), ...mail, label: "demande d'accès" });
}

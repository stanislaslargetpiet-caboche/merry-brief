// Mail hebdomadaire « Du nouveau sur Merry » (canvas, page « 7 - mails », V40 à V48) : une fonction par mail,
// envoyé le samedi. Tableaux et styles en ligne, Gmail ignore flex et grid. Alan Sans n'existe pas dans les
// clients mail : Arial la remplace, comme sur les autres mails.

import { esc, mailShell } from "@/lib/server/mailShell";

export const SUBJECT = "Du nouveau sur Merry";
const ACCROCHE = "Tout ton mariage, au même endroit.";

// Un numéro par samedi ; le dernier de la liste est celui que propose le pilotage
export const NOUVEAUTES = [
  {
    numero: 1,
    samedi: "2026-11-07",
    titre: ["Combien ça nous coûte.", "Et qui paie quoi."],
    promesse: "Suis chaque dépense, fixe ta règle de répartition, et Merry calcule qui doit quoi à qui.",
    avant: "« Tes parents avaient dit quoi, pour le traiteur ? » Et un Excel que personne n’ose ouvrir.",
    apres: "Chaque dépense à sa place, avec son échéance. Chacun sa part, et les virements à faire.",
    image: "depenses.png",
    bouton: "Ouvrir mon budget",
    lien: "/dashboard/budget",
  },
  {
    numero: 2,
    samedi: "2026-11-14",
    titre: ["Dépose ton fichier.", "Ta liste est prête."],
    promesse: "Excel, Word, PDF, même une photo de ta liste griffonnée : Merry la lit et la met au propre.",
    avant: "La version de ta mère, celle de ta belle-mère, et aucune n’est à jour.",
    apres: "Une seule liste, propre, avec la réponse de chacun.",
    image: "liste-invites.png",
    bouton: "Ouvrir ma liste d’invités",
    lien: "/dashboard/invites",
  },
];

export const latestIssue = () => NOUVEAUTES[NOUVEAUTES.length - 1];

// L'étiquette et le texte tiennent côte à côte sur ordinateur ; sur téléphone le texte passe dessous, sans media query
function ligne({ label, labelColor, bg, color, weight, text }) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;background:${bg};border-radius:14px;border-collapse:separate"><tr><td style="padding:14px 18px;font-size:0">
<div style="display:inline-block;width:66px;vertical-align:top;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;line-height:21px;color:${labelColor}">${label}</div><div style="display:inline-block;width:100%;max-width:395px;vertical-align:top;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:21px;font-weight:${weight};color:${color}">${esc(text)}</div>
</td></tr></table>`;
}

export function nouveautesMail({ issue, origin, unsub }) {
  const assets = `${origin}/mail`;
  const link = `${origin}${issue.lien}`;
  const text = [
    issue.titre.join(" "),
    issue.promesse,
    `Avant : ${issue.avant}`,
    `Après : ${issue.apres}`,
    `${issue.bouton} : ${link}`,
    "À samedi prochain,\nStan de Merry",
    `Ne plus recevoir les nouveautés : ${unsub}`,
  ].join("\n\n");

  const hero = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff700;border-radius:20px;border-collapse:separate"><tr><td style="padding:32px 28px">
<img src="${esc(assets)}/merry.png" width="145" height="30" alt="Merry" style="display:block;border:0;width:145px;height:30px">
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:28px"><tr><td width="42" valign="middle"><img src="${esc(assets)}/etincelle.png" width="30" height="30" alt="" style="display:block;border:0;width:30px;height:30px"></td><td valign="middle" style="font-size:14.5px;font-weight:700;line-height:1.3;color:#1c1c1a">${esc(ACCROCHE)}</td></tr></table>
<h1 style="margin:18px 0 0;font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:32px;line-height:1.08;letter-spacing:-0.01em;color:#1c1c1a">${issue.titre.map(esc).join("<br>")}</h1>
<p style="margin:14px 0 22px;font-size:16px;line-height:1.5;color:#1c1c1a">${esc(issue.promesse)}</p>
${ligne({ label: "Avant", labelColor: "#6b6a63", bg: "#ffffff", color: "#6b6a63", weight: 400, text: issue.avant })}
${ligne({ label: "Après", labelColor: "#fff700", bg: "#1c1c1a", color: "#ffffff", weight: 700, text: issue.apres })}
</td></tr></table>`;

  const image = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;background:#f6f5f1;border-radius:20px;border-collapse:separate"><tr><td style="padding:20px 24px">
<img src="${esc(assets)}/nouveautes/${esc(issue.image)}" width="480" alt="" style="display:block;border:0;width:100%;max-width:480px;height:auto">
</td></tr></table>`;

  const cta = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px"><tr><td align="center">
<a href="${esc(link)}" style="display:inline-block;width:300px;max-width:100%;box-sizing:border-box;background:#1c1c1a;color:#ffffff;text-align:center;text-decoration:none;padding:17px 0;border-radius:999px;font-weight:700;font-size:15px;line-height:18px">${esc(issue.bouton)}</a>
</td></tr></table>`;

  const footer = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;background:#f6f5f1;border-top:1px solid #ecebe6"><tr><td style="padding:16px;font-size:12px;color:#9c9a90;line-height:1.6">Merry · withmerry.com<br>Tu reçois ce mail car tu organises un événement sur Merry.<br><a href="${esc(unsub)}" style="color:#6b6a63;text-decoration:underline">Ne plus recevoir les nouveautés</a></td></tr></table>`;

  const body = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1c1c1a;max-width:560px">
${hero}
${image}
${cta}
<p style="margin:28px 0 0;font-size:15px;line-height:1.6">À samedi prochain,<br><strong>Stan</strong> de Merry</p>
${footer}
</div>`;

  return { subject: SUBJECT, text, html: mailShell({ title: SUBJECT, preheader: issue.promesse, body }) };
}

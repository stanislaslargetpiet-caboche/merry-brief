// Mail de bienvenue (planches V22 bis du canvas). Le logo et les icônes sont des images hébergées dans
// public/mail : les clients mail ne chargent ni Climate Crisis ni les SVG. Le mail reste lisible si
// elles sont bloquées, le texte portant tout le message.

import { esc, mailShell } from "@/lib/server/mailShell";

const MANIFESTO = "Merry existe pour que le mariage qui te ressemble prenne quelques soirées, pas dix-huit mois.";

const ROWS = [
  ["invites", "Tes invités", "La liste, les réponses, les tables. Sans le groupe WhatsApp."],
  ["budget", "Ton budget", "Chaque dépense à sa place. Fini la ligne « divers : 1 200 € »."],
  ["messagerie", "Tes prestataires", "Trouvés, contactés et suivis au même endroit."],
  ["date", "Ton rétroplanning", "Généré en un clic, pour ne rien oublier."],
];

// Variante pour un compte créé depuis une invitation : le mariage est celui du couple, pas le sien
const TEAM_ROWS = [
  ["invites", "Les invités", "La liste, les réponses, les tables. Sans le groupe WhatsApp."],
  ["budget", "Le budget", "Chaque dépense à sa place. Fini la ligne « divers : 1 200 € »."],
  ["messagerie", "Les prestataires", "Trouvés, contactés et suivis au même endroit."],
  ["date", "Le rétroplanning", "Ce qui reste à faire, et pour quand."],
];

// team : { couple, plural } quand la personne vient de rejoindre l'équipe d'un mariage existant
export function welcomeMail({ greeting, link, assets, team = null }) {
  const title = team
    ? greeting ? `${greeting}, bienvenue dans l'équipe` : "Bienvenue dans l'équipe"
    : greeting ? `${greeting}, la fête commence` : "La fête commence";
  const intro = !team
    ? MANIFESTO
    : team.couple
      ? `${team.couple} ${team.plural ? "t'ont" : "t'a"} fait entrer dans l'équipe qui organise ${team.plural ? "leur" : "son"} mariage. Tout ce qui se prépare, tu le suis maintenant au même endroit.`
      : "Te voilà dans l'équipe qui organise le mariage. Tout ce qui se prépare, tu le suis maintenant au même endroit.";
  const rows = team ? TEAM_ROWS : ROWS;
  const text = [
    `${title}.`,
    intro,
    ...rows.map(([, name, line]) => `${name} : ${line}`),
    `Ouvrir mon tableau de bord : ${link}`,
    "Une question ? Réponds à ce mail, c'est moi qui le lis.",
    "À très vite,\nStan, fondateur de Merry",
  ].join("\n\n");

  const hero = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff700;border-radius:20px;border-collapse:separate"><tr><td style="padding:32px 28px">
<img src="${esc(assets)}/merry.png" width="145" height="30" alt="Merry" style="display:block;border:0;width:145px;height:30px">
<h1 style="margin:32px 0 0;font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:32px;line-height:1.08;letter-spacing:-0.01em;color:#1c1c1a">${esc(title)}.</h1>
<p style="margin:14px 0 0;font-size:16px;line-height:1.5;color:#1c1c1a">${esc(intro)}</p>
</td></tr></table>`;

  const list = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px">${rows.map(
    ([icon, name, line], i) => {
      const border = i ? "border-top:1px solid #ecebe6;" : "";
      return `<tr><td width="40" valign="top" style="${border}padding:14px 0"><img src="${esc(assets)}/${icon}.png" width="26" height="26" alt="" style="display:block;border:0;width:26px;height:26px"></td><td style="${border}padding:14px 0"><div style="font-size:15px;font-weight:700;color:#1c1c1a">${esc(name)}</div><div style="margin-top:2px;font-size:14px;line-height:1.45;color:#6b6a63">${esc(line)}</div></td></tr>`;
    },
  ).join("")}</table>`;

  const cta = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px"><tr><td align="center">
<a href="${esc(link)}" style="display:inline-block;background:#1c1c1a;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:700;font-size:15px">Ouvrir mon tableau de bord</a>
</td></tr></table>`;

  const footer = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;background:#f6f5f1;border-top:1px solid #ecebe6"><tr><td style="padding:18px 4px;font-size:12px;color:#9c9a90;line-height:1.5">Merry · withmerry.com<br>Tu reçois ce mail car tu viens de ${team ? "rejoindre un mariage" : "créer ton mariage"} sur Merry.</td></tr></table>`;

  const body = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1c1c1a;max-width:560px">
${hero}
${list}
${cta}
<p style="margin:26px 0 0;font-size:15px;line-height:1.6">Une question&nbsp;? Réponds à ce mail, c'est moi qui le lis.</p>
<p style="margin:14px 0 0;font-size:15px;line-height:1.6">À très vite,<br><strong>Stan</strong>, fondateur de Merry</p>
${footer}
</div>`;

  return { subject: title, text, html: mailShell({ title, preheader: intro, body }) };
}

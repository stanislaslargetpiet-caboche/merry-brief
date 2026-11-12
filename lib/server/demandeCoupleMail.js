// Mail de confirmation au couple quand sa demande de devis est partie (planche V55, leçon Mariages.net :
// un couple n'a aucune preuve que son message a bien été envoyé). Envoyé une fois par envoi de demandes,
// à l'adresse du compte qui vient de cliquer (lib/dash/store.js, sendQuotes), jamais aux autres organisateurs.

import { esc, heroBlock, mailShell } from "@/lib/server/mailShell";

export function demandesEnvoyeesMail({ names, dashboardLink }) {
  const list = names.filter(Boolean);
  const title = list.length > 1 ? `Tes ${list.length} demandes sont parties` : "Ta demande est partie";
  const who = list.length <= 1 ? list[0] || "Le prestataire" : list.length === 2 ? list.join(" et ") : `${list.slice(0, -1).join(", ")} et ${list[list.length - 1]}`;
  const verb = list.length > 1 ? "ont reçu ton message" : "a reçu ton message";
  const intro = `${who} ${verb}.`;
  const para = "Chaque réponse arrivera dans ta messagerie Merry, et tu recevras un mail à chaque fois.";
  const subject = title;
  const text = [`${title}.`, intro, para, `Voir mes demandes : ${dashboardLink}`].join("\n\n");

  const rows = list
    .map(
      (name) =>
        `<tr><td style="padding:10px 0;font-size:15px;font-weight:600;border-top:1px solid #ecebe6">${esc(name)}</td></tr>`,
    )
    .join("");
  const listBlock = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f1;border-radius:20px;border-collapse:separate"><tr><td style="padding:6px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
</td></tr></table>`;
  const ctaBlock = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px"><tr><td align="center">
<a href="${esc(dashboardLink)}" style="display:inline-block;background:#1c1c1a;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:700;font-size:15px">Voir mes demandes</a>
</td></tr></table>`;
  const asideBlock = `<p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#6b6a63">Pour ajouter une précision, écris à chacun depuis la messagerie.</p>`;
  const footerBlock = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;background:#f6f5f1;border-top:1px solid #ecebe6"><tr><td style="padding:18px 4px;font-size:12px;color:#9c9a90">Merry · withmerry.com</td></tr></table>`;

  const bodyHtml = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1c1c1a;max-width:560px">
${heroBlock({ title: esc(`${title}.`), intro: esc(intro) })}
${listBlock}
${ctaBlock}
${asideBlock}
${footerBlock}
</div>`;
  return { subject, text, html: mailShell({ title: subject, preheader: para, body: bodyHtml }) };
}

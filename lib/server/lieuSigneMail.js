// Mail « le lieu est réservé, prochaine étape le traiteur » (planche V64, leçon Mariages.net, D-305).

import { esc, heroBlock, mailShell } from "@/lib/server/mailShell";

export function lieuSigneMail({ lieuName, traiteurs, link }) {
  const title = "Le lieu est réservé";
  const para1 = `${lieuName} est noté comme signé : la date et le nombre de places sont fixés.`;
  const para2 = "Prochaine étape, le traiteur. Vérifie d'abord si le lieu en impose un ; sinon, garde deux ou trois traiteurs en favoris et envoie-leur une seule demande.";
  const subject = title;
  const names = traiteurs.map((t) => t.name).filter(Boolean);
  const text = [`${title}.`, para1, para2, names.length ? `Quelques traiteurs près de chez toi : ${names.join(", ")}.` : "", `Voir les traiteurs : ${link}`]
    .filter(Boolean)
    .join("\n\n");

  const cards = traiteurs.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:4px;background:#f6f5f1;border-radius:20px;border-collapse:separate"><tr><td style="padding:6px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${traiteurs
        .map(
          (t, i) =>
            `<tr><td style="padding:11px 0;font-size:15px;font-weight:700;${i ? "border-top:1px solid #ecebe6" : ""}">${esc(t.name)}</td><td align="right" style="padding:11px 0;font-size:12.5px;color:#6b6a63;${i ? "border-top:1px solid #ecebe6" : ""}">${esc(t.city || "")}</td></tr>`,
        )
        .join("")}</table>
</td></tr></table>`
    : "";

  const ctaBlock = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px"><tr><td align="center">
<a href="${esc(link)}" style="display:inline-block;background:#1c1c1a;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:700;font-size:15px">Voir les traiteurs</a>
</td></tr></table>`;
  const footerBlock = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;background:#f6f5f1;border-top:1px solid #ecebe6"><tr><td style="padding:18px 4px;font-size:12px;color:#9c9a90">Merry · withmerry.com</td></tr></table>`;

  const bodyHtml = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1c1c1a;max-width:560px">
${heroBlock({ title: esc(`${title}.`), intro: esc(para1) })}
<p style="margin:0;font-size:15px;line-height:1.6">${esc(para2)}</p>
${cards}
${ctaBlock}
${footerBlock}
</div>`;
  return { subject, text, html: mailShell({ title: subject, preheader: para2, body: bodyHtml }) };
}

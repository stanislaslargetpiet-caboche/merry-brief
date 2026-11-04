// Mise en page commune des mails V31 à V38 (canvas, page « 7 - mails ») : logo, titre, carte ou liste,
// paragraphes, bouton, pied de page. Tableaux et styles en ligne, Gmail ignore flex et grid.

import { esc, logoBlock } from "@/lib/server/mailShell";

export function initialsOf(name) {
  const words = String(name || "").replace(/\bet\b/gi, " ").trim().split(/\s+/).filter(Boolean);
  return words.map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "M";
}

export function renderMail({ title, card, rows = [], paras = [], cta, why, link }) {
  const cardBlock = card
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:4px;background:#f6f5f1;border-radius:20px;border-collapse:separate"><tr><td style="padding:16px">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td width="36" height="36" align="center" valign="middle" style="width:36px;height:36px;border-radius:18px;background:#fffdb8;color:#574e00;font-size:13px;font-weight:700;line-height:36px">${esc(initialsOf(card.name))}</td>
<td style="padding-left:10px"><div style="font-size:15px;font-weight:700">${esc(card.name)}</div><div style="margin-top:2px;font-size:12px;color:#6b6a63">${esc(card.sub)}</div></td>
</tr></table>
</td></tr></table>`
    : "";

  const rowsBlock = rows.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f1;border-radius:20px;border-collapse:separate"><tr><td style="padding:6px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows
        .map(
          (r, i) =>
            `<tr><td style="padding:11px 0;font-size:15px;font-weight:700;${i ? "border-top:1px solid #ecebe6" : ""}">${esc(r.name)}</td><td align="right" style="padding:11px 0;${i ? "border-top:1px solid #ecebe6" : ""}"><span style="display:inline-block;padding:4px 11px;border-radius:999px;background:${r.ok ? "#dff3e1" : "#efeeea"};color:${r.ok ? "#1f6b30" : "#4d4c46"};font-size:12px;font-weight:600;white-space:nowrap">${esc(r.status)}</span></td></tr>`,
        )
        .join("")}</table>
</td></tr></table>`
    : "";

  const ctaBlock = cta
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px"><tr><td align="center">
<a href="${esc(cta.href)}" style="display:inline-block;background:#1c1c1a;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:700;font-size:15px">${esc(cta.label)}</a>
</td></tr></table>`
    : "";

  const footerBlock = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;background:#f6f5f1;border-top:1px solid #ecebe6"><tr><td style="padding:18px 4px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="font-size:12px;color:#9c9a90;line-height:1.5">Merry · withmerry.com<br>${esc(why)}</td>
${link ? `<td align="right" valign="top"><a href="${esc(link.href)}" style="color:#9c9a90;text-decoration:underline;white-space:nowrap;font-size:12px">${esc(link.label)}</a></td>` : ""}
</tr></table>
</td></tr></table>`;

  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#1c1c1a;max-width:560px">
${logoBlock}
<h1 style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:26px;line-height:1.15;color:#1c1c1a">${esc(title)}</h1>
${cardBlock}
${rowsBlock}
${paras.map((p) => `<p style="margin:16px 0 0;font-size:15px;line-height:1.6">${esc(p)}</p>`).join("\n")}
${ctaBlock}
${footerBlock}
</div>`;
}

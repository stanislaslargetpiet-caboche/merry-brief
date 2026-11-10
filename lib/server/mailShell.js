// Enveloppe commune à tous les mails transactionnels Merry (Resend) : document HTML complet avec
// un preheader invisible (aperçu propre dans la boîte de réception au lieu du premier bout de texte
// du mail) et un fond clair forcé (color-scheme) — nos mails ne sont pas pensés pour le mode sombre,
// et sans ça certains clients inversent le fond en sombre sans toucher à notre texte encre, ce qui le
// rend illisible (texte sombre sur fond sombre). `bg` : couleur de fond du mail (le mail de confirmation du
// formulaire prend celle du couple) ; `css` : règles de <head>, seulement pour l'écran de téléphone.

import { publicOrigin } from "@/lib/server/origin";

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// Carte d'en-tête commune à tous les mails (D-248, planches « Gabarit pistache » du canvas) : logo Merry,
// titre, phrase d'introduction facultative. `title` et `intro` sont du HTML déjà échappé.
export function heroBlock({ title, intro = "" }) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#bfe9a6;border-radius:20px;border-collapse:separate"><tr><td style="padding:32px 28px">
<img src="${publicOrigin()}/mail/merry.png" width="145" height="30" alt="Merry" style="display:block;border:0;width:145px;height:30px">
<h1 style="margin:32px 0 0;font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:32px;line-height:1.08;letter-spacing:-0.01em;color:#1c1c1a">${title}</h1>${intro ? `
<p style="margin:14px 0 0;font-size:16px;line-height:1.5;color:#1c1c1a">${intro}</p>` : ""}
</td></tr></table>
<div style="height:20px;line-height:20px;font-size:1px">&nbsp;</div>`;
}

export function mailShell({ title, preheader, body, bg = "#ffffff", css = "" }) {
  // Répété pour pousser le vrai contenu hors de la zone d'aperçu que Gmail construit à partir du
  // début du mail, une fois le preheader lui-même épuisé.
  const pad = "&#8203;&#847;".repeat(20);
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
${css ? `<style>${css}</style>\n` : ""}<title>${esc(title || "Merry")}</title>
</head>
<body style="margin:0;background:${bg}">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;opacity:0">${esc(preheader)}${pad}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${bg}" style="background:${bg}"><tr><td align="center" style="padding:24px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px"><tr><td align="left">
${body}
</td></tr></table>
</td></tr></table>
</body>
</html>`;
}

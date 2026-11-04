// Enveloppe commune à tous les mails transactionnels Merry (Resend) : document HTML complet avec
// un preheader invisible (aperçu propre dans la boîte de réception au lieu du premier bout de texte
// du mail) et un fond clair forcé (color-scheme) — nos mails ne sont pas pensés pour le mode sombre,
// et sans ça certains clients inversent le fond en sombre sans toucher à notre texte encre, ce qui le
// rend illisible (texte sombre sur fond sombre).

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export function mailShell({ title, preheader, body }) {
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
<title>${esc(title || "Merry")}</title>
</head>
<body style="margin:0;background:#ffffff">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;opacity:0">${esc(preheader)}${pad}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px"><tr><td align="left">
${body}
</td></tr></table>
</td></tr></table>
</body>
</html>`;
}

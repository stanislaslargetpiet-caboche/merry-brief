// Envoi commun des mails Merry (Resend). L'identifiant unique empêche Gmail de regrouper des mails de
// même objet et de replier leur bouton derrière « ••• ». Une limite de débit ou une panne passagère
// est retentée deux fois ; un refus définitif (adresse invalide…) ne l'est pas.

const RETRIES = [400, 1200];

export const mailFrom = () => process.env.MERRY_MAIL_FROM || "Merry <onboarding@resend.dev>";

// « Emma via Merry » : un mail qui vient d'une personne atterrit plus souvent dans l'onglet principal de Gmail
export function personalFrom(name) {
  const base = mailFrom();
  const clean = String(name || "").replace(/["<>\\\r\n]/g, "").trim().slice(0, 60);
  if (!clean) return base;
  const address = /<([^>]+)>/.exec(base)?.[1] || base;
  return `"${clean} via Merry" <${address}>`;
}

export async function sendMail({ to, subject, text, html, replyTo, fromName, label = "mail" }) {
  const body = JSON.stringify({
    from: personalFrom(fromName),
    to: [to],
    subject,
    text,
    html,
    reply_to: replyTo || undefined,
    headers: { "X-Entity-Ref-ID": crypto.randomUUID() },
  });
  for (let attempt = 0; ; attempt += 1) {
    let status = 0;
    let detail = "";
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${process.env.RESEND_API_KEY}` },
        body,
      });
      if (res.ok) return true;
      status = res.status;
      detail = await res.text().catch(() => "");
    } catch (e) {
      detail = e?.message || String(e);
    }
    const passing = status === 0 || status === 429 || status >= 500;
    if (!passing || attempt >= RETRIES.length) {
      console.error(`[merry] ${label}`, status, detail);
      return false;
    }
    await new Promise((resolve) => setTimeout(resolve, RETRIES[attempt]));
  }
}

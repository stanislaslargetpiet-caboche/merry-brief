// Mails envoyés par Resend (invitations, notifications, relances, bienvenue), lus pour la page de pilotage.
// L'API liste les 100 derniers envois avec leur dernier événement (delivered, bounced, complained…).
// La clé d'envoi de l'appli (RESEND_API_KEY) est restreinte à l'envoi : la lecture demande une clé « Full access »
// dans RESEND_READ_API_KEY (Resend > API Keys > Create, permission Full access), sinon la section l'explique.

export async function readResend(days, { signal } = {}) {
  const key = process.env.RESEND_READ_API_KEY || process.env.RESEND_API_KEY;
  if (!key) return { disponible: false, raison: "RESEND_READ_API_KEY manquante" };
  const res = await fetch("https://api.resend.com/emails?limit=100", {
    headers: { authorization: `Bearer ${key}` },
    signal,
    cache: "no-store",
  });
  if (res.status === 401 && !process.env.RESEND_READ_API_KEY) {
    return { disponible: false, raison: "la clé RESEND_API_KEY n'autorise que l'envoi : ajoute une clé Full access en RESEND_READ_API_KEY sur Vercel (Production)" };
  }
  if (!res.ok) throw new Error(`resend_${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  const since = Date.now() - days * 86400 * 1000;
  const all = (json.data || []).map((m) => ({
    id: m.id,
    quand: m.created_at,
    a: Array.isArray(m.to) ? m.to.join(", ") : m.to,
    sujet: m.subject,
    etat: m.last_event || "sent",
  }));
  const periode = all.filter((m) => Date.parse(m.quand) >= since);
  const parEtat = {};
  for (const m of periode) parEtat[m.etat] = (parEtat[m.etat] || 0) + 1;
  const parSujet = new Map();
  for (const m of periode) {
    const k = String(m.sujet || "").replace(/\d+/g, "#").slice(0, 60);
    parSujet.set(k, (parSujet.get(k) || 0) + 1);
  }
  return {
    disponible: true,
    envoyes: periode.length,
    tronque: all.length >= 100 && Date.parse(all[all.length - 1]?.quand || 0) >= since,
    par_etat: parEtat,
    problemes: periode.filter((m) => ["bounced", "complained", "delivery_delayed", "failed"].includes(m.etat)).slice(0, 10),
    sujets: [...parSujet.entries()].map(([sujet, n]) => ({ sujet, n })).sort((a, b) => b.n - a.n).slice(0, 10),
    derniers: all.slice(0, 8),
  };
}

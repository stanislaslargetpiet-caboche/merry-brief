// Mails envoyés par Resend (invitations, notifications, relances, bienvenue), lus pour la page de pilotage.
// L'API liste les 100 derniers envois avec leur dernier événement (delivered, bounced, complained…).
// La clé d'envoi de l'appli (RESEND_API_KEY) est restreinte à l'envoi : la lecture demande une clé « Full access »
// dans RESEND_READ_API_KEY (Resend > API Keys > Create, permission Full access), sinon la section l'explique.

import { SUBJECT } from "@/lib/server/nouveautesMail";

// Les campagnes ont leur page (Croissance > Campagnes emails) : la page Mails ne garde que les mails automatiques.
// Santé et brief du matin continuent de tout compter, un rebond de campagne reste un rebond.
export const isCampagne = (sujet) => sujet === SUBJECT;

// Suivi par webhook (mail_events, supabase/mail-evenements.sql) : contrairement à la liste de l'API, limitée aux
// 100 derniers envois, il couvre toute la période et compte les ouvertures et les clics. Les ouvertures et les
// clics n'arrivent que si le suivi est activé sur le domaine dans Resend (Domains > Open and click tracking).
export function summarizeEvents(rows) {
  const parMail = new Map();
  for (const r of rows) {
    const m = parMail.get(r.email_id) || { types: new Set() };
    m.types.add(r.type);
    parMail.set(r.email_id, m);
  }
  const count = (type) => [...parMail.values()].filter((m) => m.types.has(type)).length;
  const envoyes = parMail.size;
  const delivres = count("email.delivered");
  return {
    actif: envoyes > 0,
    envoyes,
    delivres,
    ouverts: count("email.opened"),
    cliques: count("email.clicked"),
    rebonds: count("email.bounced"),
    plaintes: count("email.complained"),
    echecs: count("email.failed") + count("email.suppressed"),
    // Un mail ouvert est forcément arrivé : les taux se lisent sur les mails délivrés
    taux_ouverture: delivres ? Math.round((count("email.opened") / delivres) * 100) : null,
    taux_clic: delivres ? Math.round((count("email.clicked") / delivres) * 100) : null,
  };
}

// Envois par jour, heure de Paris, en [jour, n] comme les séries de PostHog : ne couvre que les 100 derniers envois rendus par l'API
export function sendsByDay(mails) {
  const parJour = new Map();
  for (const m of mails) {
    const jour = new Date(m.quand).toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
    parJour.set(jour, (parJour.get(jour) || 0) + 1);
  }
  return [...parJour.entries()];
}

async function readEvents(admin, days) {
  if (!admin) return null;
  const since = new Date(Date.now() - days * 86400 * 1000).toISOString();
  const { data, error } = await admin.from("mail_events").select("email_id,type,subject").gte("occurred_at", since).limit(20000);
  // Table absente (SQL pas encore collé) : la section garde la lecture de l'API seule
  if (error) return null;
  return summarizeEvents((data || []).filter((r) => !isCampagne(r.subject)));
}

const PROBLEMES = ["bounced", "complained", "delivery_delayed", "failed"];

function resumeMails(all, since) {
  const periode = all.filter((m) => Date.parse(m.quand) >= since);
  const parEtat = {};
  for (const m of periode) parEtat[m.etat] = (parEtat[m.etat] || 0) + 1;
  const parSujet = new Map();
  for (const m of periode) {
    const k = String(m.sujet || "").replace(/\d+/g, "#").slice(0, 60);
    parSujet.set(k, (parSujet.get(k) || 0) + 1);
  }
  return {
    envoyes: periode.length,
    par_etat: parEtat,
    par_jour: sendsByDay(all),
    problemes: periode.filter((m) => PROBLEMES.includes(m.etat)).slice(0, 10),
    sujets: [...parSujet.entries()].map(([sujet, n]) => ({ sujet, n })).sort((a, b) => b.n - a.n).slice(0, 10),
    derniers: all.slice(0, 8),
  };
}

export async function readResend(days, { signal, admin } = {}) {
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
  return {
    disponible: true,
    suivi: await readEvents(admin, days),
    tronque: all.length >= 100 && Date.parse(all[all.length - 1]?.quand || 0) >= since,
    ...resumeMails(all, since),
    hors_campagnes: resumeMails(all.filter((m) => !isCampagne(m.sujet)), since),
  };
}

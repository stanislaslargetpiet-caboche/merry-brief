// Mails envoyés par Resend (invitations, notifications, relances, bienvenue), lus pour la page de pilotage.
// L'API liste les 100 derniers envois avec leur dernier événement (delivered, bounced, complained…).
// La clé d'envoi de l'appli (RESEND_API_KEY) est restreinte à l'envoi : la lecture demande une clé « Full access »
// dans RESEND_READ_API_KEY (Resend > API Keys > Create, permission Full access), sinon la section l'explique.

import { estMailMerry } from "@/lib/server/resendWebhook";
import { SUBJECT } from "@/lib/server/nouveautesMail";

// Les campagnes ont leur page (Acquisition > Campagnes emails) : la page Mails automatiques ne garde que les mails automatiques.
// Santé et brief du matin continuent de tout compter, un rebond de campagne reste un rebond.
export const isCampagne = (sujet) => sujet === SUBJECT;

// Suivi par webhook (mail_events, supabase/mail-evenements.sql) : contrairement à la liste de l'API, limitée aux
// 100 derniers envois, il couvre toute la période. Open et Click tracking restent coupés dans Resend : ces traceurs
// demandent un consentement (recommandation CNIL du 12 mars 2026, D-184).
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
    rebonds: count("email.bounced"),
    plaintes: count("email.complained"),
    echecs: count("email.failed") + count("email.suppressed"),
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

// Envois automatiques par jour, lus dans le suivi par webhook (mail_events) qui couvre les deux périodes, là où les
// 100 derniers envois de l'API s'arrêtent souvent avant la période d'avant. `depuis` : jour (Paris) du premier
// événement reçu ; avant lui, un jour n'a pas de mesure.
export function envoisAuto(envois, premier) {
  if (!premier) return null;
  const parMail = new Map(envois.filter((e) => !isCampagne(e.subject)).map((e) => [e.email_id, { quand: e.occurred_at }]));
  return { depuis: new Date(premier).toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" }), par_jour: sendsByDay([...parMail.values()]) };
}

export async function readEnvoisAuto(admin, days) {
  if (!admin) return null;
  const since = new Date(Date.now() - 2 * days * 86400 * 1000).toISOString();
  const [envois, premier] = await Promise.all([
    admin.from("mail_events").select("email_id,subject,occurred_at").eq("type", "email.sent").gte("occurred_at", since).limit(20000),
    admin.from("mail_events").select("occurred_at").order("occurred_at", { ascending: true }).limit(1),
  ]);
  const failed = envois.error || premier.error;
  if (failed) throw new Error(failed.message);
  return envoisAuto(envois.data || [], premier.data?.[0]?.occurred_at);
}

const PROBLEMES = ["bounced", "complained", "delivery_delayed", "failed"];
// Coulisses › Mails automatiques : la liste des derniers envois, sous le graphe
const DERNIERS = 15;

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
    derniers: all.slice(0, DERNIERS),
  };
}

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
  const all = (json.data || []).filter((m) => estMailMerry(m.from)).map((m) => ({
    id: m.id,
    quand: m.created_at,
    a: Array.isArray(m.to) ? m.to.join(", ") : m.to,
    sujet: m.subject,
    etat: m.last_event || "sent",
  }));
  return {
    disponible: true,
    tronque: all.length >= 100 && Date.parse(all[all.length - 1]?.quand || 0) >= since,
    ...resumeMails(all, since),
    hors_campagnes: resumeMails(all.filter((m) => !isCampagne(m.sujet)), since),
  };
}

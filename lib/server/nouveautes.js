// Envoi du mail du samedi depuis le pilotage. La liste se recalcule à chaque lecture : organisateurs inscrits,
// moins les désinscrits et les comptes de test. Chaque envoi réserve sa clé dans mail_sent : un second clic
// reprend là où le premier s'est arrêté, sans renvoyer à personne.

import { deliver } from "@/lib/server/mailJobs";
import { unsubLink } from "@/lib/server/mailOptouts";
import { nouveautesMail } from "@/lib/server/nouveautesMail";
import { sendMail } from "@/lib/server/sendMail";

export const KIND = "nouveautes";
const PAUSE_MS = 600; // Resend limite le débit par seconde
const NOT_REAL = /(test|demo|stanislas|largetpiet|hugues|codron|@withmerry\.com$)/i;
// Adresses qui reçoivent le mail même si elles ressemblent à un compte de test (Stan, pour voir l'envoi réel)
export const INCLUS = ["stanislas.largetpiet@gmail.com"];
const SEND_HOUR = 8; // heure de Paris, le jour du samedi de l'issue

// 8 h à Paris le jour du samedi de l'issue, en millisecondes
export function heureDepart(issue) {
  const [y, m, d] = issue.samedi.split("-").map(Number);
  const hourInParis = (t) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", hourCycle: "h23" }).format(new Date(t)));
  let t = Date.UTC(y, m - 1, d, SEND_HOUR);
  for (let i = 0; i < 2; i += 1) t -= (hourInParis(t) - SEND_HOUR) * 3600000;
  return t;
}

// Resend garde le mail et le remet à cette heure ; passée, le mail part tout de suite
export function departAt(issue, now = new Date()) {
  const t = heureDepart(issue);
  return t - now.getTime() > 60000 ? new Date(t) : null;
}

const keyOf = (issue, email) => `nouveautes:${issue.numero}:${email}`;

function mailFor(issue, origin, to) {
  const unsub = unsubLink(origin, to, KIND);
  return {
    to,
    ...nouveautesMail({ issue, origin, unsub }),
    label: `nouveautés ${issue.numero}`,
    headers: { "List-Unsubscribe": `<${unsub}>` },
  };
}

async function organizers(admin) {
  const { data: weddings, error } = await admin.from("weddings").select("id");
  if (error) throw new Error(`weddings : ${error.message}`);
  const emails = new Set();
  for (const w of weddings || []) {
    const { data, error: failed } = await admin.rpc("merry_job_wedding_emails", { w: w.id });
    if (failed) throw new Error(`merry_job_wedding_emails : ${failed.message}`);
    for (const e of data || []) emails.add(String(e).trim().toLowerCase());
  }
  return [...emails].filter((e) => e.includes("@")).sort();
}

// Une liste de désinscrits illisible arrête l'envoi : contrairement aux notifications, personne n'attend ce mail
async function audience(admin, issue) {
  const all = [...new Set([...(await organizers(admin)), ...INCLUS])].sort();
  const { data: out, error } = await admin.from("mail_optouts").select("email").eq("kind", KIND).in("email", all.length ? all : [""]);
  if (error) throw new Error(`mail_optouts : ${error.message}`);
  const refused = new Set((out || []).map((r) => r.email));
  const keys = all.map((e) => keyOf(issue, e));
  const { data: done, error: unread } = await admin.from("mail_sent").select("key").in("key", keys.length ? keys : [""]);
  if (unread) throw new Error(`mail_sent : ${unread.message}`);
  const sent = new Set((done || []).map((r) => r.key));
  const counts = (e) => INCLUS.includes(e) || !NOT_REAL.test(e);
  const exclus = all.filter((e) => !counts(e));
  const real = all.filter((e) => counts(e) && !refused.has(e));
  return {
    exclus,
    desinscrits: all.filter((e) => refused.has(e)).length,
    deja: real.filter((e) => sent.has(keyOf(issue, e))).length,
    restants: real.filter((e) => !sent.has(keyOf(issue, e))),
  };
}

export async function issueState(admin, issue, origin) {
  const { exclus, desinscrits, deja, restants } = await audience(admin, issue);
  const { html } = nouveautesMail({ issue, origin, unsub: unsubLink(origin, "apercu@withmerry.com", KIND) });
  return { numero: issue.numero, samedi: issue.samedi, depart: departAt(issue)?.toISOString() || null, titre: issue.titre.join(" "), html, exclus, desinscrits, deja, restants };
}

export const sendTest = (issue, origin, to) => sendMail(mailFor(issue, origin, to));

// `attendu` est le nombre affiché au moment du clic : si la liste a bougé, rien ne part sans nouvelle lecture
export async function sendIssue(admin, issue, origin, attendu, now = new Date()) {
  const { restants } = await audience(admin, issue);
  if (restants.length !== attendu) return { error: "liste_changee", restants: restants.length };
  const depart = departAt(issue, now)?.toISOString();
  let envoyes = 0;
  for (const [i, to] of restants.entries()) {
    if (i) await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
    envoyes += await deliver(admin, keyOf(issue, to), { ...mailFor(issue, origin, to), scheduledAt: depart });
  }
  return { envoyes, echecs: restants.length - envoyes, depart: depart || null };
}

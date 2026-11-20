// Mails de démarrage des prestataires (D-378), lancés après ceux des couples par /api/interne/activite : un mail
// par soir à 20 h, trois au plus, aux comptes qui gèrent une fiche validée, à partir du premier soir qui suit la
// validation (ou la revendication, pour les fiches validées avant que la date ne soit notée) et pendant sept jours.
// Comme pour les couples (lib/server/demarrageJob.js), les fiches arrivées avant la séquence la reçoivent aussi :
// leurs sept jours partent du premier mail envoyé. L'état de la fiche est relu à chaque passage : une étape faite
// est sautée (photos : au moins trois ; tarifs : une formule ou une option ; calendrier : une date), tout fait, plus
// de mail. Une adresse qui a déjà reçu un mail de Merry ce jour-là attend le lendemain. Fiches de test (nom ou
// comptes de test) écartées.

import { windowEnd } from "@/lib/server/activiteMail";
import { estAdresseTest } from "@/lib/server/comptesTest";
import { PHOTOS_MIN, STEPS, demarrageProMail } from "@/lib/server/demarrageProMail";
import { deliver } from "@/lib/server/mailJobs";
import { optedOut, unsubLink } from "@/lib/server/mailOptouts";
import { personalFrom } from "@/lib/server/sendMail";

export const OPTOUT_KIND = "demarrage_pro";
export const MAX_DAYS = 7;
export const MAX_MAILS = 3;
const DAY = 86400000;
const NOM_TEST = /\b(test|d[ée]mo)\b/i;
const CONTACT = "bonjour@withmerry.com";

async function select(query, what) {
  const { data, error } = await query;
  if (error) throw new Error(`${what} : ${error.message}`);
  return data || [];
}

// Étapes restant à faire pour une fiche
export function ficheState({ photos = 0, formules = 0, dates = 0 }) {
  return { photos: photos < PHOTOS_MIN, tarifs: formules === 0, calendrier: dates === 0 };
}

// sent : étapes déjà envoyées à cette adresse pour cette fiche
export function nextStep(sent, pending) {
  if (sent.length >= MAX_MAILS) return null;
  return STEPS.find((s) => !sent.includes(s) && pending[s]) || null;
}

export const debutDe = (pro) => pro.verified_at || pro.claimed_at;

async function sentSteps(admin, vendorId, to) {
  const rows = await select(admin.from("mail_sent").select("key").like("key", `demarrage-pro:%:${vendorId}:${to}`), "mail_sent");
  return rows.map((r) => r.key.split(":")[1]);
}

async function mailedToday(admin, to, dayStart) {
  const rows = await select(admin.from("mail_sent").select("key").like("key", `%:${to}`).gte("sent_at", dayStart.toISOString()).limit(1), "mail_sent");
  return rows.length > 0;
}

async function premierEnvoi(admin) {
  const rows = await select(admin.from("mail_sent").select("sent_at").like("key", "demarrage-pro:%").order("sent_at", { ascending: true }).limit(1), "mail_sent");
  return rows[0] ? new Date(rows[0].sent_at) : null;
}

async function emailOf(admin, member) {
  const direct = String(member.email || "").trim().toLowerCase();
  if (direct) return direct;
  if (!member.user_id) return "";
  const { data } = await admin.auth.admin.getUserById(member.user_id);
  return String(data?.user?.email || "").trim().toLowerCase();
}

const countBy = (rows) => rows.reduce((m, r) => m.set(r.vendor_id, (m.get(r.vendor_id) || 0) + 1), new Map());

export async function runDemarragePro(admin, origin, now = new Date(), { dry = false, env = process.env } = {}) {
  const dayStart = new Date(windowEnd(now).getTime() - 20 * 3600 * 1000);
  const since = new Date(now.getTime() - MAX_DAYS * DAY);
  const report = { fiches: 0, envoyes: 0, ignores: 0, etapes: {} };

  const all = ((await premierEnvoi(admin)) ?? now) >= since;
  const pros = (await select(admin.from("pro_vendors").select("vendor_id, claimed_at, verified_at, verification").eq("verification", "validee"), "pro_vendors")).filter((p) => {
    const debut = debutDe(p);
    if (!debut || new Date(debut) >= dayStart) return false;
    return all || new Date(debut) >= since;
  });
  report.fiches = pros.length;
  if (!pros.length) return report;

  const ids = pros.map((p) => p.vendor_id);
  const catalog = admin.schema ? admin.schema("catalog") : admin;
  const [members, formulas, options, dates, fiches, photos] = await Promise.all([
    select(admin.from("pro_members").select("vendor_id, user_id, email").in("vendor_id", ids), "pro_members"),
    select(admin.from("pro_formulas").select("vendor_id").in("vendor_id", ids), "pro_formulas"),
    select(admin.from("pro_options").select("vendor_id").in("vendor_id", ids), "pro_options"),
    select(admin.from("pro_dates").select("vendor_id").in("vendor_id", ids), "pro_dates"),
    select(catalog.from("vendors").select("id, name, primary_category").in("id", ids), "vendors"),
    select(catalog.from("vendor_photos").select("vendor_id").in("vendor_id", ids), "vendor_photos"),
  ]);
  const ficheOf = new Map(fiches.map((f) => [f.id, f]));
  const photosBy = countBy(photos);
  const formulesBy = countBy([...formulas, ...options]);
  const datesBy = countBy(dates);

  for (const pro of pros) {
    const id = pro.vendor_id;
    const fiche = ficheOf.get(id) || {};
    const emails = [];
    for (const m of members.filter((x) => x.vendor_id === id && x.user_id)) {
      const to = await emailOf(admin, m);
      if (to && !emails.includes(to)) emails.push(to);
    }
    if (!emails.length || NOM_TEST.test(fiche.name || "") || emails.every((e) => estAdresseTest(e, env))) continue;
    const pending = ficheState({ photos: photosBy.get(id) || 0, formules: formulesBy.get(id) || 0, dates: datesBy.get(id) || 0 });
    const out = await optedOut(admin, emails, OPTOUT_KIND);

    for (const to of emails.filter((e) => !estAdresseTest(e, env))) {
      if (out.has(to)) {
        report.ignores += 1;
        continue;
      }
      const step = nextStep(await sentSteps(admin, id, to), pending);
      if (!step) continue;
      if (await mailedToday(admin, to, dayStart)) {
        report.ignores += 1;
        continue;
      }
      const unsub = unsubLink(origin, to, OPTOUT_KIND);
      const mail = demarrageProMail(step, { origin, unsub, vendorName: fiche.name || "", category: fiche.primary_category, photoCount: photosBy.get(id) || 0 });
      const sent = dry
        ? 1
        : await deliver(admin, `demarrage-pro:${step}:${id}:${to}`, {
            to,
            subject: mail.subject,
            text: mail.text,
            html: mail.html,
            from: personalFrom("Stan de Merry", ""),
            replyTo: CONTACT,
            label: `démarrage prestataire ${step}`,
            headers: { "List-Unsubscribe": `<${unsub}>` },
          });
      report.envoyes += sent;
      if (sent) report.etapes[step] = (report.etapes[step] || 0) + 1;
    }
  }
  return report;
}

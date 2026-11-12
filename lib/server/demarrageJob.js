// Mails de démarrage (D-285), lancés après le mail de 20 h par /api/interne/activite : un mail par soir, trois au
// plus, aux comptes du couple, à partir du premier soir qui suit l'inscription (créé avant minuit, donc au moins
// 20 h avant) et pendant sept jours. Les couples inscrits avant la séquence la reçoivent aussi : leurs sept jours
// partent du premier mail de démarrage envoyé, quelle que soit la date de mise en ligne. L'état du mariage est relu
// à chaque passage : une étape déjà faite est sautée, tout fait, plus de mail. Au troisième envoi, si rien n'a
// bougé, le mot de Stan remplace le mail budget. Une personne qui a déjà reçu un mail de Merry ce jour-là attend le
// lendemain. Chaque envoi réserve sa clé dans mail_sent (via deliver) : une reprise ou un second passage ne renvoie rien.
// Depuis Couples › Funnel du pilotage (D-289), un couple peut être sorti de la séquence et un mail retiré un à un
// (table demarrage_retraits, relue à chaque passage).

import { greetingName, memberEmail } from "@/lib/server/activiteJob";
import { windowEnd } from "@/lib/server/activiteMail";
import { estAdresseTest, estCoupleTest } from "@/lib/server/comptesTest";
import { STEPS, demarrageMail, stanMail } from "@/lib/server/demarrageMail";
import { deliver } from "@/lib/server/mailJobs";
import { optedOut, unsubLink } from "@/lib/server/mailOptouts";
import { displayName } from "@/lib/server/names";
import { personalFrom } from "@/lib/server/sendMail";

export const OPTOUT_KIND = "demarrage";
export const MAX_DAYS = 7; // au-delà, une séquence retardée par d'autres mails s'arrête
export const MAX_MAILS = 3;
export const MIN_GUESTS = 10;
export const RETRAITS = "demarrage_retraits";
export const TOUT = "tout"; // couple sorti de la séquence
export const RETIRABLES = [...STEPS, "stan"];
export const WEDDING_COLS = "id, created_at, created_by, brief_id, partner1, partner2, wedding_date, budget_total";
const CONTACT = "bonjour@withmerry.com";
const DAY = 86400000;
const SEEDED_MS = 5 * 60 * 1000; // postes de budget créés avec le mariage, à ne pas compter comme un geste du couple

async function select(query, what) {
  const { data, error } = await query;
  if (error) throw new Error(`${what} : ${error.message}`);
  return data || [];
}

// sent : étapes déjà envoyées à cette personne ; pending : { invites, equipe, budget }, vrai tant que l'étape reste à faire ;
// retires : mails retirés depuis le pilotage (un mot de Stan retiré laisse partir le mail budget à sa place)
export function nextStep(sent, pending, nothingMoved, retires = []) {
  if (sent.length >= MAX_MAILS || sent.includes("budget") || sent.includes("stan")) return null;
  const todo = STEPS.filter((s) => !sent.includes(s) && pending[s] && !retires.includes(s));
  if (!todo.length) return null;
  return sent.length === MAX_MAILS - 1 && nothingMoved && !retires.includes("stan") ? "stan" : todo[0];
}

// Mails qui suivraient, un par soir, si rien ne bougeait d'ici là : le planning du pilotage
export function planSteps(sent, pending, nothingMoved, retires, soirs) {
  const done = [...sent];
  const plan = [];
  for (const soir of soirs) {
    const etape = nextStep(done, pending, nothingMoved, retires);
    if (!etape) break;
    plan.push({ etape, soir });
    done.push(etape);
  }
  return plan;
}

// Soirs où la tâche de 20 h écrirait encore à ce mariage : ce soir si elle n'est pas passée, puis chaque soir où il
// est créé depuis la veille au moins et où ses sept jours (depuis l'inscription ou le premier envoi) courent encore
export function soirsAVenir(now, createdAt, lancement) {
  const created = new Date(createdAt).getTime();
  let premier = windowEnd(now);
  if (premier <= now) premier = windowEnd(new Date(premier.getTime() + DAY));
  const lance = lancement ? new Date(lancement).getTime() : premier.getTime();
  const out = [];
  for (let i = 0; i <= MAX_DAYS + 1; i += 1) {
    const soir = i ? windowEnd(new Date(premier.getTime() + i * DAY)) : premier;
    const since = soir.getTime() - MAX_DAYS * DAY;
    if (created < soir.getTime() - 20 * 3600 * 1000 && (lance >= since || created >= since)) out.push(soir);
  }
  return out;
}

// État du mariage vu par un destinataire : ce qui reste à faire, et si rien n'a bougé depuis l'inscription
export function weddingState({ wedding, me, members, guestCount, items, payments }) {
  const created = new Date(wedding.created_at).getTime();
  const budgetTouched =
    members.some((m) => m.contribution != null) ||
    payments.length > 0 ||
    items.some((i) => i.quote_amount != null || new Date(i.created_at).getTime() > created + SEEDED_MS);
  const team = members.filter((m) => m.id !== me && !m.user_id && !m.invited_at).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const othersMoved = members.some((m) => m.id !== me && (m.invited_at || m.user_id));
  // Un couple qui a déjà fait entrer quelqu'un d'autre sait inviter : une ligne de l'onboarding restée vide (« Parents
  // de Clem », alors que ses parents sont venus sous leurs prénoms) ne vaut pas un mail
  const teamJoined = members.some((m) => m.role !== "couple" && (m.invited_at || m.user_id));
  return {
    team,
    pending: { invites: guestCount < MIN_GUESTS, equipe: team.length > 0 && !teamJoined, budget: !budgetTouched },
    nothingMoved: guestCount === 0 && !budgetTouched && !othersMoved,
  };
}

export async function countGuests(admin, weddingId) {
  const { count, error } = await admin.from("guests").select("id", { count: "exact", head: true }).eq("wedding_id", weddingId);
  if (error) throw new Error(`guests : ${error.message}`);
  return count || 0;
}

export async function sentSteps(admin, weddingId, to) {
  const rows = await select(admin.from("mail_sent").select("key").like("key", `demarrage:%:${weddingId}:${to}`), "mail_sent");
  return rows.map((r) => r.key.split(":")[1]);
}

async function mailedToday(admin, to, dayStart) {
  const rows = await select(admin.from("mail_sent").select("key").like("key", `%:${to}`).gte("sent_at", dayStart.toISOString()).limit(1), "mail_sent");
  return rows.length > 0;
}

// Premier mail de démarrage jamais envoyé, ou rien avant le premier soir
export async function premierEnvoi(admin) {
  const rows = await select(admin.from("mail_sent").select("sent_at").like("key", "demarrage:%").order("sent_at", { ascending: true }).limit(1), "mail_sent");
  return rows[0] ? new Date(rows[0].sent_at) : null;
}

// Ce que la séquence lit de chaque mariage : membres, brief, budget, retraits, et les comptes du couple à qui écrire
// (hors comptes de test). `test` : mariage créé par un compte de test (une démo de Stan), qui ne reçoit rien, même
// si un vrai compte y est invité.
export async function chargerMariages(admin, weddings, env = process.env) {
  const ids = weddings.map((w) => w.id);
  const briefIds = weddings.map((w) => w.brief_id).filter(Boolean);
  const [members, briefs, items, payments, retraits] = await Promise.all([
    select(admin.from("wedding_members").select("id, wedding_id, user_id, email, display_name, role, contribution, invited_at, position").in("wedding_id", ids), "wedding_members"),
    briefIds.length ? select(admin.from("briefs").select("id, guests, first_name").in("id", briefIds), "briefs") : [],
    select(admin.from("budget_items").select("wedding_id, created_at, quote_amount").in("wedding_id", ids), "budget_items"),
    select(admin.from("payments").select("wedding_id").in("wedding_id", ids), "payments"),
    select(admin.from(RETRAITS).select("wedding_id, etape").in("wedding_id", ids), RETRAITS),
  ]);
  const briefOf = new Map(briefs.map((b) => [b.id, b]));
  const out = [];
  for (const wedding of weddings) {
    const wm = members.filter((m) => m.wedding_id === wedding.id);
    const accounts = [];
    for (const m of wm.filter((x) => x.role === "couple" && x.user_id)) {
      const to = await memberEmail(admin, m);
      if (to && !accounts.some((r) => r.to === to)) accounts.push({ to, member: m });
    }
    const creator = wm.find((m) => m.user_id && m.user_id === wedding.created_by);
    const createur = creator ? accounts.find((a) => a.member.id === creator.id)?.to ?? (await memberEmail(admin, creator)) : "";
    out.push({
      wedding,
      members: wm,
      test: estCoupleTest(createur, accounts.map((a) => a.to), env),
      recipients: accounts.filter((a) => !estAdresseTest(a.to, env)),
      brief: briefOf.get(wedding.brief_id) || null,
      items: items.filter((i) => i.wedding_id === wedding.id),
      payments: payments.filter((p) => p.wedding_id === wedding.id),
      retires: retraits.filter((r) => r.wedding_id === wedding.id).map((r) => r.etape),
    });
  }
  return out;
}

export const etatPour = (lot, member, guestCount) =>
  weddingState({ wedding: lot.wedding, me: member.id, members: lot.members, guestCount, items: lot.items, payments: lot.payments });

// Le mail d'une étape pour une personne, tel qu'il part ce soir-là (`now` : l'heure de l'envoi)
export function composer(etape, lot, member, state, guestCount, { origin, to, now, env = process.env }) {
  const { wedding, members: wm, brief } = lot;
  const firstName = greetingName(member.display_name) || (member.user_id === wedding.created_by ? greetingName(brief?.first_name) : "");
  const partner = wm.find((m) => m.role === "couple" && m.id !== member.id);
  const partnerName =
    greetingName(partner?.display_name) || greetingName([wedding.partner1, wedding.partner2].find((n) => n && displayName(n) !== firstName));
  const unsub = unsubLink(origin, to, OPTOUT_KIND);
  const ctx = {
    origin,
    unsub,
    now,
    firstName,
    partnerName,
    brief,
    guestCount,
    team: state.team,
    members: wm,
    me: member.id,
    budgetTotal: wedding.budget_total,
    weddingDate: wedding.wedding_date,
    createdAt: wedding.created_at,
    rdv: env.MERRY_LIEN_RDV || "",
  };
  return { unsub, mail: etape === "stan" ? stanMail(ctx) : demarrageMail(etape, ctx) };
}

export async function runDemarrage(admin, origin, now = new Date(), { dry = false, env = process.env } = {}) {
  // Minuit à Paris : 20 h moins 20 h. Créé avant minuit, un mariage a au moins 20 h au premier envoi.
  const dayStart = new Date(windowEnd(now).getTime() - 20 * 3600 * 1000);
  const since = new Date(now.getTime() - MAX_DAYS * DAY);
  const report = { mariages: 0, envoyes: 0, ignores: 0, etapes: {} };

  // Les sept jours d'un couple partent de son inscription, ou du lancement pour les couples déjà inscrits
  const all = ((await premierEnvoi(admin)) ?? now) >= since;
  let query = admin.from("weddings").select(WEDDING_COLS).lt("created_at", dayStart.toISOString());
  if (!all) query = query.gte("created_at", since.toISOString());
  const weddings = await select(query, "weddings");
  report.mariages = weddings.length;
  if (!weddings.length) return report;

  for (const lot of await chargerMariages(admin, weddings, env)) {
    const { wedding, recipients, retires } = lot;
    if (lot.test || !recipients.length || retires.includes(TOUT)) continue;
    const out = await optedOut(admin, recipients.map((r) => r.to), OPTOUT_KIND);
    const guestCount = await countGuests(admin, wedding.id);

    for (const { to, member } of recipients) {
      if (out.has(to)) {
        report.ignores += 1;
        continue;
      }
      const state = etatPour(lot, member, guestCount);
      const step = nextStep(await sentSteps(admin, wedding.id, to), state.pending, state.nothingMoved, retires);
      if (!step) continue;
      if (await mailedToday(admin, to, dayStart)) {
        report.ignores += 1;
        continue;
      }

      const { mail, unsub } = composer(step, lot, member, state, guestCount, { origin, to, now, env });
      const sent = dry
        ? 1
        : await deliver(admin, `demarrage:${step}:${wedding.id}:${to}`, {
            to,
            subject: mail.subject,
            text: mail.text,
            html: mail.html,
            label: `démarrage ${step}`,
            headers: { "List-Unsubscribe": `<${unsub}>` },
            ...(step === "stan" ? { from: personalFrom("Stan de Merry", ""), replyTo: CONTACT } : {}),
          });
      report.envoyes += sent;
      if (sent) report.etapes[step] = (report.etapes[step] || 0) + 1;
    }
  }
  return report;
}

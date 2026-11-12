// Mails de démarrage (D-285), lancés après le mail de 20 h par /api/interne/activite : un mail par soir, trois au
// plus, aux comptes du couple, à partir du premier soir qui suit l'inscription (créé avant minuit, donc au moins
// 20 h avant) et pendant sept jours. Les couples inscrits avant la séquence la reçoivent aussi : leurs sept jours
// partent du premier mail de démarrage envoyé, quelle que soit la date de mise en ligne. L'état du mariage est relu
// à chaque passage : une étape déjà faite est sautée, tout fait, plus de mail. Au troisième envoi, si rien n'a
// bougé, le mot de Stan remplace le mail budget. Une personne qui a déjà reçu un mail de Merry ce jour-là attend le
// lendemain. Chaque envoi réserve sa clé dans mail_sent (via deliver) : une reprise ou un second passage ne renvoie rien.

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
const CONTACT = "bonjour@withmerry.com";
const SEEDED_MS = 5 * 60 * 1000; // postes de budget créés avec le mariage, à ne pas compter comme un geste du couple

async function select(query, what) {
  const { data, error } = await query;
  if (error) throw new Error(`${what} : ${error.message}`);
  return data || [];
}

// sent : étapes déjà envoyées à cette personne ; pending : { invites, equipe, budget }, vrai tant que l'étape reste à faire
export function nextStep(sent, pending, nothingMoved) {
  if (sent.length >= MAX_MAILS || sent.includes("budget") || sent.includes("stan")) return null;
  const todo = STEPS.filter((s) => !sent.includes(s) && pending[s]);
  if (!todo.length) return null;
  return sent.length === MAX_MAILS - 1 && nothingMoved ? "stan" : todo[0];
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

async function countGuests(admin, weddingId) {
  const { count, error } = await admin.from("guests").select("id", { count: "exact", head: true }).eq("wedding_id", weddingId);
  if (error) throw new Error(`guests : ${error.message}`);
  return count || 0;
}

async function sentSteps(admin, weddingId, to) {
  const rows = await select(admin.from("mail_sent").select("key").like("key", `demarrage:%:${weddingId}:${to}`), "mail_sent");
  return rows.map((r) => r.key.split(":")[1]);
}

async function mailedToday(admin, to, dayStart) {
  const rows = await select(admin.from("mail_sent").select("key").like("key", `%:${to}`).gte("sent_at", dayStart.toISOString()).limit(1), "mail_sent");
  return rows.length > 0;
}

// Premier mail de démarrage jamais envoyé ; avant lui, c'est ce soir
async function lancement(admin, now) {
  const rows = await select(admin.from("mail_sent").select("sent_at").like("key", "demarrage:%").order("sent_at", { ascending: true }).limit(1), "mail_sent");
  return rows[0] ? new Date(rows[0].sent_at) : now;
}

export async function runDemarrage(admin, origin, now = new Date(), { dry = false, env = process.env } = {}) {
  // Minuit à Paris : 20 h moins 20 h. Créé avant minuit, un mariage a au moins 20 h au premier envoi.
  const dayStart = new Date(windowEnd(now).getTime() - 20 * 3600 * 1000);
  const since = new Date(now.getTime() - MAX_DAYS * 86400000);
  const report = { mariages: 0, envoyes: 0, ignores: 0, etapes: {} };

  // Les sept jours d'un couple partent de son inscription, ou du lancement pour les couples déjà inscrits
  const all = (await lancement(admin, now)) >= since;
  let query = admin.from("weddings").select("id, created_at, created_by, brief_id, partner1, partner2, wedding_date, budget_total").lt("created_at", dayStart.toISOString());
  if (!all) query = query.gte("created_at", since.toISOString());
  const weddings = await select(query, "weddings");
  report.mariages = weddings.length;
  if (!weddings.length) return report;
  const ids = weddings.map((w) => w.id);
  const briefIds = weddings.map((w) => w.brief_id).filter(Boolean);
  const [members, briefs, items, payments] = await Promise.all([
    select(admin.from("wedding_members").select("id, wedding_id, user_id, email, display_name, role, contribution, invited_at, position").in("wedding_id", ids), "wedding_members"),
    briefIds.length ? select(admin.from("briefs").select("id, guests, first_name").in("id", briefIds), "briefs") : [],
    select(admin.from("budget_items").select("wedding_id, created_at, quote_amount").in("wedding_id", ids), "budget_items"),
    select(admin.from("payments").select("wedding_id").in("wedding_id", ids), "payments"),
  ]);
  const briefOf = new Map(briefs.map((b) => [b.id, b]));

  for (const wedding of weddings) {
    const wm = members.filter((m) => m.wedding_id === wedding.id);
    const accounts = [];
    for (const m of wm.filter((x) => x.role === "couple" && x.user_id)) {
      const to = await memberEmail(admin, m);
      if (to && !accounts.some((r) => r.to === to)) accounts.push({ to, member: m });
    }
    // Un mariage créé par un compte de test (une démo de Stan) ne reçoit rien, même si un vrai compte y est invité
    const creator = wm.find((m) => m.user_id && m.user_id === wedding.created_by);
    const createur = creator ? accounts.find((a) => a.member.id === creator.id)?.to ?? (await memberEmail(admin, creator)) : "";
    if (estCoupleTest(createur, accounts.map((a) => a.to), env)) continue;
    const recipients = accounts.filter((a) => !estAdresseTest(a.to, env));
    if (!recipients.length) continue;
    const out = await optedOut(admin, recipients.map((r) => r.to), OPTOUT_KIND);
    const guestCount = await countGuests(admin, wedding.id);
    const brief = briefOf.get(wedding.brief_id) || null;

    for (const { to, member } of recipients) {
      if (out.has(to)) {
        report.ignores += 1;
        continue;
      }
      const state = weddingState({
        wedding,
        me: member.id,
        members: wm,
        guestCount,
        items: items.filter((i) => i.wedding_id === wedding.id),
        payments: payments.filter((p) => p.wedding_id === wedding.id),
      });
      const step = nextStep(await sentSteps(admin, wedding.id, to), state.pending, state.nothingMoved);
      if (!step) continue;
      if (await mailedToday(admin, to, dayStart)) {
        report.ignores += 1;
        continue;
      }

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
      const mail = step === "stan" ? stanMail(ctx) : demarrageMail(step, ctx);
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

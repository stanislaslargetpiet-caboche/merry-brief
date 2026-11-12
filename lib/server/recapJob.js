// Récap du samedi 8 h (D-296) : pour chaque mariage inscrit depuis plus d'une semaine, un mail à chaque compte du
// couple (hors comptes de test), avec la semaine écoulée (samedi 8 h précédent à ce samedi 8 h) lue dans la base.
// Les mariages plus récents sont encore dans les mails de démarrage. La désinscription reprend celle des anciens
// mails du samedi (« nouveautes ») : qui les avait refusés ne reçoit pas le récap. Chaque envoi réserve sa clé dans
// mail_sent (via deliver) : le second passage de la matinée, ou une reprise, ne renvoie rien.

import { collectActivite, greetingName } from "@/lib/server/activiteJob";
import { WEDDING_COLS, chargerMariages, countGuests, weddingState } from "@/lib/server/demarrageJob";
import { deliver } from "@/lib/server/mailJobs";
import { optedOut, unsubLink } from "@/lib/server/mailOptouts";
import { heureDepart } from "@/lib/server/nouveautes";
import { recapMail } from "@/lib/server/recapMail";
import { parisParts } from "@/lib/server/pilotage/schedule";

export const OPTOUT_KIND = "nouveautes";
const DAY = 86400000;
const PAGE = 1000; // lignes renvoyées au plus par une requête Supabase

async function select(query, what) {
  const { data, error } = await query;
  if (error) throw new Error(`${what} : ${error.message}`);
  return data || [];
}

// Toutes les lignes, page par page : une grande liste d'invités dépasse la limite d'une requête
async function selectAll(make, what) {
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const rows = await select(make().range(from, from + PAGE - 1), what);
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

export const isSaturday = (now) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", weekday: "short" }).format(now) === "Sat";

const dateOf = (now) => {
  const { year, month, day } = parisParts(now);
  return `${year}-${month}-${day}`;
};

// La semaine du récap : du samedi précédent 8 h à ce samedi 8 h, heure de Paris
export function fenetre(now) {
  const today = dateOf(now);
  const end = new Date(heureDepart({ samedi: today }));
  const start = new Date(end.getTime() - 7 * DAY);
  return { today, start, end, startDate: dateOf(start) };
}

const inWindow = (iso, w) => iso && new Date(iso) >= w.start && new Date(iso) < w.end;
const inDates = (d, w) => d && d >= w.startDate && d < w.today;

// Ce que le récap lit d'un mariage, en plus du lot de chargerMariages
export async function lireMariage(admin, lot, w) {
  const id = lot.wedding.id;
  const [guestCount, answered, tasks, docs, form, site, vendors, picks, tables] = await Promise.all([
    countGuests(admin, id),
    selectAll(() => admin.from("guest_responses").select("guest_id, status").eq("wedding_id", id).in("status", ["oui", "non"]).order("guest_id"), "guest_responses"),
    select(admin.from("tasks").select("title, due_date, done, done_at, position").eq("wedding_id", id), "tasks"),
    select(admin.from("documents").select("kind, created_at").eq("wedding_id", id), "documents"),
    select(admin.from("guest_forms").select("wedding_id").eq("wedding_id", id), "guest_forms"),
    select(admin.from("wedding_sites").select("wedding_id").eq("wedding_id", id), "wedding_sites"),
    select(admin.from("vendors").select("id").eq("wedding_id", id).limit(1), "vendors"),
    select(admin.from("vendor_picks").select("quote_at").eq("wedding_id", id), "vendor_picks"),
    select(admin.from("seating_tables").select("id").eq("wedding_id", id).limit(1), "seating_tables"),
  ]);
  const repondu = new Set(answered.map((r) => r.guest_id));
  const oui = new Set(answered.filter((r) => r.status === "oui").map((r) => r.guest_id));
  const open = tasks
    .filter((t) => !t.done)
    .sort((a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999") || (a.position ?? 0) - (b.position ?? 0));
  return {
    guestCount,
    enAttente: Math.max(0, guestCount - repondu.size),
    oui: oui.size,
    taches: open,
    tachesFaites: tasks.filter((t) => t.done && inWindow(t.done_at, w)).length,
    devis: docs.filter((d) => d.kind === "devis" && inWindow(d.created_at, w)).length + picks.filter((p) => inDates(p.quote_at, w)).length,
    usage: {
      // Même lecture que les mails de démarrage : une part fixée, un paiement, un devis ou un poste ajouté à la main
      budget: !weddingState({ wedding: lot.wedding, me: null, members: lot.members, guestCount, items: lot.items, payments: lot.payments }).pending.budget,
      invites: guestCount >= 10,
      formulaire: form.length > 0,
      site: site.length > 0,
      documents: docs.length > 0,
      prestataires: vendors.length > 0 || picks.length > 0,
      plan: tables.length > 0,
    },
  };
}

// La semaine d'un mariage vue par un destinataire : ses propres ajouts d'invités sont dits à la deuxième personne
export function semaineDe(activity, lot, lu, member, w) {
  const a = activity || { reponses: [], ajoutsParEquipe: [], prestataires: [], messages: [] };
  return {
    reponses: a.reponses,
    ajouts: a.ajoutsParEquipe.map((x) => ({ author: x.author, count: x.count, moi: x.memberId === member.id })),
    prestataires: a.prestataires,
    messages: a.messages,
    signes: lot.items.filter((i) => inDates(i.quote_signed_at, w)).map((i) => ({ label: i.label, amount: i.quote_amount })),
    devis: lu.devis,
    taches: lu.tachesFaites,
  };
}

export function composerRecap(lot, lu, activity, member, { origin, to, w }) {
  const { wedding, brief } = lot;
  const firstName = greetingName(member.display_name) || (member.user_id === wedding.created_by ? greetingName(brief?.first_name) : "");
  const unsub = unsubLink(origin, to, OPTOUT_KIND);
  const mail = recapMail({
    origin,
    unsub,
    firstName,
    weddingDate: wedding.wedding_date,
    today: w.today,
    budgetTotal: wedding.budget_total,
    engage: lot.items.reduce((s, i) => s + Number(i.quote_amount || 0), 0),
    semaine: semaineDe(activity, lot, lu, member, w),
    enAttente: lu.enAttente,
    oui: lu.oui,
    taches: lu.taches,
    guestCount: lu.guestCount,
    usage: lu.usage,
  });
  return { mail, unsub };
}

export async function runRecap(admin, origin, now = new Date(), { dry = false, env = process.env } = {}) {
  const w = fenetre(now);
  const report = { mariages: 0, envoyes: 0, ignores: 0, rien: 0, variantes: {}, fenetre: [w.start.toISOString(), w.end.toISOString()] };
  const weddings = await select(admin.from("weddings").select(WEDDING_COLS).lt("created_at", new Date(now.getTime() - 7 * DAY).toISOString()), "weddings");
  report.mariages = weddings.length;
  if (!weddings.length) return report;

  const { activity } = await collectActivite(admin, w.start, w.end);
  const lots = await chargerMariages(admin, weddings, env);
  // budget_items de chargerMariages ne porte pas le libellé ni la date de signature
  const items = await selectAll(
    () => admin.from("budget_items").select("id, wedding_id, label, quote_amount, quote_signed_at, created_at").in("wedding_id", weddings.map((x) => x.id)).order("id"),
    "budget_items",
  );

  for (const lot of lots) {
    if (lot.test || !lot.recipients.length) continue;
    const full = { ...lot, items: items.filter((i) => i.wedding_id === lot.wedding.id) };
    const lu = await lireMariage(admin, full, w);
    const out = await optedOut(admin, lot.recipients.map((r) => r.to), OPTOUT_KIND);
    for (const { to, member } of lot.recipients) {
      if (out.has(to)) {
        report.ignores += 1;
        continue;
      }
      const { mail, unsub } = composerRecap(full, lu, activity.get(lot.wedding.id), member, { origin, to, w });
      if (!mail) {
        report.rien += 1;
        continue;
      }
      const sent = dry
        ? 1
        : await deliver(admin, `recap:${w.today}:${lot.wedding.id}:${to}`, {
            to,
            subject: mail.subject,
            text: mail.text,
            html: mail.html,
            label: `récap du samedi (${mail.variante})`,
            headers: { "List-Unsubscribe": `<${unsub}>` },
          });
      report.envoyes += sent;
      if (sent) report.variantes[mail.variante] = (report.variantes[mail.variante] || 0) + 1;
    }
  }
  return report;
}

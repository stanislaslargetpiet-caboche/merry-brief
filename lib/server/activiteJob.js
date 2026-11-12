// Mail de 20 h : pour chaque mariage où il s'est passé quelque chose depuis la veille à 20 h, un mail à chaque
// organisateur inscrit (lib/server/activiteMail.js). Aucune activité, aucun mail. Chaque envoi réserve d'abord
// sa clé dans mail_sent (via deliver) : une reprise ou un second passage ne renvoie rien.

import { deliver } from "@/lib/server/mailJobs";
import { buildActivite, windowEnd, windowStart } from "@/lib/server/activiteMail";
import { optedOut, unsubLink } from "@/lib/server/mailOptouts";
import { mailShell } from "@/lib/server/mailShell";
import { displayName } from "@/lib/server/names";
import { coupleNames } from "@/lib/dash/picks";
import { parisParts } from "@/lib/server/pilotage/schedule";

export const OPTOUT_KIND = "activite";

async function select(query, what) {
  const { data, error } = await query;
  if (error) throw new Error(`${what} : ${error.message}`);
  return data || [];
}

const group = (rows, keyOf) => {
  const map = new Map();
  for (const r of rows) {
    const k = keyOf(r);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(r);
  }
  return map;
};

const fullName = (g) => [g.first_name, g.last_name].filter(Boolean).map(displayName).join(" ");

// Un seul mot : « Stanislas ». Un nom d'équipe (« Parents de Margue ») ne se prête pas à « Bonjour … ».
export const greetingName = (name) => {
  const clean = String(name || "").trim();
  return clean && !/\s/.test(clean) ? displayName(clean) : "";
};

export async function memberEmail(admin, m) {
  const own = String(m.email || "").trim();
  if (own) return own.toLowerCase();
  const { data } = await admin.auth.admin.getUserById(m.user_id);
  return String(data?.user?.email || "").trim().toLowerCase();
}

// Ce qui s'est passé, par mariage, dans la fenêtre [start, end[
export async function collectActivite(admin, start, end) {
  const from = start.toISOString();
  const to = end.toISOString();
  const [responses, additions, edits, replies] = await Promise.all([
    select(
      admin.from("guest_response_log").select("wedding_id, guest_id, event_id, status, created_at").eq("source", "formulaire").in("status", ["oui", "non"]).gte("created_at", from).lt("created_at", to).order("created_at"),
      "guest_response_log",
    ),
    select(admin.from("guest_activity").select("wedding_id, guest_id, guest_name, source, member_id, created_at").eq("kind", "ajout").gte("created_at", from).lt("created_at", to), "guest_activity"),
    // Fiches remplies par le formulaire : la seule trace d'une réponse quand il ne pose pas la question de présence
    select(admin.from("guest_activity").select("wedding_id, guest_id, guest_name, kind, source, created_at").eq("kind", "champ").eq("source", "formulaire").gte("created_at", from).lt("created_at", to), "guest_activity"),
    select(admin.from("vendor_messages").select("wedding_id, vendor_id").eq("from_vendor", true).gte("sent_at", from).lt("sent_at", to), "vendor_messages"),
  ]);
  const formTouches = [...additions.filter((a) => a.source === "formulaire"), ...edits.filter((a) => a.kind === "champ" && a.source === "formulaire")];
  formTouches.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  const weddingIds = [...new Set([...responses, ...additions, ...formTouches, ...replies].map((r) => r.wedding_id))];
  if (!weddingIds.length) return { activity: new Map(), members: [] };

  const guestIds = [...new Set([...responses, ...formTouches].map((r) => r.guest_id))];
  const eventIds = [...new Set(responses.map((r) => r.event_id).filter(Boolean))];
  const vendorIds = [...new Set(replies.map((r) => r.vendor_id))];
  const [guests, events, vendors, earlier, members, weddings] = await Promise.all([
    guestIds.length ? select(admin.from("guests").select("id, wedding_id, first_name, last_name").in("id", guestIds), "guests") : [],
    eventIds.length ? select(admin.from("events").select("id, name, short_name, position").in("id", eventIds), "events") : [],
    vendorIds.length ? select(admin.from("vendors").select("id, wedding_id, name").in("id", vendorIds), "vendors") : [],
    vendorIds.length ? select(admin.from("vendor_messages").select("wedding_id, vendor_id").eq("from_vendor", true).lt("sent_at", from).in("vendor_id", vendorIds), "vendor_messages") : [],
    select(admin.from("wedding_members").select("id, wedding_id, user_id, email, display_name").in("wedding_id", weddingIds).not("user_id", "is", null), "wedding_members"),
    select(admin.from("weddings").select("id, partner1, partner2").in("id", weddingIds), "weddings"),
  ]);
  const coupleOf = new Map(weddings.map((w) => [w.id, coupleNames(w)]));

  const guestName = new Map(guests.map((g) => [g.id, fullName(g)]));
  const eventOf = new Map(events.map((e) => [e.id, { label: e.short_name || e.name || "", position: e.position ?? 0 }]));
  const vendorName = new Map(vendors.map((v) => [`${v.wedding_id}:${v.id}`, v.name]));
  const answeredBefore = new Set(earlier.map((r) => `${r.wedding_id}:${r.vendor_id}`));
  const memberName = new Map(members.map((m) => [m.id, greetingName(m.display_name) || String(m.display_name || "").trim()]));

  const out = new Map();
  for (const weddingId of weddingIds) {
    // La dernière réponse de chaque invité à chaque événement l'emporte. Le formulaire répond à tous les
    // événements d'un coup, à la même heure : seul l'événement les départage, jamais l'ordre des lignes.
    const latest = new Map();
    for (const r of responses.filter((x) => x.wedding_id === weddingId)) {
      if (!latest.has(r.guest_id)) latest.set(r.guest_id, new Map());
      latest.get(r.guest_id).set(r.event_id, r.status);
    }
    const withPresence = [...latest].map(([guestId, byEvent]) => {
      const evs = [...byEvent].map(([eventId, status]) => ({ ...(eventOf.get(eventId) || { label: "", position: 0 }), comes: status === "oui" }));
      evs.sort((a, b) => a.position - b.position);
      return { name: guestName.get(guestId) || "Un invité", comes: evs.some((e) => e.comes), events: evs.map(({ label, comes }) => ({ label, comes })) };
    });
    const added = additions.filter((a) => a.wedding_id === weddingId);
    // Sans question de présence, le formulaire ne laisse que la fiche qu'il a créée ou remplie : l'invité a
    // répondu sans dire s'il vient (comes: null). Créé par le formulaire, il garde la pastille AJOUTÉ.
    const createdByForm = new Set(added.filter((a) => a.source === "formulaire").map((a) => a.guest_id));
    const silent = new Map();
    for (const a of formTouches) if (a.wedding_id === weddingId && !latest.has(a.guest_id) && !silent.has(a.guest_id)) silent.set(a.guest_id, a);
    const withoutPresence = [...silent.values()].map((a) => ({ name: guestName.get(a.guest_id) || displayName(a.guest_name) || "Un invité", comes: null, added: createdByForm.has(a.guest_id), events: [] }));
    // Tout invité ajouté par le formulaire y a répondu : il figure parmi les réponses, pas dans les ajouts
    const reponses = [...withPresence, ...withoutPresence];
    const byOrganiser = group(added.filter((a) => a.source !== "formulaire"), (a) => a.member_id || "");
    const ajoutsParEquipe = [...byOrganiser].map(([memberId, rows]) => ({ memberId, author: memberName.get(memberId) || "Un organisateur", count: rows.length }));

    const perVendor = group(replies.filter((r) => r.wedding_id === weddingId), (r) => r.vendor_id);
    const prestataires = [];
    const messages = [];
    for (const [vendorId, rows] of perVendor) {
      const name = vendorName.get(`${weddingId}:${vendorId}`) || "Un prestataire";
      if (answeredBefore.has(`${weddingId}:${vendorId}`)) messages.push({ name, count: rows.length });
      else prestataires.push({ name });
    }
    out.set(weddingId, { couple: coupleOf.get(weddingId) || "", reponses, ajouts: [], ajoutsParEquipe, prestataires, messages });
  }
  return { activity: out, members };
}

// `sauf` : « mariage:adresse » qui ont reçu le récap du dimanche ce soir, et n'ont donc pas ce mail-ci (D-297)
export async function runActivite(admin, origin, now = new Date(), { dry = false, sauf = new Set() } = {}) {
  const end = windowEnd(now);
  const start = windowStart(end);
  const collected = await collectActivite(admin, start, end);
  if (!collected.activity.size) return { mariages: 0, envoyes: 0, fenetre: [start.toISOString(), end.toISOString()] };

  const { year, month, day } = parisParts(now);
  const date = `${year}-${month}-${day}`;
  const report = { mariages: collected.activity.size, envoyes: 0, ignores: 0, fenetre: [start.toISOString(), end.toISOString()] };
  const byWedding = group(collected.members, (m) => m.wedding_id);

  for (const [weddingId, activity] of collected.activity) {
    const recipients = [];
    for (const m of byWedding.get(weddingId) || []) {
      const to = await memberEmail(admin, m);
      if (to && !recipients.some((r) => r.to === to)) recipients.push({ to, member: m });
    }
    const out = await optedOut(admin, recipients.map((r) => r.to), OPTOUT_KIND);
    for (const { to, member } of recipients) {
      if (out.has(to) || sauf.has(`${weddingId}:${to}`)) {
        report.ignores += 1;
        continue;
      }
      // Ses propres ajouts ne sont pas une nouveauté pour lui
      const mine = { ...activity, ajoutsParEquipe: activity.ajoutsParEquipe.filter((a) => a.memberId !== member.id) };
      const mail = buildActivite({ activity: mine, firstName: greetingName(member.display_name), origin, unsub: unsubLink(origin, to, OPTOUT_KIND), link: `${origin}/dashboard` });
      if (!mail) continue;
      if (dry) {
        report.envoyes += 1;
        continue;
      }
      report.envoyes += await deliver(admin, `activite:${date}:${weddingId}:${to}`, {
        to,
        subject: mail.subject,
        text: mail.text,
        label: "activité quotidienne",
        html: mailShell({ title: mail.subject, preheader: mail.preheader, body: mail.body }),
      });
    }
  }
  return report;
}

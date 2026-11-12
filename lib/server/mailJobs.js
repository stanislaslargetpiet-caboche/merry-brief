// Relances et résumés quotidiens (planches V31 à V33, V35 et V57), lancés par /api/interne/quotidien. Chaque
// mail réserve d'abord sa clé dans mail_sent : une reprise ou un double appel ne renvoie rien. Un type de mail
// en erreur n'empêche pas les suivants. Plus de V34 (réponses au formulaire) depuis D-295 : le mail de 20 h
// (lib/server/activiteJob.js) les donne déjà le soir même.

import { optedOut, unsubLink } from "@/lib/server/mailOptouts";
import { mailShell } from "@/lib/server/mailShell";
import { sendMail } from "@/lib/server/sendMail";
import { renderMail } from "@/lib/server/mailTemplate";
import { displayName } from "@/lib/server/names";
import { dropOptedOut, vendorRecipients } from "@/lib/server/vendorRecipients";

const coupleOf = (p1, p2) => [p1, p2].filter(Boolean).map(displayName).join(" et ");
const plural = (p1, p2) => Boolean(p1 && p2);
const longDay = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" });
const today = () => new Date().toISOString().slice(0, 10);

async function reserve(admin, key) {
  const { error } = await admin.from("mail_sent").insert({ key });
  if (!error) return true;
  if (String(error.code) === "23505") return false;
  throw new Error(`mail_sent : ${error.message}`);
}

// La clé réservée d'un envoi raté est rendue : le mail repart le lendemain
export async function deliver(admin, key, mail) {
  if (!(await reserve(admin, key))) return 0;
  if (await sendMail(mail)) return 1;
  await admin.from("mail_sent").delete().eq("key", key);
  return 0;
}

function compose({ to, subject, preheader, text, label, fromName, ...content }) {
  return { to, subject, text, label, fromName, html: mailShell({ title: subject, preheader, body: renderMail(content) }) };
}

async function rowsOf(admin, fn) {
  const { data, error } = await admin.rpc(fn);
  if (error) throw new Error(`${fn} : ${error.message}`);
  return data || [];
}

async function demandes(admin, origin) {
  let sent = 0;
  for (const r of await rowsOf(admin, "merry_job_demandes")) {
    const couple = coupleOf(r.partner1, r.partner2) || "Un couple";
    const verb = plural(r.partner1, r.partner2) ? "attendent" : "attend";
    const title = `${couple} ${verb} ta réponse`;
    const para = "Leur demande est toujours sans réponse. La consulter est gratuit : tes crédits ne servent qu'à y répondre.";
    const recipients = await vendorRecipients(admin, { contact: r.vendor_email, catalogId: r.catalog_id, origin });
    await dropOptedOut(admin, recipients, "vendor_message");
    for (const [to, link] of recipients) {
      sent += await deliver(admin, `demande:${r.pick_id}:${to}`, compose({
        to,
        subject: title,
        preheader: para,
        text: `${title}.\n\n${para}\n\nLire la demande : ${link}`,
        label: "relance demande",
        fromName: couple,
        title: `${title}.`,
        card: { name: couple, sub: "Demande restée sans réponse" },
        paras: [para],
        cta: { label: "Lire la demande", href: link },
        why: "Tu reçois ce mail car un couple t'a écrit sur Merry.",
        link: { label: "Se désinscrire", href: unsubLink(origin, to) },
      }));
    }
  }
  return sent;
}

// V57 (leçon Mariages.net, D-305) : un prestataire a répondu il y a 3 à 10 jours, le couple n'a
// toujours rien dit. Même un non l'aide à s'organiser.
async function demandesCouple(admin, origin) {
  let sent = 0;
  for (const r of await rowsOf(admin, "merry_job_demandes_couple")) {
    const title = `${r.vendor_name} attend ta réponse`;
    const para = "Sa réponse est restée sans suite. Un clic suffit, même pour dire non, et tu peux modifier le message avant qu'il parte.";
    const link = `${origin}/dashboard/prestataires/messagerie`;
    const out = await optedOut(admin, r.emails, "couple_reply");
    for (const to of (r.emails || []).map((e) => e.toLowerCase()).filter((e) => !out.has(e))) {
      sent += await deliver(admin, `demande-couple:${r.wedding_id}:${r.vendor_id}:${to}`, compose({
        to,
        subject: title,
        preheader: para,
        text: `${title}.\n\n${para}\n\nRépondre : ${link}`,
        label: "relance couple",
        fromName: r.vendor_name,
        title: `${title}.`,
        card: { name: r.vendor_name, sub: "Sa réponse attend la tienne" },
        paras: [para],
        cta: { label: `Répondre à ${r.vendor_name}`, href: link },
        why: `Tu reçois ce mail car ${r.vendor_name} t'a répondu sur Merry.`,
        link: { label: "Gérer mes notifications", href: `${origin}/dashboard/reglages` },
      }));
    }
  }
  return sent;
}

async function options(admin, origin) {
  let sent = 0;
  for (const r of await rowsOf(admin, "merry_job_options")) {
    const days = Math.max(0, Math.round((new Date(`${r.expires_on}T00:00:00Z`) - new Date(`${today()}T00:00:00Z`)) / 86400000));
    const when = days === 0 ? "aujourd'hui" : days === 1 ? "demain" : `dans ${days} jours`;
    const day = longDay(r.day);
    const title = `Ton option du ${day} expire ${when}`;
    const para = `Sans action de ta part, le ${day} redeviendra libre dans ton agenda.`;
    const link = `${origin}/pro/disponibilites`;
    const out = await optedOut(admin, r.emails, "vendor_account");
    for (const to of r.emails.map((e) => e.toLowerCase()).filter((e) => !out.has(e))) {
      sent += await deliver(admin, `option:${r.date_id}:${r.expires_on}:${to}`, compose({
        to,
        subject: title,
        preheader: para,
        text: `${title}.\n\n${para}\n\nVoir mes disponibilités : ${link}`,
        label: "option bientôt expirée",
        title: `${title}.`,
        card: r.names ? { name: displayName(r.names), sub: `Option posée sur le ${day}` } : null,
        paras: [para],
        cta: { label: "Voir mes disponibilités", href: link },
        why: "Tu reçois ce mail car tu as posé cette option sur Merry.",
        link: { label: "Gérer mes notifications", href: `${origin}/pro/compte` },
      }));
    }
  }
  return sent;
}

async function credits(admin, origin) {
  let sent = 0;
  const month = today().slice(0, 7);
  for (const r of await rowsOf(admin, "merry_job_credits")) {
    const title = r.credits > 0 ? `Il te reste ${r.credits} crédit${r.credits > 1 ? "s" : ""}` : "Tu n'as plus de crédits";
    const para = `Répondre à une demande coûte ${r.cost} crédits pour ton métier. Écris-nous à bonjour@withmerry.com pour en obtenir.`;
    const link = `${origin}/pro/credits`;
    const out = await optedOut(admin, r.emails, "vendor_account");
    for (const to of r.emails.map((e) => e.toLowerCase()).filter((e) => !out.has(e))) {
      sent += await deliver(admin, `credits:${r.vendor_id}:${month}:${to}`, compose({
        to,
        subject: title,
        preheader: para,
        text: `${title}.\n\n${para}\n\nVoir mes crédits : ${link}`,
        label: "crédits faibles",
        title: `${title}.`,
        paras: [para],
        cta: { label: "Voir mes crédits", href: link },
        why: "Tu reçois ce mail car ton solde de crédits est bas.",
        link: { label: "Gérer mes notifications", href: `${origin}/pro/compte` },
      }));
    }
  }
  return sent;
}

async function invitations(admin, origin) {
  let sent = 0;
  for (const r of await rowsOf(admin, "merry_job_invitations")) {
    const couple = coupleOf(r.partner1, r.partner2);
    if (!couple) continue;
    const to = String(r.email).trim().toLowerCase();
    const title = `${couple} ${plural(r.partner1, r.partner2) ? "t'attendent" : "t'attend"} sur Merry`;
    const para = "Ton invitation à rejoindre l'équipe qui organise leur mariage est toujours valable.";
    const link = `${origin}/connexion?invitation=${r.invite_token}`;
    sent += await deliver(admin, `invitation:${r.member_id}`, compose({
      to,
      subject: title,
      preheader: para,
      text: `${title}.\n\n${para}\n\n${link}`,
      label: "relance invitation",
      fromName: couple,
      title: `${title}.`,
      card: { name: couple, sub: plural(r.partner1, r.partner2) ? "T'invitent à organiser avec eux" : "T'invite à organiser son mariage" },
      paras: [para],
      cta: { label: "Rejoindre Merry", href: link },
      why: "Tu reçois ce mail car on t'a invité à rejoindre ce mariage sur Merry.",
    }));
  }
  return sent;
}

export async function runMailJobs(admin, origin) {
  const report = {};
  const steps = { demandes, demandesCouple, options, credits, invitations };
  // Avant les mails : une option expirée ne doit plus apparaître, ni être annoncée
  try {
    const { data, error } = await admin.rpc("merry_job_release_options");
    if (error) throw new Error(error.message);
    report.options_liberees = data;
  } catch (e) {
    console.error("[merry] libération des options", e?.message || e);
    report.options_liberees = "erreur";
  }
  for (const [name, step] of Object.entries(steps)) {
    try {
      report[name] = await step(admin, origin);
    } catch (e) {
      console.error(`[merry] relances ${name}`, e?.message || e);
      report[name] = "erreur";
    }
  }
  return report;
}

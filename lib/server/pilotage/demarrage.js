// Couples › Funnel du pilotage (D-289) : les mails de démarrage prévus pour un couple et ceux déjà partis, puis les
// retraits (couple sorti de la séquence, mail retiré) que la tâche de 20 h relit avant chaque envoi. Le planning
// rejoue les règles de lib/server/demarrageJob.js en supposant que rien ne bouge d'ici là.

import { greetingName } from "@/lib/server/activiteJob";
import {
  OPTOUT_KIND,
  RETIRABLES,
  RETRAITS,
  TOUT,
  WEDDING_COLS,
  chargerMariages,
  composer,
  countGuests,
  etatPour,
  planSteps,
  premierEnvoi,
  sentSteps,
  soirsAVenir,
} from "@/lib/server/demarrageJob";
import { TITRES } from "@/lib/server/demarrageMail";
import { optedOut } from "@/lib/server/mailOptouts";

async function select(query, what) {
  const { data, error } = await query;
  if (error) throw new Error(`${what} : ${error.message}`);
  return data || [];
}

// Retraits de tous les mariages, pour les interrupteurs du tableau : { [mariage]: ["tout", "equipe", …] }
export async function lireRetraits(admin) {
  const out = {};
  for (const r of await select(admin.from(RETRAITS).select("wedding_id, etape"), RETRAITS)) (out[r.wedding_id] ||= []).push(r.etape);
  return out;
}

export const etapeValide = (etape) => etape === TOUT || RETIRABLES.includes(etape);

export async function changerRetrait(admin, weddingId, etape, retire, par) {
  const query = retire
    ? admin.from(RETRAITS).upsert({ wedding_id: weddingId, etape, par }, { onConflict: "wedding_id,etape", ignoreDuplicates: true })
    : admin.from(RETRAITS).delete().eq("wedding_id", weddingId).eq("etape", etape);
  const { error } = await query;
  if (error) throw new Error(`${RETRAITS} : ${error.message}`);
}

const LIBELLES = {
  activite: () => "Mail de 20 h",
  formulaire: () => "Réponses au formulaire",
  nouveautes: (numero) => `Du nouveau sur Merry, n° ${numero}`,
  demarrage: (etape) => TITRES[etape] || etape,
};

// Mails déjà partis vers ce couple, lus dans mail_sent : clés type:…:mariage:adresse (mail de 20 h, réponses au
// formulaire, démarrage) ou nouveautes:numéro:adresse (mail du samedi). Les plus récents d'abord.
export function historique(rows, nomDe) {
  return rows
    .map((r) => {
      const parts = r.key.split(":");
      const libelle = LIBELLES[parts[0]] ? LIBELLES[parts[0]](parts[1]) : parts[0];
      return { libelle, at: r.sent_at, a: nomDe(parts[parts.length - 1]) };
    })
    .sort((a, b) => (a.at < b.at ? 1 : -1));
}

async function envoisDe(admin, weddingId, emails) {
  const lots = await Promise.all([
    select(admin.from("mail_sent").select("key, sent_at").like("key", `%:${weddingId}:%`), "mail_sent"),
    ...emails.map((e) => select(admin.from("mail_sent").select("key, sent_at").like("key", `nouveautes:%:${e}`), "mail_sent")),
  ]);
  const vus = new Set();
  return lots.flat().filter((r) => !vus.has(r.key) && vus.add(r.key));
}

// Planning d'un couple : mails à venir (un par soir et par étape, avec les prénoms et le mail tel qu'il partira),
// mails retirés, mails déjà partis. null si le mariage n'existe pas.
export async function apercuCouple(admin, weddingId, origin, now = new Date(), env = process.env) {
  const weddings = await select(admin.from("weddings").select(WEDDING_COLS).eq("id", weddingId), "weddings");
  if (!weddings.length) return null;
  const [lot] = await chargerMariages(admin, weddings, env);
  const { wedding, recipients, retires } = lot;
  const nom = (r) => greetingName(r.member.display_name) || r.to;
  const nomDe = (to) => {
    const r = recipients.find((x) => x.to === to);
    return r ? nom(r) : to;
  };
  const base = {
    couple: [wedding.partner1, wedding.partner2].filter(Boolean).join(" et ") || "Sans nom",
    test: lot.test,
    sorti: retires.includes(TOUT),
    retires: RETIRABLES.filter((e) => retires.includes(e)).map((etape) => ({ etape, titre: TITRES[etape] })),
    envoyes: historique(await envoisDe(admin, wedding.id, recipients.map((r) => r.to)), nomDe),
    a_venir: [],
    desinscrits: [],
  };
  if (lot.test || base.sorti || !recipients.length) return base;

  const out = await optedOut(admin, recipients.map((r) => r.to), OPTOUT_KIND);
  const guestCount = await countGuests(admin, wedding.id);
  const soirs = soirsAVenir(now, wedding.created_at, await premierEnvoi(admin));
  const prevus = new Map();
  for (const r of recipients) {
    if (out.has(r.to)) continue;
    const state = etatPour(lot, r.member, guestCount);
    for (const { etape, soir } of planSteps(await sentSteps(admin, wedding.id, r.to), state.pending, state.nothingMoved, retires, soirs)) {
      const cle = `${soir.toISOString()}|${etape}`;
      if (!prevus.has(cle)) {
        const { mail } = composer(etape, lot, r.member, state, guestCount, { origin, to: r.to, now: soir, env });
        prevus.set(cle, { etape, titre: TITRES[etape], objet: mail.subject, soir: soir.toISOString(), a: [], html: mail.html });
      }
      prevus.get(cle).a.push(nom(r));
    }
  }
  base.a_venir = [...prevus.values()].sort((a, b) => (a.soir < b.soir ? -1 : 1));
  base.desinscrits = recipients.filter((r) => out.has(r.to)).map(nom);
  return base;
}

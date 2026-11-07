// Page Campagnes emails du pilotage : ce que chaque envoi de campagne a donné. Les événements viennent du webhook
// Resend (mail_events), qui couvre tout l'historique, contrairement à l'API limitée aux 100 derniers envois. Les
// chiffres se lisent par cohorte : les mails partis sur la période, avec leurs ouvertures et clics, même plus tardifs.

import { heureDepart, KIND } from "@/lib/server/nouveautes";
import { NOUVEAUTES, SUBJECT } from "@/lib/server/nouveautesMail";
import { sendsByDay, summarizeEvents } from "./resend";

const HEURE = 3600000;
const JOUR = 24 * HEURE;
const DOULEURS = {
  "email.bounced": "Rebond",
  "email.complained": "Plainte",
  "email.failed": "Échec",
  "email.suppressed": "Adresse bloquée",
};

const ms = (iso) => Date.parse(iso);
const stats = (s) => ({ envoyes: s.envoyes, delivres: s.delivres, ouverts: s.ouverts, cliques: s.cliques, echecs: s.rebonds + s.plaintes + s.echecs });

// Le mail porte le même objet pour tous les numéros et pour les tests : un mail appartient au numéro dont il suit
// le départ d'une heure au plus. Un test parti dans cette heure compterait, les autres sont écartés.
function fenetre(issue, reserves) {
  const heures = reserves.filter((r) => r.key.startsWith(`${KIND}:${issue.numero}:`)).map((r) => ms(r.sent_at));
  if (!heures.length) return { debut: null, fin: null, prevus: 0 };
  const debut = Math.max(heureDepart(issue), Math.min(...heures));
  return { debut, fin: Math.max(debut, ...heures) + HEURE, prevus: heures.length };
}

function statut({ debut }, envoyes, now) {
  if (envoyes) return "Parti";
  if (debut === null) return "À envoyer";
  return debut > now ? "Programmé" : "Sans retour";
}

export function buildCampagnes({ issues = NOUVEAUTES, events, reserves, optouts, days, now = Date.now() }) {
  const premier = new Map();
  for (const e of events) {
    const t = ms(e.occurred_at);
    if (!premier.has(e.email_id) || t < premier.get(e.email_id)) premier.set(e.email_id, t);
  }
  const lignes = issues.map((issue) => ({ issue, ...fenetre(issue, reserves) }));
  const numeroDe = new Map();
  for (const [id, t] of premier) {
    const hit = lignes.find((l) => l.debut !== null && t >= l.debut - 60000 && t < l.fin);
    if (hit) numeroDe.set(id, hit.issue.numero);
  }
  const campagne = events.filter((e) => numeroDe.has(e.email_id));
  const envoisDe = (from, to) => campagne.filter((e) => premier.get(e.email_id) >= from && premier.get(e.email_id) < to);
  const desinscritsDe = (from, to) => optouts.filter((o) => ms(o.created_at) >= from && ms(o.created_at) < to).length;

  const debuts = lignes.map((l) => l.debut).filter((t) => t !== null);
  const numeros = lignes.map(({ issue, debut, prevus }) => {
    const s = summarizeEvents(campagne.filter((e) => numeroDe.get(e.email_id) === issue.numero));
    const suivant = Math.min(...debuts.filter((t) => t > debut), Infinity);
    return {
      numero: issue.numero,
      titre: issue.titre.join(" "),
      samedi: issue.samedi,
      statut: statut({ debut }, s.envoyes, now),
      prevus,
      ...stats(s),
      desinscrits: debut === null ? null : desinscritsDe(debut, suivant),
    };
  });

  const debut = now - days * JOUR;
  const periode = envoisDe(debut, now + 1);
  const avant = envoisDe(debut - days * JOUR, debut);
  const parMail = [...new Set(campagne.map((e) => e.email_id))].map((id) => ({ quand: new Date(premier.get(id)).toISOString() }));
  const liens = new Map();
  for (const e of periode) {
    if (e.type !== "email.clicked" || !e.link) continue;
    const lien = e.link.split("?")[0].replace(/^https?:\/\/[^/]+/, "") || "/";
    liens.set(lien, (liens.get(lien) || 0) + 1);
  }
  return {
    disponible: true,
    // Resend ne signale aucune ouverture tant que le suivi n'est pas activé sur le domaine (Domains > Open and click tracking)
    ouvertures_suivies: events.some((e) => e.type === "email.opened"),
    periode: { ...stats(summarizeEvents(periode)), desinscrits: desinscritsDe(debut, now + 1) },
    precedente: { ...stats(summarizeEvents(avant)), desinscrits: desinscritsDe(debut - days * JOUR, debut) },
    par_jour: sendsByDay(parMail),
    problemes: periode
      .filter((e) => DOULEURS[e.type])
      .map((e) => ({ quand: e.occurred_at, numero: numeroDe.get(e.email_id), a: e.to_email, etat: DOULEURS[e.type], detail: e.bounce_type }))
      .slice(0, 20),
    liens: [...liens.entries()].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n),
    numeros: numeros.reverse(),
  };
}

export async function readCampagnes(admin, days) {
  if (!admin) return { disponible: false, raison: "base non lue" };
  const [events, reserves, optouts] = await Promise.all([
    admin.from("mail_events").select("email_id,type,to_email,link,bounce_type,occurred_at").eq("subject", SUBJECT).limit(20000),
    admin.from("mail_sent").select("key,sent_at").like("key", `${KIND}:%`).limit(20000),
    admin.from("mail_optouts").select("created_at").eq("kind", KIND).limit(20000),
  ]);
  const failed = events.error || reserves.error || optouts.error;
  if (failed) return { disponible: false, raison: failed.message };
  return buildCampagnes({ events: events.data || [], reserves: reserves.data || [], optouts: optouts.data || [], days });
}

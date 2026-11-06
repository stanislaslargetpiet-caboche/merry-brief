// Bloc « Meetings avec l'extérieur » : ne garde des événements Google Agenda du jour que ceux qui ont un autre
// invité, et n'en retient que l'heure et les personnes. Fonctions pures, testées (tests/pilotageAgenda.test.js).

import { parisDay } from "@/lib/server/pilotage/reseau";

// Rouge dans l'agenda de Stan : le perso (déjeuner, médecin, sortie), même avec un invité
const COULEUR_PERSO = "11";
const MAX_NOMS = 3;

const capitale = (mot) => `${mot.charAt(0).toUpperCase()}${mot.slice(1)}`;

// Le nom affiché, sinon le début de l'adresse : « lucas.berger@spark.do » donne « Lucas Berger »
export function nomInvite({ displayName, email = "" }) {
  if (displayName) return displayName;
  const debut = email.split("@")[0].replace(/\d+$/, "");
  return debut.split(/[._-]+/).filter(Boolean).map(capitale).join(" ") || email;
}

// « 10 h », « 16 h 30 »
function heureParis(iso) {
  const [h, m] = new Date(iso).toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }).split(":");
  return `${Number(h)} h${m === "00" ? "" : ` ${m}`}`;
}

export function meetingsExterieurs(events = [], today, moi = "") {
  const lignes = [];
  for (const e of events) {
    const debut = e.start?.dateTime;
    if (!debut || e.status === "cancelled" || e.colorId === COULEUR_PERSO || parisDay(Date.parse(debut)) !== today) continue;
    const invites = e.attendees || [];
    const estMoi = (a) => a.self || (moi && a.email?.toLowerCase() === moi.toLowerCase());
    if (invites.some((a) => estMoi(a) && a.responseStatus === "declined")) continue;
    const autres = invites.filter((a) => !estMoi(a) && !a.resource);
    if (!autres.length) continue;
    const noms = autres.slice(0, MAX_NOMS).map(nomInvite);
    if (autres.length > MAX_NOMS) noms.push(`+${autres.length - MAX_NOMS}`);
    lignes.push({ id: e.id, debut, heure: heureParis(debut), personnes: noms.join(", ") });
  }
  return lignes.sort((a, b) => Date.parse(a.debut) - Date.parse(b.debut)).map(({ debut, ...ligne }) => ligne);
}

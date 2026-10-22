// Les grandes dates du mariage : fiançailles, mairie, dîner de la veille, cérémonie et fête,
// brunch du lendemain, fête entre amis. Chacune est un moment (events) avec une date et une
// nature (kind) ; les tâches type qui en découlent sont ajoutées au rétroplanning.

import { addDays, isoDate, normalize, toDate, today } from "./format";

export const KEY_DATES = [
  { kind: "fiancailles", label: "Fête de fiançailles", short: "Fiançailles", hint: "Avant le mariage, souvent plusieurs mois avant", icon: "alliances", offset: null },
  { kind: "civil", label: "Mariage civil", short: "Civil", hint: "À la mairie, le même jour ou quelques jours avant", icon: "mairie", offset: 0 },
  { kind: "veille", label: "Dîner de la veille", short: "Veille", hint: "Un dîner avec les proches, la veille", icon: "traiteur", offset: -1 },
  { kind: "ceremonie", label: "Cérémonie et fête", short: "Le jour J", hint: "Le grand jour", icon: "cloche", offset: 0, fixed: true },
  { kind: "brunch", label: "Brunch du lendemain", short: "Brunch", hint: "Pour prolonger avec ceux qui restent", icon: "traiteur", offset: 1 },
  { kind: "fete", label: "Fête entre amis", short: "Fête", hint: "Une soirée à part, avant ou après", icon: "musique", offset: null },
];

// Reconnaît la nature d'un moment existant à son nom (moments créés avant les grandes dates)
export function guessKind(ev) {
  if (ev.kind) return ev.kind;
  const n = normalize(ev.name);
  if (/civil|mairie/.test(n)) return "civil";
  if (/fiancaille/.test(n)) return "fiancailles";
  if (/veille/.test(n)) return "veille";
  if (/brunch|lendemain/.test(n)) return "brunch";
  if (/cocktail|vin d honneur/.test(n)) return "cocktail";
  if (/diner|soiree|repas/.test(n)) return "diner";
  if (/ceremonie|eglise|laique|messe/.test(n)) return "ceremonie";
  if (/fete|amis|copains|soiree/.test(n)) return "fete";
  return null;
}

export function eventOfKind(events, kind) {
  return events.find((e) => guessKind(e) === kind) || null;
}

// Date effective d'un moment : la sienne, sinon celle du mariage décalée (veille, brunch…)
export function eventDate(ev, wedding) {
  if (ev.event_date) return ev.event_date;
  const def = KEY_DATES.find((k) => k.kind === guessKind(ev));
  if (!def || def.offset === null || !wedding?.wedding_date) return null;
  return isoDate(addDays(wedding.wedding_date, def.offset));
}

// Les grandes dates à épingler sur la frise : moments datés + le jour J
export function keyDates(data) {
  const out = [];
  const { events, wedding } = data;
  if (wedding?.wedding_date) out.push({ key: "jourj", kind: "ceremonie", label: "Le jour J", date: wedding.wedding_date, main: true });
  for (const ev of events) {
    const kind = guessKind(ev);
    const date = eventDate(ev, wedding);
    if (!date) continue;
    if (date === wedding?.wedding_date && (kind === "cocktail" || kind === "diner" || kind === "ceremonie")) continue;
    const def = KEY_DATES.find((k) => k.kind === kind);
    out.push({ key: ev.id, kind, label: def ? def.short : ev.short_name || ev.name, full: ev.name, date });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// Tâches type ajoutées quand une grande date est choisie (jours avant la date du moment)
export const KEY_TASKS = {
  fiancailles: [
    ["Choisir le lieu des fiançailles", "lieu", -75, /fiancaille.*lieu|lieu.*fiancaille/],
    ["Inviter pour les fiançailles", "enveloppe", -45, /invit.*fiancaille|fiancaille.*invit/],
    ["Préparer la fête de fiançailles (repas, musique)", "musique", -14, /prepar.*fiancaille/],
  ],
  civil: [
    ["Choisir les témoins du mariage civil", "users", -120, /temoin/],
    ["Déposer le dossier de mariage à la mairie", "mairie", -90, /dossier.*mairie|mairie.*dossier/],
    ["Vérifier la publication des bans", "mairie", -30, /bans/],
    ["Prévoir la tenue et les alliances pour la mairie", "tenues", -21, /tenue.*mairie|mairie.*tenue/],
  ],
  veille: [
    ["Réserver le lieu du dîner de la veille", "lieu", -150, /reserv.*veille|veille.*reserv/],
    ["Fixer le menu du dîner de la veille", "traiteur", -45, /menu.*veille|veille.*menu/],
    ["Confirmer les invités du dîner de la veille", "users", -14, /confirm.*veille|veille.*confirm/],
  ],
  brunch: [
    ["Organiser le brunch du lendemain (lieu, traiteur)", "traiteur", -120, /reserv.*brunch|organis.*brunch|brunch.*(reserv|organis)/],
    ["Confirmer le nombre d'invités au brunch", "users", -14, /confirm.*brunch|brunch.*confirm/],
  ],
  fete: [
    ["Choisir le lieu de la fête entre amis", "lieu", -60, /lieu.*fete|fete.*lieu/],
    ["Envoyer les invitations de la fête entre amis", "enveloppe", -30, /invit.*fete|fete.*invit/],
  ],
};

// Les tâches type d'une grande date, sauf celles qu'une tâche existante couvre déjà
export function tasksForKind(kind, date, existingTitles, assignees = []) {
  const have = existingTitles.map((t) => normalize(t));
  return (KEY_TASKS[kind] || [])
    .filter(([title, , , skip]) => !have.some((h) => h === normalize(title) || (skip && skip.test(h))))
    .map(([title, icon, days]) => ({ title, icon, due_date: isoDate(addDays(date, days)), done: false, assignees, added_by_merry: true }));
}

export function monthTimeline(data) {
  const { tasks, wedding } = data;
  const pins = keyDates(data);
  const dates = [...tasks.map((t) => t.due_date), ...pins.map((p) => p.date), wedding?.wedding_date, isoDate(today())].filter(Boolean).map((d) => toDate(d));
  if (!dates.length) return [];
  const start = new Date(Math.min(today().getTime(), ...dates.map((d) => d.getTime())));
  const end = new Date(Math.max(...dates.map((d) => d.getTime())));
  const months = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  const nowKey = `${today().getFullYear()}-${String(today().getMonth() + 1).padStart(2, "0")}`;
  while (cur <= last && months.length < 36) {
    const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`;
    const inMonth = tasks.filter((t) => t.due_date && String(t.due_date).slice(0, 7) === key);
    months.push({
      key,
      label: cur.toLocaleDateString("fr-FR", { month: "short" }).replace(".", ""),
      year: cur.getFullYear(),
      total: inMonth.length,
      done: inMonth.filter((t) => t.done).length,
      late: inMonth.filter((t) => !t.done && toDate(t.due_date) < today()).length,
      now: key === nowKey,
      pins: pins.filter((p) => p.date.slice(0, 7) === key),
    });
    cur.setMonth(cur.getMonth() + 1);
  }
  return months;
}

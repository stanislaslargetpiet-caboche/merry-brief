// Quand la date du mariage change, ce qui était calé dessus la suit : les tâches ajoutées par Merry
// (pas encore faites) et les moments qui étaient à leur date par défaut (veille, brunch…).
// Les tâches écrites à la main et les dates choisies à la main ne bougent pas.

import { addDays, daysBetween, isoDate, normalize } from "./format";
import { KEY_DATES, guessKind } from "./dates";
import { dueFromDays, templateDays } from "./retro";

// from : ancienne date (ou null), to : nouvelle. Renvoie null s'il n'y a rien à faire bouger.
export function shiftPlan(data, from, to, { events = true } = {}) {
  if (!to || from === to) return null;
  const mine = data.tasks.filter((t) => t.added_by_merry && !t.done);

  if (!from) {
    // Première date : on date les tâches type créées avant que la date soit connue
    const days = templateDays();
    const tasks = [];
    mine
      .filter((t) => !t.due_date && days.has(normalize(t.title)))
      .forEach((t, i) => tasks.push({ id: t.id, due_date: dueFromDays(days.get(normalize(t.title)), to, i) }));
    return tasks.length ? { mode: "date", tasks, events: [] } : null;
  }

  const days = daysBetween(from, to);
  const tasks = mine.filter((t) => t.due_date).map((t) => ({ id: t.id, due_date: isoDate(addDays(t.due_date, days)) }));
  const moved = [];
  if (events) {
    for (const ev of data.events) {
      const def = KEY_DATES.find((k) => k.kind === guessKind(ev));
      if (def && def.offset !== null && ev.event_date && ev.event_date === isoDate(addDays(from, def.offset))) moved.push({ id: ev.id, event_date: isoDate(addDays(to, def.offset)) });
    }
  }
  return tasks.length || moved.length ? { mode: "shift", days, tasks, events: moved } : null;
}

export async function applyShift(dash, plan) {
  await Promise.all([...plan.tasks.map((t) => dash.update("tasks", t.id, { due_date: t.due_date })), ...plan.events.map((e) => dash.update("events", e.id, { event_date: e.event_date }))]);
}

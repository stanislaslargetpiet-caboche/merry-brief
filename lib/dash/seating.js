// Plan de table : qui s'assoit où, pour un moment du mariage. Les tables ont un nom et un nombre de
// places ; les foyers restent ensemble quand c'est possible.

import { normalize } from "./format";
import { householdKey } from "./households";

export const DEFAULT_CAPACITY = 8;

// Le moment du plan par défaut : le dîner, sinon le dernier moment
export function defaultSeatingEvent(events) {
  const n = (e) => normalize(e.name);
  return events.find((e) => n(e) === "diner") || events.find((e) => /diner/.test(n(e)) && !/veille/.test(n(e))) || events.find((e) => /dejeuner|repas|banquet/.test(n(e))) || events[events.length - 1] || null;
}

export function planFor(data, eventId) {
  const tables = (data.tables || []).filter((t) => t.event_id === eventId).sort((a, b) => a.position - b.position);
  const seats = (data.seating || []).filter((s) => s.event_id === eventId);
  const tableOf = new Map(seats.map((s) => [s.guest_id, s.table_id]));
  const perTable = new Map(tables.map((t) => [t.id, []]));
  const byId = new Map(data.guests.map((g) => [g.id, g]));
  for (const s of [...seats].sort((a, b) => a.position - b.position)) {
    const g = byId.get(s.guest_id);
    if (g && perTable.has(s.table_id)) perTable.get(s.table_id).push(g);
  }
  return { tables, tableOf, perTable };
}

// Ceux qui viennent à ce moment
export function eligibleGuests(data, idx, eventId) {
  return data.guests.filter((g) => (idx.get(g.id) || {})[eventId] === "oui");
}

// Foyers séparés sur plusieurs tables : clé de foyer → ensemble des tables
export function splitHouseholds(guests, tableOf, byId) {
  const map = new Map();
  for (const g of guests) {
    const t = tableOf.get(g.id);
    if (!t) continue;
    const k = householdKey(g, byId);
    if (!map.has(k)) map.set(k, new Set());
    map.get(k).add(t);
  }
  const split = new Set();
  for (const [k, set] of map) if (set.size > 1) split.add(k);
  return split;
}

// Placement automatique : les foyers d'abord (ensemble), puis par groupe, dans les tables qui ont
// encore de la place. Un foyer plus grand que la place restante va à la table suivante qui peut
// l'accueillir ; sinon il est séparé. Retourne [{ guest_id, table_id }] pour ceux pas encore placés.
export function autoSeat(unseated, tables, perTable, byId, groupOrder) {
  const room = new Map(tables.map((t) => [t.id, Math.max(0, (t.capacity || DEFAULT_CAPACITY) - (perTable.get(t.id) || []).length)]));
  // Unités : un foyer (ou une personne seule), gardées par groupe pour asseoir les proches ensemble
  const units = new Map();
  for (const g of unseated) {
    const k = householdKey(g, byId);
    if (!units.has(k)) units.set(k, []);
    units.get(k).push(g);
  }
  const rank = (g) => groupOrder.indexOf(g.group_id);
  const list = [...units.values()].sort((a, b) => rank(a[0]) - rank(b[0]) || b.length - a.length);
  const out = [];
  let cursor = 0;
  for (const unit of list) {
    const order = tables.slice(cursor).concat(tables.slice(0, cursor));
    let target = order.find((t) => room.get(t.id) >= unit.length);
    if (target) {
      cursor = tables.indexOf(target);
      for (const g of unit) out.push({ guest_id: g.id, table_id: target.id });
      room.set(target.id, room.get(target.id) - unit.length);
      if (room.get(target.id) === 0) cursor = (cursor + 1) % Math.max(1, tables.length);
    } else {
      // Pas de table assez grande : on sépare, dans l'ordre des tables
      for (const g of unit) {
        const t = tables.find((x) => room.get(x.id) > 0);
        if (!t) break;
        out.push({ guest_id: g.id, table_id: t.id });
        room.set(t.id, room.get(t.id) - 1);
      }
    }
  }
  return out;
}

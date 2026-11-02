// Foyers : un faire-part, une adresse, une enveloppe. Les membres d'un foyer partagent guests.household_id ;
// un accompagnant sans foyer suit la personne qu'il accompagne. Le nom du foyer se déduit des membres.

import { fullName, normalize } from "./format";

// Clé de foyer d'un invité : son foyer, sinon celui de son hôte, sinon lui seul
export function householdKey(g, byId) {
  if (g.household_id) return g.household_id;
  const host = g.plus_one_of ? byId.get(g.plus_one_of) : null;
  if (host) return host.household_id || host.id;
  return g.id;
}

// Map clé → membres (dans l'ordre de la liste)
export function householdsOf(guests, byId) {
  const map = new Map();
  for (const g of guests) {
    const k = householdKey(g, byId);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(g);
  }
  return map;
}

// « Claire & Pierre Morel », « Famille Morel (4) », « Claire Morel & Jean Petit », « Claire Morel + 1 »
export function householdLabel(members) {
  const named = members.filter((m) => fullName(m));
  if (!named.length) return "Foyer sans nom";
  const unnamed = members.length - named.length;
  const lastNames = [...new Set(named.map((m) => normalize(m.last_name || "")).filter(Boolean))];
  let label;
  if (named.length === 1) label = fullName(named[0]);
  else if (lastNames.length === 1 && named.every((m) => m.last_name)) {
    const last = named[0].last_name.trim();
    const firsts = named.map((m) => (m.first_name || "").trim()).filter(Boolean);
    label = named.length <= 2 && firsts.length === named.length ? `${firsts.join(" & ")} ${last}` : `Famille ${last} (${members.length})`;
  } else label = named.length <= 2 ? named.map(fullName).join(" & ") : `${fullName(named[0])} et ${members.length - 1} autres`;
  return unnamed && named.length <= 2 && !/^Famille/.test(label) ? `${label} + ${unnamed}` : label;
}

// L'adresse du foyer : la première renseignée parmi ses membres
export function householdAddress(members) {
  return members.map((m) => (m.address || "").trim()).find(Boolean) || "";
}

// Propositions de foyers, prudentes : on ne propose que ce qui est presque sûr.
// - un invité et ses accompagnants (« C Binachon + 1 ») ;
// - des invités du même nom de famille, du même groupe, à la même adresse renseignée ;
// - sans adresse : seulement un petit nombre (4 au plus) du même nom et du même groupe (un couple,
//   une famille) ; dix-neuf « Dormeuil » sans adresse ne sont pas un foyer.
export function suggestHouseholds(guests, byId) {
  const withPlus = (g) => [g, ...guests.filter((x) => x.plus_one_of === g.id && !x.household_id)];
  const buckets = new Map();
  const out = [];
  for (const g of guests) {
    if (g.plus_one_of || g.household_id) continue;
    const last = normalize(g.last_name || "");
    if (!last) {
      const m = withPlus(g);
      if (m.length >= 2) out.push(m);
      continue;
    }
    const k = `${last}|${g.group_id || ""}`;
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(g);
  }
  for (const list of buckets.values()) {
    const withAddr = new Map();
    const noAddr = [];
    for (const g of list) {
      const a = normalize(g.address || "").replace(/\s+/g, " ");
      if (a) {
        if (!withAddr.has(a)) withAddr.set(a, []);
        withAddr.get(a).push(g);
      } else noAddr.push(g);
    }
    for (const c of withAddr.values()) {
      const members = c.flatMap(withPlus);
      if (members.length >= 2) out.push(members);
    }
    const loose = noAddr.flatMap(withPlus);
    if (noAddr.length >= 2 && loose.length <= 4) out.push(loose);
    else for (const g of noAddr) {
      const m = withPlus(g);
      if (m.length >= 2) out.push(m);
    }
  }
  return out;
}

export function householdStats(guests, byId) {
  const map = householdsOf(guests, byId);
  let multi = 0;
  for (const members of map.values()) if (members.length > 1) multi += 1;
  return { total: map.size, multi, single: map.size - multi };
}

// Règle de répartition des dépenses entre organisateurs, choisie par le couple (Budget > Répartition > Règle).
// Trois façons : en pourcentage, en montant fixe, ou par poste (« je prends tout le traiteur »).
// Enregistrée dans weddings.layouts.partage, commune aux organisateurs :
// { mode: "pct" | "fixe" | "poste", shares: { id: % }, fixed: { id: € }, postes: { cléDuPoste: id | "partage" } }

import { groupItems } from "./model";

export const MODES = [
  { key: "pct", label: "En pourcentage" },
  { key: "fixe", label: "Montant fixe" },
  { key: "poste", label: "Par poste" },
];

export function ruleOf(data) {
  const r = data.wedding.layouts?.partage || {};
  return { mode: MODES.some((m) => m.key === r.mode) ? r.mode : "pct", shares: r.shares || null, fixed: r.fixed || {}, postes: r.postes || {} };
}

// Part égale entre ceux qui ont déjà payé (tout le monde si personne n'a payé), en pourcentages entiers
export function defaultShares(byPayer) {
  const payers = byPayer.filter((x) => x.amount > 0);
  const list = payers.length ? payers : byPayer;
  const out = Object.fromEntries(byPayer.map((x) => [x.member.id, 0]));
  list.forEach((x, i) => (out[x.member.id] = Math.floor(100 / list.length) + (i < 100 % list.length ? 1 : 0)));
  return out;
}

export function sharesOf(rule, byPayer) {
  if (!rule.shares || !Object.keys(rule.shares).length) return defaultShares(byPayer);
  return Object.fromEntries(byPayer.map((x) => [x.member.id, Math.round(rule.shares[x.member.id] || 0)]));
}

// Un curseur bouge : les autres se partagent le reste à proportion de leurs parts (à parts égales s'ils sont tous à 0)
export function rebalance(shares, ids, id, value) {
  const others = ids.filter((x) => x !== id);
  const left = 100 - value;
  const sum = others.reduce((a, x) => a + (shares[x] || 0), 0);
  const out = { ...shares, [id]: value };
  let given = 0;
  others.forEach((x, i) => {
    const v = i === others.length - 1 ? left - given : Math.round(sum ? ((shares[x] || 0) * left) / sum : left / others.length);
    out[x] = Math.max(0, v);
    given += out[x];
  });
  return out;
}

// Postes où l'on a déjà payé quelque chose : { key, name, icon, paid }
export function paidPostes(data) {
  const paidOf = (it) => data.payments.filter((p) => p.paid_at && p.budget_item_id === it.id).reduce((a, p) => a + Number(p.amount || 0), 0);
  return groupItems(data.items)
    .map((g) => ({ key: g.key, name: g.name, icon: g.items[0].icon, label: g.items[0].label, paid: g.items.reduce((a, it) => a + paidOf(it), 0) }))
    .filter((g) => g.paid > 0);
}

// Ce que chacun devrait avoir payé selon la règle : { id: € }
export function targetsOf(rule, data, byPayer) {
  const total = byPayer.reduce((a, x) => a + x.amount, 0);
  const ids = byPayer.map((x) => x.member.id);
  const out = Object.fromEntries(ids.map((id) => [id, 0]));
  const payers = byPayer.filter((x) => x.amount > 0).map((x) => x.member.id);
  const split = (amount, among) => {
    const list = among.length ? among : ids;
    for (const id of list) out[id] += amount / list.length;
  };
  if (rule.mode === "fixe") {
    const set = ids.filter((id) => Number(rule.fixed[id]) > 0);
    let fixedSum = 0;
    for (const id of set) {
      out[id] += Number(rule.fixed[id]);
      fixedSum += Number(rule.fixed[id]);
    }
    const rest = total - fixedSum;
    if (rest > 0) split(rest, payers.filter((id) => !set.includes(id)).length ? payers.filter((id) => !set.includes(id)) : ids.filter((id) => !set.includes(id)));
    return out;
  }
  if (rule.mode === "poste") {
    for (const g of paidPostes(data)) {
      const who = rule.postes[g.key];
      if (who && who !== "partage" && ids.includes(who)) out[who] += g.paid;
      else split(g.paid, payers);
    }
    return out;
  }
  const shares = sharesOf(rule, byPayer);
  for (const id of ids) out[id] = (total * (shares[id] || 0)) / 100;
  return out;
}

// Virements qui remettent chacun à sa part : le plus gros débiteur paie le plus gros créancier, et ainsi de suite
export function settle(balances) {
  const debt = balances.filter((x) => x.diff < -0.5).map((x) => ({ ...x, left: -x.diff })).sort((a, z) => z.left - a.left);
  const credit = balances.filter((x) => x.diff > 0.5).map((x) => ({ ...x, left: x.diff })).sort((a, z) => z.left - a.left);
  const out = [];
  let i = 0;
  let j = 0;
  while (i < debt.length && j < credit.length) {
    const amount = Math.min(debt[i].left, credit[j].left);
    if (amount >= 1) out.push({ from: debt[i].member, to: credit[j].member, amount: Math.round(amount) });
    debt[i].left -= amount;
    credit[j].left -= amount;
    if (debt[i].left < 0.5) i++;
    if (credit[j].left < 0.5) j++;
  }
  return out;
}

// Phrase courte qui résume la règle, pour l'onglet Répartition
export function ruleSummary(rule, byPayer) {
  const name = (id) => byPayer.find((x) => x.member.id === id)?.member.display_name || "";
  if (rule.mode === "fixe") {
    const set = byPayer.filter((x) => Number(rule.fixed[x.member.id]) > 0);
    return set.length ? "Montants fixes" : "Montants fixes à définir";
  }
  if (rule.mode === "poste") {
    const n = Object.values(rule.postes).filter((v) => v && v !== "partage").length;
    return n ? `Par poste, ${n} poste${n > 1 ? "s" : ""} pris en charge` : "Par poste, tout partagé";
  }
  const shares = sharesOf(rule, byPayer);
  return byPayer.filter((x) => shares[x.member.id]).map((x) => `${name(x.member.id)} ${shares[x.member.id]} %`).join(" · ");
}

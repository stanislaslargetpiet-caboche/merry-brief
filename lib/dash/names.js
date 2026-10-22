// Les prénoms du couple vivent dans weddings.partner1 / partner2. Quelques copies en dérivent
// (organisateur du couple, « Famille de… », « Amis de… », « Parents de… », titre du formulaire) :
// quand on corrige un prénom, elles suivent, au lieu de rester sur l'ancien.

import { PASTEL_KEYS } from "./theme";
import { uid } from "./format";

const initialOf = (name) => String(name || "").trim().charAt(0).toUpperCase();
const joinNames = (a, b) => [a, b].filter(Boolean).join(" & ");

// Ce qui change quand partner1 / partner2 passent de `before` à `after` : liste de { table, id, patch }
export function renamePlan(data, before, after) {
  const plan = [];
  const pairs = [
    [before.partner1, after.partner1],
    [before.partner2, after.partner2],
  ].filter(([from, to]) => from && to && from !== to);

  for (const [from, to] of pairs) {
    for (const m of data.members) {
      if (m.role === "couple" && m.display_name === from) plan.push({ table: "wedding_members", id: m.id, patch: { display_name: to, initial: initialOf(to) } });
      if (m.role === "parents" && m.display_name === `Parents de ${from}`) plan.push({ table: "wedding_members", id: m.id, patch: { display_name: `Parents de ${to}` } });
    }
    for (const g of data.groups) {
      if (g.name === `Famille de ${from}` || g.name === `Amis de ${from}`) plan.push({ table: "guest_groups", id: g.id, patch: { name: g.name.replace(` de ${from}`, ` de ${to}`) } });
    }
  }
  return plan;
}

// Le titre du formulaire suit les prénoms tant que personne ne l'a réécrit à la main
export function formTitleAfter(form, before, after) {
  if (!form) return null;
  const oldDefault = joinNames(before.partner1, before.partner2);
  const next = joinNames(after.partner1, after.partner2);
  return (form.title || "").trim() === oldDefault && next !== oldDefault ? next : null;
}

// Applique le renommage ; ajoute aussi l'organisateur « moitié » quand le prénom est donné après coup
export async function syncNames(dash, before, after) {
  const data = dash.data;
  for (const step of renamePlan(data, before, after)) await dash.update(step.table, step.id, step.patch);

  const title = formTitleAfter(data.form, before, after);
  if (title) await dash.saveForm({ ...data.form, title });

  const couple = data.members.filter((m) => m.role === "couple");
  if (after.partner2 && !before.partner2 && couple.length < 2 && !data.members.some((m) => m.display_name === after.partner2)) {
    const used = new Set(data.members.map((m) => m.color));
    const id = uid();
    await dash.insert("wedding_members", {
      id,
      display_name: after.partner2,
      initial: initialOf(after.partner2),
      color: PASTEL_KEYS.find((k) => !used.has(k)) || "gris",
      role: "couple",
      email: null,
      position: data.members.length,
      invited_at: new Date().toISOString(),
      invite_token: uid(), // remplacé par celui de la base en mode réel
      user_id: null,
    });
    await dash.refreshMember(id);
  }
}

// Modifications de l'équipe sur la liste des invités (supabase/modifications-equipe.sql) : celles des
// 3 derniers jours faites par un autre organisateur, regroupées quand elles vont ensemble (un import,
// plusieurs réponses changées à la suite) pour que la pastille reste lisible.

// Jours couverts par la pastille (et lus au chargement du tableau de bord)
export const ACTIVITY_DAYS = 3;

// Deux changements du même organisateur, de même nature, à moins de 10 minutes d'écart : un seul élément
const BURST_MS = 10 * 60 * 1000;

const FIELD_LABEL = {
  first_name: "le prénom",
  last_name: "le nom",
  age: "l'âge",
  diet: "le régime",
  address: "l'adresse",
  email: "le mail",
  phone: "le téléphone",
  group_id: "le groupe",
  note: "la note",
};

export function teamChanges(activity, meId, now = Date.now()) {
  const since = now - ACTIVITY_DAYS * 86400000;
  const rows = (activity || [])
    .filter((a) => a.source === "organisateur" && a.member_id && a.member_id !== meId && Date.parse(a.created_at) >= since)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const items = [];
  for (const a of rows) {
    const key = `${a.member_id}|${a.kind}|${a.kind === "champ" ? a.field : ""}|${a.kind === "reponse" ? a.event_id : ""}`;
    const last = items[items.length - 1];
    const t = Date.parse(a.created_at);
    if (last && last.key === key && last.oldest - t <= BURST_MS) {
      last.entries.push(a);
      last.oldest = t;
      continue;
    }
    items.push({
      key,
      id: a.id,
      member_id: a.member_id,
      kind: a.kind,
      field: a.field,
      event_id: a.event_id,
      at: a.created_at,
      oldest: t,
      entries: [a],
    });
  }
  // Un même invité changé deux fois dans la rafale ne compte qu'une fois
  for (const it of items) {
    const seen = new Set();
    it.guests = it.entries.filter((e) => !seen.has(e.guest_id) && seen.add(e.guest_id)).map((e) => ({ id: e.guest_id, name: e.guest_name || "Sans nom" }));
  }
  return items;
}

export function fieldLabel(field, fields) {
  if (field?.startsWith("custom:")) {
    const f = (fields || []).find((x) => x.id === field.slice(7));
    return f ? `la colonne « ${f.name} »` : "une colonne";
  }
  return FIELD_LABEL[field] || "une information";
}

// « de » devant Claire, « d' » devant Inès
export function dePrefix(name) {
  return /^[aeiouyhàâéèêëîïôöûü]/i.test(name || "") ? "d'" : "de ";
}

// « Claire Dubois, Paul Henry et 2 autres »
export function namesLine(guests, max = 2) {
  const names = guests.map((g) => g.name);
  if (names.length <= max + 1) return names.length > 1 ? `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}` : names[0] || "";
  const rest = names.length - max;
  return `${names.slice(0, max).join(", ")} et ${rest} autre${rest > 1 ? "s" : ""}`;
}

// « Aujourd'hui », « Hier », « Jeudi 5 novembre »
export function dayLabel(iso, now = new Date()) {
  const d = new Date(iso);
  const start = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(now) - start(d)) / 86400000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return "Hier";
  const s = d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// « 14 h 32 »
export function timeLabel(iso) {
  const d = new Date(iso);
  return `${d.getHours()} h ${String(d.getMinutes()).padStart(2, "0")}`;
}

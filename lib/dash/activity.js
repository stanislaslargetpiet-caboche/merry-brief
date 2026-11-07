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

// Réponses au formulaire des 3 derniers jours : un envoi = un élément par invité, son accompagnant
// compris (le formulaire écrit tout en quelques secondes, d'où la même fenêtre de regroupement).
export function guestChanges(activity, guests, now = Date.now()) {
  const since = now - ACTIVITY_DAYS * 86400000;
  const plusOf = new Map((guests || []).filter((g) => g.plus_one_of).map((g) => [g.id, g.plus_one_of]));
  const rows = (activity || [])
    .filter((a) => a.source === "formulaire" && Date.parse(a.created_at) >= since)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const items = [];
  const open = new Map();
  for (const a of rows) {
    const main = plusOf.get(a.guest_id) || a.guest_id;
    const t = Date.parse(a.created_at);
    const it = open.get(main);
    if (it && it.oldest - t <= BURST_MS) {
      it.entries.push(a);
      it.oldest = t;
      continue;
    }
    const next = { key: `formulaire|${main}|${a.id}`, id: a.id, guest_id: main, at: a.created_at, oldest: t, entries: [a] };
    open.set(main, next);
    items.push(next);
  }
  for (const it of items) {
    const mine = it.entries.filter((e) => e.guest_id === it.guest_id);
    const plus = it.entries.filter((e) => e.guest_id !== it.guest_id);
    it.name = (mine[0] || it.entries[0]).guest_name || "Sans nom";
    it.added = mine.some((e) => e.kind === "ajout");
    // Dernière réponse par moment (les entrées vont de la plus récente à la plus ancienne)
    const answers = new Map();
    for (const e of mine) if (e.kind === "reponse" && !answers.has(e.event_id)) answers.set(e.event_id, e.new_value);
    it.answers = [...answers].map(([event_id, status]) => ({ event_id, status }));
    it.fields = [...new Set(mine.filter((e) => e.kind === "champ").map((e) => e.field))];
    it.plus = plus.length ? { id: plus[0].guest_id, name: plus.find((e) => e.guest_name)?.guest_name || "", added: plus.some((e) => e.kind === "ajout") } : null;
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

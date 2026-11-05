// Heure de Paris pour le mail de 8 h. Vercel (offre Hobby) lance ses tâches en UTC, n'importe quand dans l'heure
// indiquée : deux tâches (6 h et 7 h UTC) couvrent 8 h à Paris été comme hiver, et la route n'envoie que si l'heure
// de Paris est 8 ou 9. Une clé par jour dans mail_sent empêche tout double envoi.

export function parisParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return { year: get("year"), month: get("month"), day: get("day"), hour: Number(get("hour")) };
}

export const inBriefWindow = (hour) => hour === 8 || hour === 9;

export function briefKey(now = new Date()) {
  const p = parisParts(now);
  return `brief:${p.year}-${p.month}-${p.day}`;
}

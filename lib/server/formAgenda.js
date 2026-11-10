// « Ajouter à mon agenda » du mail de confirmation du formulaire (planches V49) : le mariage en événement
// d'une journée, à la date du formulaire (le formulaire ne connaît pas l'heure des moments). Appareils Apple :
// un fichier .ics, que Safari propose d'ajouter au Calendrier ; ailleurs : Google Agenda, prérempli.

import { displayName } from "@/lib/server/names";

export function agendaEvent(form) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(form?.wedding_date || ""));
  if (!m) return null;
  const next = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 1));
  const names = [form?.partner1, form?.partner2].map(displayName).filter(Boolean);
  return {
    start: `${m[1]}${m[2]}${m[3]}`,
    end: next.toISOString().slice(0, 10).replaceAll("-", ""),
    title: names.length ? `Mariage de ${names.join(" et ")}` : String(form?.title || "").trim() || "Mariage",
    venue: String(form?.venue || "").trim(),
  };
}

export function googleAgendaUrl(ev, details) {
  const q = new URLSearchParams({ action: "TEMPLATE", text: ev.title, dates: `${ev.start}/${ev.end}` });
  if (ev.venue) q.set("location", ev.venue);
  if (details) q.set("details", details);
  return `https://calendar.google.com/calendar/render?${q}`;
}

export const wantsIcs = (ua) => /iPhone|iPad|iPod|Macintosh/i.test(ua || "");

// RFC 5545 : virgules, points-virgules et retours à la ligne échappés, lignes repliées à 75 octets
const icsText = (s) => String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

function fold(line) {
  const bytes = (c) => new TextEncoder().encode(c).length;
  let out = "";
  let size = 0;
  for (const c of line) {
    if (size + bytes(c) > 75) {
      out += "\r\n ";
      size = 1;
    }
    out += c;
    size += bytes(c);
  }
  return out;
}

export function icsFile(ev, { uid, details, now = new Date() }) {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Merry//Formulaire invités//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${ev.start}`,
    `DTEND;VALUE=DATE:${ev.end}`,
    `SUMMARY:${icsText(ev.title)}`,
    ev.venue ? `LOCATION:${icsText(ev.venue)}` : "",
    details ? `DESCRIPTION:${icsText(details)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .map(fold)
    .join("\r\n")
    .concat("\r\n");
}

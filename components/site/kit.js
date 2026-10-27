// Petits textes partagés par les modèles du site (lignes d'adresse, trajets, témoins)

import { TRAVEL_KINDS } from "@/lib/site/model";
import { joinList } from "./parts";

export const placeLine = (m) => [m.place, m.address].filter(Boolean).join(", ");
export const placeDot = (m) => [m.place, m.address].filter(Boolean).join(" · ");

export function travelLabel(t) {
  return t.label?.trim() || TRAVEL_KINDS.find((k) => k.id === t.kind)?.label || "Autrement";
}
export function travelShort(t) {
  return t.label?.trim() || TRAVEL_KINDS.find((k) => k.id === t.kind)?.short || "Autre";
}

// « Écrivez à Léa ou à Hugo »
export function writeTo(contacts) {
  const names = contacts.map((c) => c.name).filter(Boolean);
  if (!names.length) return "";
  return `Écrivez à ${names.length > 1 ? `${names.slice(0, -1).join(", à ")} ou à ${names[names.length - 1]}` : names[0]}`;
}

// « Léa, témoin de Margue, et Hugo, témoin de Stan »
export function witnesses(contacts) {
  return joinList(contacts.filter((c) => c.name).map((c) => (c.role ? `${c.name}, ${c.role.charAt(0).toLowerCase()}${c.role.slice(1)}` : c.name)));
}

// Moment du programme au format « Vendredi 24 septembre · 16 h »
export function momentWhen(m, hourText) {
  return [m.date?.dayMonth, m.time ? hourText(m.time) : ""].filter(Boolean).join(" · ");
}

// Relancer les invités sans réponse : le lien à envoyer (formulaire, sinon site en ligne), le message
// proposé, et les liens mail / WhatsApp / SMS qui l'emportent tout prêt. Merry n'envoie rien lui-même :
// chaque bouton ouvre l'application du couple avec le texte déjà écrit.

import { formUrl } from "./form";
import { siteUrl } from "@/lib/site/model";

// Le lien que l'invité doit ouvrir pour répondre
export function inviteLink(data) {
  if (data.form?.slug) return { kind: "form", url: formUrl(data.form.slug) };
  if (data.site?.published && data.site.slug) return { kind: "site", url: siteUrl(data.site.slug) };
  return null;
}

export function coupleNames(wedding) {
  return [wedding?.partner1, wedding?.partner2].filter(Boolean).join(" & ");
}

// Message proposé, modifiable avant l'envoi
export function reminderText(data, link) {
  const names = coupleNames(data.wedding);
  const lines = ["Bonjour !", "", "Nous n'avons pas encore votre réponse pour notre mariage. Dites-nous en deux minutes si vous serez des nôtres :", link?.url || "", "", "Merci et à très vite,", names || "Les mariés"];
  return lines.join("\n");
}

export function reminderSubject(data) {
  const names = coupleNames(data.wedding);
  return names ? `Mariage de ${names} : votre réponse` : "Notre mariage : votre réponse";
}

// Numéro en chiffres pour WhatsApp (indicatif international, sans + ni espaces) : 06 12… → 33612…
export function waDigits(phone) {
  let d = String(phone || "").replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  else if (/^0\d{9}$/.test(d)) d = `33${d.slice(1)}`;
  return /^\d{8,15}$/.test(d) ? d : "";
}

export function waHref(phone, text) {
  const d = waDigits(phone);
  return d ? `https://wa.me/${d}?text=${encodeURIComponent(text)}` : "";
}

export function smsHref(phone, text) {
  const d = String(phone || "").replace(/[^\d+]/g, "");
  return d ? `sms:${d}?&body=${encodeURIComponent(text)}` : "";
}

export function mailHref(emails, subject, text, { bcc = false } = {}) {
  const list = (Array.isArray(emails) ? emails : [emails]).filter(Boolean);
  if (!list.length) return "";
  const q = `subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
  return bcc ? `mailto:?bcc=${encodeURIComponent(list.join(","))}&${q}` : `mailto:${encodeURIComponent(list.join(","))}?${q}`;
}

// Un invité qu'on peut joindre : un mail ou un téléphone sur sa fiche
export const hasContact = (g) => Boolean(String(g?.email || "").trim() || String(g?.phone || "").trim());

// Un invité « à relancer » : en attente à au moins un moment, et joignable (sans mail ni téléphone, il n'y a
// rien à envoyer : le bouton ne s'affiche pas). Les accompagnants sans nom passent par la personne qu'ils
// accompagnent (même mail, même téléphone en général).
export function pendingGuests(guests, idx, events) {
  return guests.filter((g) => !g.plus_one_of && hasContact(g) && events.some((e) => ((idx.get(g.id) || {})[e.id] || "non_invite") === "attente"));
}

export function agoDays(iso) {
  const t = iso ? new Date(iso).getTime() : NaN;
  if (!Number.isFinite(t)) return null;
  return Math.floor((Date.now() - t) / 86400000);
}

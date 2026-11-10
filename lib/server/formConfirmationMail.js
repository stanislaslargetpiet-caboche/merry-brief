// Mail de confirmation à l'invité qui vient de répondre au formulaire (/f/[slug] ou rubrique « Votre
// réponse » du site de mariage) : sa réponse est arrivée, ce qu'il a répondu, comment la changer.
// Tutoiement, comme les autres mails Merry et la plupart des formulaires des couples (demande de Stan,
// 10 nov. 2026). Rien de ce que l'invité a écrit librement (mot aux mariés,
// questions ajoutées) n'est recopié : seulement son prénom, ses oui / non et le nom de son accompagnant.

import { longDate } from "@/lib/dash/format";
import { fieldMode } from "@/lib/dash/form";
import { mailShell } from "@/lib/server/mailShell";
import { renderMail } from "@/lib/server/mailTemplate";
import { displayName } from "@/lib/server/names";

const ANSWER = { oui: "Oui", non: "Non" };

// « Léo et Léa » : les prénoms du couple, à défaut le titre du formulaire
export function formCouple(form) {
  const names = [form?.partner1, form?.partner2].map(displayName).filter(Boolean);
  return names.length ? names.join(" et ") : String(form?.title || "").trim();
}

// Une ligne par moment auquel l'invité a répondu ; une seule quand le formulaire demande la présence pour tout le mariage
export function answerRows(form, payload) {
  if (fieldMode(form, "presence") === "off") return [];
  const answers = payload?.answers || {};
  const events = form?.events || [];
  if (form?.presence_mode === "global") {
    const value = events.map((e) => answers[e.id]).find((v) => ANSWER[v]);
    return value ? [{ name: "Ta présence", status: ANSWER[value], ok: value === "oui" }] : [];
  }
  return events.filter((e) => ANSWER[answers[e.id]]).map((e) => ({ name: e.name, status: ANSWER[answers[e.id]], ok: answers[e.id] === "oui" }));
}

export function formConfirmationMail({ form, payload, link }) {
  const couple = formCouple(form);
  const first = displayName(payload?.first_name);
  const title = first ? `Merci ${first}, c'est noté.` : "Merci, c'est noté.";
  const subject = couple ? `Ta réponse est bien arrivée chez ${couple}` : "Ta réponse est bien arrivée";
  const when = [longDate(form?.wedding_date), String(form?.venue || "").trim()].filter(Boolean).join(" · ");
  const rows = answerRows(form, payload);
  const plus = fieldMode(form, "plusun") !== "off" && payload?.plus_one ? [payload.plus_one.first_name, payload.plus_one.last_name].map(displayName).filter(Boolean).join(" ") : "";
  const paras = [
    couple ? `Ta réponse est arrivée chez ${couple}.` : "Ta réponse est arrivée chez les mariés.",
    plus ? `Ton accompagnant : ${plus}.` : "",
    "Pour changer ta réponse, renvoie simplement le formulaire avec les mêmes prénom et nom.",
  ].filter(Boolean);
  const why = `Tu reçois ce mail car tu as répondu au formulaire ${couple ? `de ${couple}` : "d'un mariage"} sur Merry.`;

  const text = [
    title,
    couple ? [couple, when].filter(Boolean).join("\n") : when,
    rows.map((r) => `${r.name} : ${r.status}`).join("\n"),
    ...paras,
    `Revoir le formulaire : ${link}`,
    `Merry · withmerry.com\n${why}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const body = renderMail({
    title,
    card: couple ? { name: couple, sub: when || "Mariage" } : null,
    rows,
    paras,
    cta: { href: link, label: "Revoir le formulaire" },
    why,
    link: { href: "https://withmerry.com", label: "Découvrir Merry" },
  });

  return { subject, text, html: mailShell({ title, preheader: paras[0], body }) };
}

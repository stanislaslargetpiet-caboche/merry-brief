// Mail de confirmation à l'invité qui vient de répondre au formulaire (/f/[slug] ou rubrique « Ta
// réponse » du site de mariage), planches V49 du canvas (page « 7 - mails »). Le mail appartient au couple :
// fond, boutons et bandeau aux couleurs du thème du formulaire, photo d'en-tête quand il y en a une, « Save
// the date » ; puis « Merci, c'est noté » en vert, ce qu'il a répondu, l'ajout à l'agenda, et la carte
// « Créé avec Merry » de l'écran après l'envoi (3f). Tutoiement, comme tout le parcours invité (D-211).
// Rien de ce que l'invité a écrit librement (mot aux mariés, questions ajoutées) n'est recopié : seulement
// son prénom, ses oui / non et le nom de son accompagnant.
// Tableaux et styles en ligne (Gmail ignore flex et grid), Arial à la place d'Alan Sans, logo en image.

import { longDate } from "@/lib/dash/format";
import { fieldMode, formTheme, merryProof } from "@/lib/dash/form";
import { esc, mailShell } from "@/lib/server/mailShell";
import { displayName } from "@/lib/server/names";

// Lien de la carte Merry : la source fait compter ces visites et inscriptions à part dans le pilotage
const MERRY = "https://withmerry.com/?source=mail-invites";
const INK = "#1c1c1a";
const MUTED = "#4a4a45";
const FAINT = "#6b6a63";
const FONT = "font-family:Arial,Helvetica,sans-serif";
const LINE = "border-top:1px solid rgba(28,28,26,0.1);";
const ANSWER = { oui: "Oui", non: "Non" };
// Pastilles de l'écran de fin, icônes au trait à la couleur du thème (public/mail/formulaire, outils/icones-mail-formulaire.mjs)
const TAGS = [
  ["invites", "Invités"],
  ["budget", "Budget"],
  ["prestataires", "Prestataires"],
];

// Deux boutons côte à côte sur ordinateur, l'un sous l'autre sur téléphone
const CSS = "@media (max-width:480px){.mi-btn{max-width:100%!important}}";

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

const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1);

function originOf(link) {
  try {
    return new URL(link).origin;
  } catch {
    return "https://app.withmerry.com";
  }
}

// Bloc arrondi plein ; Outlook ignore l'arrondi sans casser le reste
const box = (bg, radius, padding, inner, css = "") =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${bg};border-radius:${radius}px;border-collapse:separate;${css}"><tr><td style="padding:${padding}">${inner}</td></tr></table>`;

function header({ theme, photo, title, date, venue }) {
  const text = `<div style="padding:32px 24px 30px;text-align:center">
<div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;font-weight:700;color:${theme.accent}">Save the date</div>
${title ? `<div style="margin-top:12px;font-size:36px;line-height:1.1;font-weight:700;color:${INK}">${esc(title)}</div>` : ""}
${date ? `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:14px auto 0"><tr><td style="padding:10px 20px;border-radius:999px;background:${photo ? theme.deep : "#ffffff"};color:${theme.accent};font-size:16px;font-weight:700">${esc(date)}</td></tr></table>` : ""}
${venue ? `<div style="margin-top:12px;font-size:14px;font-weight:700;color:${MUTED}">${esc(venue)}</div>` : ""}
</div>`;
  if (!photo) return box(theme.deep, 24, "0", text);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:24px;border-collapse:separate">
<tr><td style="padding:0"><img src="${esc(photo.src)}" width="560" alt="${esc(photo.alt)}" style="display:block;width:100%;max-width:560px;height:auto;border:0;border-radius:24px 24px 0 0"></td></tr>
<tr><td style="padding:0">${text}</td></tr>
</table>`;
}

const button = (href, label, style) =>
  `<div class="mi-btn" style="display:inline-block;width:100%;max-width:246px;vertical-align:top;padding:5px;box-sizing:border-box"><a href="${esc(href)}" style="display:block;${FONT};border-radius:999px;font-size:15px;line-height:20px;font-weight:700;text-align:center;text-decoration:none;${style}">${esc(label)}</a></div>`;

function answerCard({ theme, title, arrived, lines, agenda, link }) {
  const status = box(
    "#dff3e1",
    16,
    "20px 18px",
    `<div style="text-align:center"><h1 style="margin:0;${FONT};font-size:23px;line-height:1.2;font-weight:700;color:#1f6b30">${esc(title)}</h1>
<p style="margin:6px 0 0;font-size:15px;line-height:1.5;color:${MUTED}">${esc(arrived)}</p></div>`,
  );
  const recap = lines.length
    ? `<div style="margin-top:22px;font-size:15px;font-weight:700;color:${INK}">Ta réponse</div>
${box(
  theme.bg,
  16,
  "4px 18px",
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${lines
    .map(
      (l, i) =>
        `<tr><td style="padding:12px 0;${i ? LINE : ""}font-size:15px;font-weight:700;color:${INK}">${esc(l.name)}</td><td align="right" style="padding:12px 0 12px 12px;${i ? LINE : ""}">${
          l.status
            ? `<span style="display:inline-block;padding:4px 12px;border-radius:999px;background:${l.ok ? "#dff3e1" : "#efeeea"};color:${l.ok ? "#1f6b30" : "#4d4c46"};font-size:12px;font-weight:700;white-space:nowrap">${esc(l.status)}</span>`
            : `<span style="font-size:15px;color:${MUTED}">${esc(l.value)}</span>`
        }</td></tr>`,
    )
    .join("")}</table>`,
  "margin-top:10px;",
)}`
    : "";
  const buttons = `<div style="margin-top:22px;font-size:0;line-height:0;text-align:center">${agenda ? button(agenda, "Ajouter à mon agenda", `padding:16px 12px;background:${theme.accent};color:#ffffff`) : ""}${button(link, "Modifier ma réponse", `padding:14px 12px;background:#ffffff;color:${INK};border:2px solid ${INK}`)}</div>
<p style="margin:10px 0 0;text-align:center;font-size:13px;line-height:1.5;color:${FAINT}">Pour la changer, renvoie le formulaire avec les mêmes prénom et nom.</p>`;
  return box("#ffffff", 24, "28px 24px", `${status}${recap}${buttons}`);
}

// Merry sans carte ni question, comme l'écran de fin du formulaire : logo, la phrase sur le couple en petit,
// pastilles blanches et bouton aux couleurs du thème
function merryBlock({ theme, proof, logo, origin }) {
  const tags = TAGS.map(
    ([icon, label]) =>
      `<span style="display:inline-block;margin:4px;padding:10px 18px 10px 14px;border-radius:999px;background:#ffffff;${FONT};font-size:15px;line-height:22px;font-weight:700;color:${INK};white-space:nowrap"><img src="${origin}/mail/formulaire/${icon}-${theme.id}.png" width="22" height="22" alt="" style="display:inline-block;vertical-align:top;margin-right:8px;border:0">${esc(label)}</span>`,
  ).join("");
  return `<div style="padding:30px 16px 0;text-align:center">
<a href="${MERRY}" style="text-decoration:none"><img src="${esc(logo)}" width="150" height="31" alt="Merry" style="display:inline-block;border:0"></a>
<p style="margin:12px 0 0;font-size:14px;line-height:1.5;color:${MUTED}">${esc(proof)}</p>
<div style="margin-top:18px;font-size:0;line-height:0">${tags}</div>
<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:20px auto 0"><tr><td style="border-radius:999px;background:${theme.accent}"><a href="${MERRY}" style="display:inline-block;padding:16px 30px;${FONT};font-size:15px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none">Découvrir Merry&nbsp;&rarr;</a></td></tr></table>
</div>`;
}

export function formConfirmationMail({ form, payload, link }) {
  const origin = originOf(link);
  const theme = formTheme(form?.theme);
  const couple = formCouple(form);
  const first = displayName(payload?.first_name);
  const title = first ? `Merci ${first}, c'est noté.` : "Merci, c'est noté.";
  const subject = couple ? `Ta réponse est bien arrivée chez ${couple}` : "Ta réponse est bien arrivée";
  const arrived = couple ? `Ta réponse est arrivée chez ${couple}.` : "Ta réponse est arrivée chez les mariés.";
  const names = [form?.partner1, form?.partner2].map(displayName).filter(Boolean);
  const heading = String(form?.title || "").trim() || names.join(" & ");
  const date = longDate(form?.wedding_date);
  const venue = String(form?.venue || "").trim();
  const rows = answerRows(form, payload);
  const plus = fieldMode(form, "plusun") !== "off" && payload?.plus_one ? [payload.plus_one.first_name, payload.plus_one.last_name].map(displayName).filter(Boolean).join(" ") : "";
  const lines = [...rows, ...(plus ? [{ name: "Accompagnant", value: plus }] : [])];
  // L'agenda seulement si l'invité vient à au moins un moment (ou si la présence n'est pas demandée)
  const comes = !rows.length || rows.some((r) => r.ok);
  const agenda = date && comes ? `${link}/agenda` : "";
  const photo = form?.cover_url && /^https:\/\//.test(form.cover_url) ? { src: `${link}/photo-mail`, alt: heading ? `Photo de ${heading}` : "Photo des mariés" } : null;
  const why = `Tu reçois ce mail car tu as répondu au formulaire ${couple ? `de ${couple}` : "d'un mariage"} sur Merry.`;
  const proof = merryProof({ partner1: displayName(form?.partner1), partner2: displayName(form?.partner2) });
  const recap = rows.map((r) => `${r.name} : ${lower(r.status)}`).join(" · ");
  const preheader = [recap ? `${recap}.` : "", date && comes ? `Rendez-vous le ${lower(date)}.` : ""].filter(Boolean).join(" ") || arrived;

  const text = [
    `${title}\n${arrived}`,
    [heading, [date, venue].filter(Boolean).join(" · ")].filter(Boolean).join("\n"),
    lines.length ? ["Ta réponse", ...lines.map((l) => `${l.name} : ${l.status || l.value}`)].join("\n") : "",
    [agenda ? `Ajouter à mon agenda : ${agenda}` : "", `Modifier ma réponse : ${link}`, "Pour la changer, renvoie le formulaire avec les mêmes prénom et nom."].filter(Boolean).join("\n"),
    `${proof}\nDécouvrir Merry : ${MERRY}`,
    `Merry · withmerry.com\n${why}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const logo = `${origin}/mail/merry.png`;
  const body = `<div style="${FONT};color:${INK}">
${header({ theme, photo, title: heading, date, venue })}
<div style="height:14px;line-height:14px;font-size:1px">&nbsp;</div>
${answerCard({ theme, title, arrived, lines, agenda, link })}
<div style="height:14px;line-height:14px;font-size:1px">&nbsp;</div>
${merryBlock({ theme, proof, logo, origin })}
<div style="padding-top:30px;text-align:center">
<p style="margin:0 auto;max-width:420px;font-size:12px;line-height:1.5;color:${FAINT}">${esc(why)}</p>
</div>
</div>`;

  return { subject, text, html: mailShell({ title, preheader, body, bg: theme.bg, css: CSS }) };
}

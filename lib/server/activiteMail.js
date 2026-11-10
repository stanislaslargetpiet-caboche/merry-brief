// Mail de 20 h « Nouvelles activités sur votre mariage » (maquette de Stan, 9 nov. 2026) : ce qui s'est passé
// sur le mariage depuis la veille à 20 h, en trois blocs (Invités, Prestataires, Messages). Tableaux et styles
// en ligne, Gmail ignore flex et grid ; Arial remplace Alan Sans, absente des clients mail.

import { esc, logoBlock } from "@/lib/server/mailShell";
import { parisParts } from "@/lib/server/pilotage/schedule";

export const SUBJECT = "Nouvelles activités sur votre mariage";
export const MAX_LINES = 4;
export const SEND_HOURS = [20, 21];

// 20 h (Paris) du jour de `now`, en instant UTC. La fenêtre d'activité d'un envoi va de 20 h la veille à
// 20 h ce jour-là, quelle que soit l'heure réelle du lancement : deux jours de suite ne se recouvrent jamais.
export function windowEnd(now = new Date()) {
  const { year, month, day } = parisParts(now);
  for (const offset of [1, 2]) {
    const t = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 20 - offset));
    if (parisParts(t).hour === 20) return t;
  }
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 19));
}

export const windowStart = (end) => new Date(end.getTime() - 24 * 3600 * 1000);

const pill = (label, bg, color) =>
  `<span style="display:inline-block;padding:4px 10px;border-radius:999px;background:${bg};color:${color};font-size:12px;font-weight:700;letter-spacing:0.06em;white-space:nowrap">${esc(label)}</span>`;
const PILLS = {
  vient: pill("VIENT", "#dff3e1", "#1f6b30"),
  non: pill("NE VIENT PAS", "#fde0de", "#b42318"),
  ajoute: pill("AJOUTÉ", "#ebe6fb", "#4a3d99"),
  repondu: pill("A RÉPONDU", "#ebe6fb", "#4a3d99"),
};

const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;
const teamLine = (n) => `${plural(n, "invité ajouté", "invités ajoutés")} aujourd'hui par ${n > 1 ? "les organisateurs" : "un organisateur"}`;

// Une ligne de liste : texte en gras, sous-texte facultatif, pastille facultative
function row({ name, sub, pillKey }, last) {
  const border = `border-top:1px solid #ecebe6;${last ? "border-bottom:1px solid #ecebe6;" : ""}`;
  return `<tr><td style="padding:8px 0;${border}font-size:15px;line-height:1.5"><b style="font-weight:600">${esc(name)}</b>${sub ? `<br><span style="font-size:12px;font-weight:500;color:#6b6a63">${esc(sub)}</span>` : ""}</td><td align="right" style="padding:8px 0;${border}">${pillKey ? PILLS[pillKey] : ""}</td></tr>`;
}

function more(n, what) {
  return `<tr><td colspan="2" style="padding:8px 0;border-top:1px solid #ecebe6;border-bottom:1px solid #ecebe6;font-size:13px;color:#6b6a63">et ${esc(what(n))}, à voir sur Merry</td></tr>`;
}

function section({ origin, icon, title, lead, rows, overflow }) {
  const shown = rows.slice(0, MAX_LINES);
  const rest = rows.length - shown.length;
  const lines = shown.map((r, i) => row(r, !rest && i === shown.length - 1)).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px"><tr><td>
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td valign="middle" style="padding-right:10px"><img src="${esc(origin)}/mail/${icon}.png" width="26" height="26" alt="" style="display:block;border:0"></td>
<td valign="middle" style="font-size:18px;font-weight:700;line-height:1.3">${esc(title)}</td>
</tr></table>
${lead ? `<p style="margin:12px 0 8px;font-size:15px;line-height:1.5">${lead}</p>` : `<div style="height:12px;line-height:12px;font-size:12px">&nbsp;</div>`}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${lines}${rest > 0 ? more(rest, overflow) : ""}</table>
</td></tr></table>`;
}

// Oui à un événement, non à un autre : la pastille dit VIENT, le détail sous le nom dit où (« Cocktail : oui · Dîner : non »)
function eventsDetail(events = []) {
  const named = events.filter((e) => e.label);
  if (!named.some((e) => e.comes) || !named.some((e) => !e.comes)) return "";
  return named.map((e) => `${e.label} : ${e.comes ? "oui" : "non"}`).join(" · ");
}

// Formulaire sans question de présence (comes: null) : A RÉPONDU, ou AJOUTÉ si le formulaire a créé l'invité
const responsePill = (r) => (r.comes == null ? (r.added ? "ajoute" : "repondu") : r.comes ? "vient" : "non");
const responseText = (r) => (r.comes == null ? (r.added ? "a répondu, ajouté à la liste" : "a répondu") : r.comes ? "vient" : "ne vient pas");

// activity : { reponses: [{name, comes (null : présence non demandée), added, events: [{label, comes}]}], ajouts: [{name}],
//             ajoutsParEquipe: [{count}] (anonymes : « par les organisateurs »), prestataires: [{name}], messages: [{name, count}] }
export function buildActivite({ activity, firstName, origin, unsub, link }) {
  const { reponses = [], ajouts = [], ajoutsParEquipe = [], prestataires = [], messages = [] } = activity;
  const sections = [];
  const team = ajoutsParEquipe.reduce((n, a) => n + a.count, 0);
  const invitesRows = [
    ...reponses.map((r) => ({ name: r.name, sub: eventsDetail(r.events), pillKey: responsePill(r) })),
    ...ajouts.map((a) => ({ name: a.name, pillKey: "ajoute" })),
    ...(team ? [{ name: teamLine(team) }] : []),
  ];
  if (invitesRows.length) {
    const parts = [];
    if (reponses.length) parts.push(`<b>${reponses.length}</b> ${reponses.length > 1 ? "nouvelles réponses" : "nouvelle réponse"} à ton invitation`);
    if (ajouts.length) parts.push(`<b>${ajouts.length}</b> ${ajouts.length > 1 ? "invités ajoutés" : "invité ajouté"}`);
    sections.push({
      icon: "invites",
      title: "Invités",
      lead: parts.join(" · "),
      rows: invitesRows,
      overflow: (n) => plural(n, "autre ligne", "autres lignes"),
    });
  }
  if (prestataires.length) {
    sections.push({
      icon: "lieu",
      title: "Prestataires",
      lead: `<b>${prestataires.length}</b> ${prestataires.length > 1 ? "prestataires ont répondu" : "prestataire a répondu"} à ta demande`,
      rows: prestataires.map((p) => ({ name: p.name, pillKey: "repondu" })),
      overflow: (n) => plural(n, "autre prestataire", "autres prestataires"),
    });
  }
  if (messages.length) {
    const total = messages.reduce((n, m) => n + m.count, 0);
    sections.push({
      icon: "messagerie",
      title: "Messages",
      lead: `<b>${total}</b> ${total > 1 ? "nouveaux messages" : "nouveau message"}`,
      rows: messages.map((m) => ({ name: m.name, sub: plural(m.count, "message", "messages") })),
      overflow: (n) => plural(n, "autre prestataire", "autres prestataires"),
    });
  }
  if (!sections.length) return null;

  // Aperçu de la boîte de réception : une phrase par bloc
  const counts = [];
  if (reponses.length) counts.push(plural(reponses.length, "réponse d'invité", "réponses d'invités"));
  const added = ajouts.length + team;
  if (added) counts.push(plural(added, "invité ajouté", "invités ajoutés"));
  if (prestataires.length) counts.push(plural(prestataires.length, "réponse de prestataire", "réponses de prestataires"));
  const msgTotal = messages.reduce((n, m) => n + m.count, 0);
  if (msgTotal) counts.push(plural(msgTotal, "message", "messages"));
  const preheader = counts.join(", ");

  const hello = firstName ? `Bonjour ${esc(firstName)},` : "Bonjour,";
  const body = `<div style="background:#f6f5f1;border-radius:24px;padding:16px;font-family:Arial,Helvetica,sans-serif;color:#1c1c1a;max-width:560px">
${logoBlock}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:20px;border-collapse:separate"><tr><td style="padding:28px 28px 24px">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td valign="middle" style="padding-right:12px"><img src="${esc(origin)}/mail/cloche.png" width="36" height="36" alt="" style="display:block;border:0"></td>
<td valign="middle" style="font-size:24px;line-height:1.2;font-weight:700;letter-spacing:-0.01em">Ta journée sur Merry</td>
</tr></table>
<div style="height:1px;background:#ecebe6;margin:20px 0 24px;line-height:1px;font-size:1px">&nbsp;</div>
<p style="margin:0 0 12px;font-size:15px;line-height:1.5">${hello}</p>
<p style="margin:0 0 28px;font-size:15px;line-height:1.5">${esc(SUBJECT)}.</p>
${sections.map((s) => section({ ...s, origin })).join("\n")}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<a href="${esc(link)}" style="display:inline-block;background:#1c1c1a;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:700;font-size:14px">Aller sur Merry</a>
</td></tr></table>
</td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:20px 8px 4px;font-size:12px;line-height:1.5;color:#9c9a90">
Tu reçois ce mail parce qu'il y a eu de l'activité sur ton compte aujourd'hui.<br>
<a href="${esc(unsub)}" style="color:#6b6a63;text-decoration:underline">Gérer mes notifications</a>
</td></tr></table>
</div>`;

  const lines = [`${firstName ? `Bonjour ${firstName},` : "Bonjour,"}`, `${SUBJECT}.`];
  if (reponses.length) lines.push(`Invités, réponses :\n${reponses
      .map((r) => {
        const detail = eventsDetail(r.events);
        return `- ${r.name} : ${responseText(r)}${detail ? ` (${detail})` : ""}`;
      })
      .join("\n")}`);
  if (added) {
    const names = [...ajouts.map((a) => `- ${a.name}`), ...(team ? [`- ${teamLine(team)}`] : [])];
    lines.push(`Invités, ajouts :\n${names.join("\n")}`);
  }
  if (prestataires.length) lines.push(`Prestataires ayant répondu :\n${prestataires.map((p) => `- ${p.name}`).join("\n")}`);
  if (messages.length) lines.push(`Messages :\n${messages.map((m) => `- ${m.name} (${m.count})`).join("\n")}`);
  lines.push(`Aller sur Merry : ${link}`, `Gérer mes notifications : ${unsub}`);

  return { subject: SUBJECT, preheader, body, text: lines.join("\n\n") };
}

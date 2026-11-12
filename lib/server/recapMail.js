// Récap de la semaine du dimanche 20 h (D-296, D-297, canvas page « 7 - mails », V65 et V65 bis) : remplace les neuf mails de
// présentation du samedi. Trois chiffres de la semaine, ce qui a bougé, trois choses à faire, et une seule fonction
// que le couple n'a pas encore essayée. Une semaine sans rien de neuf donne V65 bis : une seule chose à faire.
// Fonctions pures, sans base : les données viennent de lib/server/recapJob.js. Tableaux et styles en ligne, comme
// les mails de démarrage (Gmail ignore flex et grid) ; Arial remplace Alan Sans, absente des clients mail.

import { esc, mailShell } from "@/lib/server/mailShell";
import { memberLabel } from "@/lib/server/demarrageMail";
import { NOUVEAUTES } from "@/lib/server/nouveautesMail";

const DAY = 86400000;
const GREY = "#6b6a63";
const LINE = "#ecebe6";
const SOFT = "#f6f5f1";

export const campagne = "recap-dimanche";
const linkTo = (origin, path) => `${origin}${path}?utm_source=mail&utm_medium=email&utm_campaign=${campagne}`;

// 25 000 € (espaces insécables en HTML, simples dans le texte)
export const euros = (n) => `${Math.round(Number(n)).toLocaleString("fr-FR").replace(/\s/g, " ")} €`;
const htmlText = (s) => esc(s).replace(/(\d) (\d{3})/g, "$1&nbsp;$2").replace(/ €/g, "&nbsp;€").replace(/ ([;:?!])/g, "&nbsp;$1");
const plural = (n, one, many) => (n === 1 ? one : many.replace("N", String(n)));
const hello = (firstName) => (firstName ? `Bonjour ${firstName}` : "Bonjour");
const longDate = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });

// Jours restants jusqu'au mariage, comptés de date à date à Paris ; null sans date ou une fois la date passée
export function joursRestants(weddingDate, today) {
  if (!weddingDate) return null;
  const n = Math.round((Date.parse(`${weddingDate}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / DAY);
  return n > 0 ? n : null;
}

const rebours = (ctx) => {
  const n = joursRestants(ctx.weddingDate, ctx.today);
  return n ? `plus que ${plural(n, "1 jour", "N jours")} avant le ${longDate(ctx.weddingDate)}` : "";
};

// « en retard », « cette semaine », « prévu en mars », « prévu en mars 2028 »
export function echeance(due, today) {
  if (!due) return "";
  if (due < today) return "en retard";
  if (Date.parse(`${due}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`) < 7 * DAY) return "cette semaine";
  const d = new Date(`${due}T12:00:00Z`);
  const month = d.toLocaleDateString("fr-FR", { month: "long", timeZone: "Europe/Paris" });
  return due.slice(0, 4) === today.slice(0, 4) ? `prévu en ${month}` : `prévu en ${month} ${due.slice(0, 4)}`;
}

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// « Thomas a ajouté », « Tes parents ont ajouté », « Les parents de Thomas ont ajouté »
function auteur(a, me) {
  if (a.moi) return "Tu as";
  const { label, plural: many } = memberLabel({ display_name: a.author }, me);
  return `${cap(label || a.author)} ${many ? "ont" : "a"}`;
}

// Ce qui a bougé, ligne à ligne : [texte, détail à droite]. `semaine` vient de recapJob.js.
export function lignes(semaine, me = "") {
  const out = [];
  const rep = semaine.reponses || [];
  if (rep.length === 1) {
    const r = rep[0];
    out.push([`${r.name} a répondu au formulaire`, r.comes === true ? "vient" : r.comes === false ? "ne vient pas" : ""]);
  } else if (rep.length > 1) {
    const yes = rep.filter((r) => r.comes === true).length;
    out.push([`${rep.length} invités ont répondu au formulaire`, yes ? plural(yes, "1 vient", "N viennent") : ""]);
  }
  for (const a of semaine.ajouts || []) out.push([`${auteur(a, me)} ajouté ${plural(a.count, "un invité", "N invités")}`, ""]);
  for (const p of semaine.prestataires || []) out.push([`${p.name} a répondu à ta demande`, ""]);
  for (const m of semaine.messages || []) out.push([`${m.name} t’a écrit`, plural(m.count, "1 message", "N messages")]);
  for (const s of semaine.signes || []) out.push([`${s.label} : devis signé`, s.amount != null ? euros(s.amount) : ""]);
  if (semaine.devis) out.push([plural(semaine.devis, "Un devis ajouté à tes documents", "N devis ajoutés à tes documents"), ""]);
  if (semaine.taches) out.push([plural(semaine.taches, "Une tâche cochée dans le rétroplanning", "N tâches cochées dans le rétroplanning"), ""]);
  return out.slice(0, 6);
}

// Les fonctions des anciens mails du samedi (V40 à V48), dans leur ordre d'envoi ; `faite` lit l'usage du couple
export const FONCTIONS = [
  { cle: "budget", nom: "Le budget", texte: NOUVEAUTES[0].promesse, bouton: "Ouvrir mon budget", lien: "/dashboard/budget" },
  { cle: "invites", nom: "La liste d’invités", texte: NOUVEAUTES[1].promesse, bouton: "Importer ma liste", lien: "/dashboard/invites/importer" },
  { cle: "formulaire", nom: "Le formulaire invités", texte: "Un seul lien à partager, et chaque réponse arrive directement dans ta liste.", bouton: "Créer mon formulaire", lien: "/dashboard/invites/formulaire" },
  { cle: "site", nom: "Le site du mariage", texte: "Le programme, le lieu, l’hébergement : tes invités trouvent tout sur une seule page.", bouton: "Créer mon site", lien: "/dashboard/site" },
  { cle: "documents", nom: "Les documents", texte: "Range chaque contrat dans son dossier, et scanne les papiers signés avec ton téléphone.", bouton: "Ranger mes documents", lien: "/dashboard/documents" },
  { cle: "prestataires", nom: "Les prestataires", texte: "Ta région, tes critères : Merry ne te montre que les prestataires qui correspondent.", bouton: "Voir les prestataires", lien: "/dashboard/prestataires" },
  { cle: "plan", nom: "Le plan de table", texte: "Merry crée les tables et place tes invités, chacun avec son accompagnant.", bouton: "Essayer le plan de table", lien: "/dashboard/invites/plan-de-table" },
];

export function fonctionAEssayer(usage, oui = 0) {
  const f = FONCTIONS.find((x) => !usage[x.cle]);
  if (!f) return null;
  if (f.cle !== "plan" || !oui) return f;
  return { ...f, texte: `${f.texte} Tu peux commencer avec ${plural(oui, "l’invité qui a déjà dit oui", "les N invités qui ont déjà dit oui")}.` };
}

// ctx : { origin, unsub, firstName, weddingDate, today, budgetTotal, semaine, enAttente, engage, taches: [{title, due_date}], guestCount, usage, oui }
// Renvoie null quand il n'y a rien à dire : semaine calme et plus rien à faire.
export function recapMail(ctx) {
  const items = lignes(ctx.semaine, ctx.firstName);
  return items.length ? semaineMail(ctx, items) : calmeMail(ctx);
}

function sujet(ctx) {
  const s = ctx.semaine;
  const parts = [];
  const rep = (s.reponses || []).length;
  if (rep) parts.push(plural(rep, "une réponse d’invité", "N réponses d’invités"));
  if (s.devis) parts.push(plural(s.devis, "un devis", "N devis"));
  if ((s.prestataires || []).length) parts.push(plural(s.prestataires.length, "un prestataire a répondu", "N prestataires ont répondu"));
  if ((s.signes || []).length) parts.push(`${s.signes[0].label.toLowerCase()} signé`);
  const ajouts = (s.ajouts || []).reduce((n, a) => n + a.count, 0);
  if (ajouts) parts.push(plural(ajouts, "un invité ajouté", "N invités ajoutés"));
  if (s.taches) parts.push(plural(s.taches, "une tâche cochée", "N tâches cochées"));
  return parts.length ? `Ta semaine : ${parts.slice(0, 2).join(" et ")}` : "Ta semaine sur Merry";
}

const table = (inner, style = "") => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;${style}">${inner}</table>`;

const heroBlock = (assets, title, paras) => table(`<tr><td style="padding:32px 28px">
<img src="${esc(assets)}/merry.png" width="145" height="30" alt="Merry" style="display:block;border:0;width:145px;height:30px">
<h1 style="margin:32px 0 0;font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:32px;line-height:1.08;letter-spacing:-0.01em;color:#1c1c1a">${esc(title)}</h1>
${paras.map((p) => `<p style="margin:14px 0 0;font-size:16px;line-height:1.5;color:#1c1c1a">${htmlText(p)}</p>`).join("\n")}
</td></tr>`, "background:#bfe9a6;border-radius:20px");

const section = (title, inner, first) => `<div style="margin-top:${first ? 20 : 28}px"><div style="font-size:18px;font-weight:700;margin-bottom:12px">${esc(title)}</div>${inner}</div>`;

// Trois chiffres en cartes blanches dans l'encart gris ; sur téléphone les cartes se resserrent sans media query
function chiffres(cells) {
  const td = ([k, v, sub]) => `<td width="33%" valign="top" style="padding:4px"><div style="background:#ffffff;border:1px solid ${LINE};border-radius:12px;padding:12px">
<div style="font-size:10.5px;font-weight:700;letter-spacing:0.06em;color:${GREY};text-transform:uppercase">${esc(k)}</div>
<div style="margin-top:4px;font-size:22px;font-weight:700;line-height:1.1;white-space:nowrap">${htmlText(v)}</div>
<div style="margin-top:2px;font-size:12px;color:${GREY}">${htmlText(sub)}</div></div></td>`;
  return table(`<tr><td style="padding:8px">${table(`<tr>${cells.map(td).join("")}</tr>`)}</td></tr>`, `background:${SOFT};border-radius:20px`);
}

function listeBouge(items) {
  const rows = items
    .map(([left, right], i) => `<tr><td style="${i ? `border-top:1px solid ${LINE};` : ""}padding:11px 0;font-size:15px;line-height:1.4">${htmlText(left)}</td><td align="right" valign="middle" style="${i ? `border-top:1px solid ${LINE};` : ""}padding:11px 0 11px 12px;font-size:12.5px;color:${GREY};white-space:nowrap">${htmlText(right)}</td></tr>`)
    .join("");
  return table(rows, `margin-top:8px;border-bottom:1px solid ${LINE}`);
}

function aFaire(items) {
  const rows = items
    .map(([left, right]) => `<tr><td style="padding:4px 0">${table(`<tr><td width="24" valign="middle" style="padding:12px 0 12px 14px"><div style="width:14px;height:14px;border-radius:999px;border:1.3px solid #1c1c1a;background:#ffffff"></div></td><td valign="middle" style="padding:12px 10px;font-size:14.5px;line-height:1.4">${htmlText(left)}</td><td align="right" valign="middle" style="padding:12px 14px 12px 0;font-size:12.5px;color:${GREY};white-space:nowrap">${htmlText(right)}</td></tr>`, `background:#ffffff;border:1px solid ${LINE};border-radius:12px`)}</td></tr>`)
    .join("");
  return table(`<tr><td style="padding:8px 12px">${table(rows)}</td></tr>`, `background:${SOFT};border-radius:20px`);
}

const cta = (label, link) => table(`<tr><td align="center">
<a href="${esc(link)}" style="display:inline-block;width:300px;max-width:100%;box-sizing:border-box;background:#1c1c1a;color:#ffffff;text-align:center;text-decoration:none;padding:17px 0;border-radius:999px;font-weight:700;font-size:15px;line-height:18px">${esc(label)}</a>
</td></tr>`, "margin-top:20px");

const essai = (f, link) => table(`<tr><td style="padding:20px 24px">
<div style="font-size:10.5px;font-weight:700;letter-spacing:0.06em;color:${GREY};text-transform:uppercase">Pas encore essayé</div>
<div style="margin-top:6px;font-size:18px;font-weight:700">${esc(f.nom)}</div>
<p style="margin:6px 0 0;font-size:15px;line-height:1.5">${htmlText(f.texte)}</p>
${table(`<tr><td><a href="${esc(link)}" style="display:inline-block;width:260px;max-width:100%;box-sizing:border-box;background:#ffffff;border:1.5px solid #1c1c1a;color:#1c1c1a;text-align:center;text-decoration:none;padding:13px 0;border-radius:999px;font-weight:700;font-size:14.5px;line-height:18px">${esc(f.bouton)}</a></td></tr>`, "margin-top:16px")}
</td></tr>`, `margin-top:28px;background:${SOFT};border-radius:20px`);

const SIGN = '<p style="margin:24px 0 0;font-size:15px;line-height:1.6">À dimanche prochain,<br><strong>Stan</strong> de Merry</p>';

const footer = (unsub) => table(`<tr><td style="padding:16px;font-size:12px;color:#9c9a90;line-height:1.6">Merry · withmerry.com<br>Tu reçois ce mail car tu as créé ton mariage sur Merry.<br><a href="${esc(unsub)}" style="color:${GREY};text-decoration:underline">Ne plus recevoir le récap du dimanche</a></td></tr>`, `margin-top:28px;background:${SOFT};border-top:1px solid ${LINE}`);

const wrap = (inner) => `<div style="font-family:Arial,Helvetica,sans-serif;color:#1c1c1a;max-width:560px">\n${inner}\n</div>`;

const prochaines = (ctx) => (ctx.taches || []).slice(0, 3).map((t) => [cap(t.title), echeance(t.due_date, ctx.today)]);

function semaineMail(ctx, items) {
  const assets = `${ctx.origin}/mail`;
  const subject = sujet(ctx);
  const todo = prochaines(ctx);
  const left = rebours(ctx);
  const suite = todo.length ? `, puis ${todo.length === 1 ? "la chose" : todo.length === 2 ? "les deux choses" : "les trois choses"} à faire ensuite` : "";
  const intro = `${hello(ctx.firstName)}, ${left ? `${left}. Voici` : "voici"} ce qui a avancé depuis dimanche dernier${suite}.`;
  const preheader = `${left ? `${left[0].toUpperCase()}${left.slice(1)}. ` : ""}Ce qui a avancé depuis dimanche dernier.`;
  const rep = (ctx.semaine.reponses || []).length;
  const stats = [
    ["Réponses", String(rep), ctx.enAttente ? `${ctx.enAttente} en attente` : "aucune en attente"],
    ["Devis", String(ctx.semaine.devis || 0), "cette semaine"],
    ["Engagé", euros(ctx.engage || 0), ctx.budgetTotal ? `sur ${euros(ctx.budgetTotal)}` : "devis signés"],
  ];
  const f = fonctionAEssayer(ctx.usage || {}, ctx.oui);
  const open = linkTo(ctx.origin, "/dashboard");

  const body = wrap(`${heroBlock(assets, "Ta semaine sur Merry", [intro])}
${section("Cette semaine", chiffres(stats) + listeBouge(items), true)}
${todo.length ? section("La semaine prochaine", aFaire(todo)) : ""}
${cta("Ouvrir mon mariage", open)}
${f ? essai(f, linkTo(ctx.origin, f.lien)) : ""}
${SIGN}
${footer(ctx.unsub)}`);

  const text = [
    "Ta semaine sur Merry",
    intro,
    `Cette semaine :\n${stats.map(([k, v, s]) => `${k} : ${v} (${s})`).join("\n")}\n${items.map(([l, r]) => `- ${l}${r ? ` (${r})` : ""}`).join("\n")}`,
    ...(todo.length ? [`La semaine prochaine :\n${todo.map(([l, r]) => `- ${l}${r ? ` (${r})` : ""}`).join("\n")}`] : []),
    `Ouvrir mon mariage : ${open}`,
    ...(f ? [`Pas encore essayé : ${f.nom}. ${f.texte}\n${f.bouton} : ${linkTo(ctx.origin, f.lien)}`] : []),
    "À dimanche prochain,\nStan de Merry",
    `Ne plus recevoir le récap du dimanche : ${ctx.unsub}`,
  ].join("\n\n");
  return { variante: "semaine", subject, preheader, text, html: mailShell({ title: subject, preheader, body }) };
}

const MIN_GUESTS = 10;

// V65 bis : une seule chose. Priorité comme les mails de démarrage (D-285) : liste, puis budget, puis formulaire,
// puis le rétroplanning (jalon mensuel des tâches, ancien V58). Fond ici les anciens V61 (liste vide à J+14) et
// V62 (budget vide à J+21), généralisés à chaque semaine calme plutôt qu'à un jour fixe (D-296 révisé).
function uneChose(ctx) {
  const usage = ctx.usage || {};
  if ((ctx.guestCount || 0) < MIN_GUESTS) {
    return {
      ligne: [ctx.guestCount ? "Compléter ta liste d’invités" : "Ajouter tes premiers invités", "10 minutes"],
      bouton: "Ajouter mes invités",
      lien: "/dashboard/invites/importer",
      aside: "Une photo d’une page de carnet suffit : Merry lit les noms et te montre ceux qu’il faut vérifier.",
    };
  }
  if (!usage.budget) {
    return {
      ligne: ["Compléter ton budget", "10 minutes"],
      bouton: "Ouvrir mon budget",
      lien: "/dashboard/budget",
      aside: "Un montant par poste suffit pour voir où tu en es, même sans devis signé.",
    };
  }
  if (!usage.formulaire) {
    return {
      ligne: ["Créer ton formulaire invités", "10 minutes"],
      bouton: "Créer mon formulaire",
      lien: "/dashboard/invites/formulaire",
      aside: "Un seul lien à partager, et chaque réponse arrive directement dans ta liste.",
    };
  }
  const t = (ctx.taches || [])[0];
  if (!t) return null;
  return { ligne: [cap(t.title), echeance(t.due_date, ctx.today)], bouton: "Ouvrir le rétroplanning", lien: "/dashboard/retroplanning", aside: "" };
}

function calmeMail(ctx) {
  const chose = uneChose(ctx);
  if (!chose) return null;
  const assets = `${ctx.origin}/mail`;
  const subject = "Une seule chose cette semaine";
  const left = rebours(ctx);
  const paras = [`${hello(ctx.firstName)}, rien n’a bougé sur ton mariage depuis dimanche dernier.`, left ? `${left[0].toUpperCase()}${left.slice(1)} : tu as le temps, et une seule étape suffit pour avancer.` : "Une seule étape suffit pour avancer."];
  const preheader = `Rien n’a bougé depuis dimanche dernier.${left ? ` ${left[0].toUpperCase()}${left.slice(1)}.` : ""}`;
  const link = linkTo(ctx.origin, chose.lien);
  const body = wrap(`${heroBlock(assets, subject, paras)}
${section("Cette semaine", aFaire([chose.ligne]), true)}
${cta(chose.bouton, link)}
${chose.aside ? `<p style="margin:20px 0 0;font-size:14px;line-height:1.6;color:${GREY}">${htmlText(chose.aside)}</p>` : ""}
${SIGN}
${footer(ctx.unsub)}`);
  const text = [subject, ...paras, `Cette semaine : ${chose.ligne[0]}${chose.ligne[1] ? ` (${chose.ligne[1]})` : ""}`, `${chose.bouton} : ${link}`, ...(chose.aside ? [chose.aside] : []), "À dimanche prochain,\nStan de Merry", `Ne plus recevoir le récap du dimanche : ${ctx.unsub}`].join("\n\n");
  return { variante: "calme", subject, preheader, text, html: mailShell({ title: subject, preheader, body }) };
}

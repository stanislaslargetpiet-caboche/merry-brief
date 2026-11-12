// Mails de démarrage J+1 à J+3 (D-285, canvas page « 7 - mails », V51 à V54) : liste d'invités, organisateurs
// sans accès, budget, et le mot de Stan en texte brut quand rien n'a bougé. Fonctions pures, sans base : le
// choix du mail et les données viennent de lib/server/demarrageJob.js. Tableaux et styles en ligne, comme les
// mails nouveautés (Gmail ignore flex et grid) ; Arial remplace Alan Sans, absente des clients mail.

import { esc, mailShell } from "@/lib/server/mailShell";
import { displayName } from "@/lib/server/names";
import { normalize } from "@/lib/dash/format";

const RANGES = {
  "<50": "moins de 50 invités",
  "50-100": "entre 50 et 100 invités",
  "100-150": "entre 100 et 150 invités",
  "150-200": "entre 150 et 200 invités",
  ">200": "plus de 200 invités",
};

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function joinFr(items) {
  if (items.length < 2) return items[0] || "";
  return `${items.slice(0, -1).join(", ")} et ${items[items.length - 1]}`;
}

// « Parents de Léa » écrit à Léa : « tes parents » ; à Thomas : « les parents de Léa ». L'onboarding écrit
// « Parents de Astrid » : l'élision se refait ici devant une voyelle (« les parents d’Astrid »).
export function memberLabel(member, me) {
  const m = /^parents\s+(?:de\s+|d['’]\s*)(.+)$/i.exec(String(member.display_name || "").trim());
  if (!m) return { label: displayName(member.display_name), plural: false };
  const of = m[1].trim();
  if (normalize(of) === normalize(me)) return { label: "tes parents", plural: true };
  return { label: `les parents ${/^[aeiouy]/.test(normalize(of)) ? "d’" : "de "}${displayName(of)}`, plural: true };
}

// 25 000 € (espace insécable fine en HTML, espace simple dans le texte)
const euros = (n, html) => {
  const s = Math.round(Number(n)).toLocaleString("fr-FR").replace(/\s/g, " ");
  return html ? `${s.replace(/ /g, "&nbsp;")}&nbsp;€` : `${s} €`;
};

const hello = (firstName) => (firstName ? `Bonjour ${firstName}` : "Bonjour");

// Lien vers l'appli avec la campagne du mail : PostHog le lit à l'arrivée, si la personne a accepté les cookies
export const campagneDe = (etape) => `demarrage-${etape}`;
const linkTo = (origin, path, etape, hash = "") => `${origin}${path}?utm_source=mail&utm_medium=email&utm_campaign=${campagneDe(etape)}${hash}`;

// Titre de chaque mail, repris dans le planning du pilotage (Couples › Funnel)
export const TITRES = {
  invites: "Importe ta liste d’invités",
  equipe: "Invite les autres organisateurs",
  budget: "Complète ton budget",
  stan: "Le mot de Stan",
};

// ctx : { firstName, partnerName, brief: { guests }, guestCount, team: [membres sans accès], members, budgetTotal, weddingDate, createdAt, now }
const ETAPES = {
  invites(ctx) {
    const range = RANGES[ctx.brief?.guests];
    const n = ctx.guestCount || 0;
    const opening = range
      ? `tu prévois ${range} et ta liste n’en compte encore ${n === 0 ? "aucun" : n === 1 ? "qu’un" : `que ${n}`}.`
      : n === 0
        ? "ta liste d’invités est encore vide."
        : `ta liste ne compte encore ${n === 1 ? "qu’un invité" : `que ${n} invités`}.`;
    const parents = (ctx.members || []).some((m) => m.role === "parents");
    const partner = ctx.partnerName;
    const others = partner && parents
      ? `Si ${partner} ou vos parents ont commencé la leur, importe-les aussi : Merry les réunit en une seule liste et te signale les doublons.`
      : partner
        ? `Si ${partner} a commencé la sienne, importe-la aussi : Merry réunit les deux listes et te signale les doublons.`
        : "Si d’autres listes circulent, importe-les aussi : Merry les réunit en une seule liste et te signale les doublons.";
    return {
      subject: "Fini les listes d’invités sur trois Excel différents",
      preheader: "Importe les listes que tu as déjà, Merry les réunit et repère les doublons.",
      title: TITRES.invites,
      paras: [`${hello(ctx.firstName)}, ${opening} Si elle existe déjà, dans un fichier Excel ou sur une feuille, tu peux l’importer telle quelle ; une photo suffit.`, others],
      image: "invites.png",
      button: "Importer ma liste",
      link: linkTo(ctx.origin, "/dashboard/invites/importer", "invites"),
      aside: "Tu peux aussi ajouter tes invités un par un, ou partager ton formulaire pour qu’ils remplissent eux-mêmes leurs coordonnées.",
    };
  },

  equipe(ctx) {
    const entries = (ctx.team || []).map((m) => memberLabel(m, ctx.firstName));
    const names = joinFr(entries.map((e) => e.label));
    const many = entries.length > 1;
    const plural = many || entries[0]?.plural;
    const access = many ? "mais aucun d’eux n’a encore accès à ton espace" : `mais ${plural ? "n’ont" : "n’a"} pas encore accès à ton espace`;
    const who = many ? "chacun peut ajouter ses" : plural ? `${names} peuvent ajouter leurs` : `${names} peut ajouter ses`;
    return {
      subject: "Fini les boucles WhatsApp à rallonge",
      preheader: `${cap(names)} ${plural ? "n’ont" : "n’a"} pas encore accès à ton espace Merry.`,
      title: TITRES.equipe,
      paras: [
        `${hello(ctx.firstName)}, tu as indiqué que ${names} ${plural ? "participent" : "participe"} à l’organisation du mariage, ${access}.`,
        `Avec un accès, ${who} propres invités et suivre l’avancement des préparatifs, sans que tu aies à tout relayer dans le groupe WhatsApp.`,
      ],
      image: "equipe.png",
      button: "Inviter les organisateurs",
      link: linkTo(ctx.origin, "/dashboard", "equipe", "#organisateurs"),
      aside: "Si tu n’as pas leur adresse mail, tu peux leur envoyer le lien d’invitation par SMS ou sur WhatsApp.",
    };
  },

  budget(ctx) {
    const members = ctx.members || [];
    const couple = members.some((m) => m.role === "couple" && m.id !== ctx.me) || Boolean(ctx.partnerName);
    const parts = [];
    if (couple) parts.push("la vôtre");
    for (const m of members.filter((x) => x.role === "parents")) {
      const { label } = memberLabel(m, ctx.firstName);
      parts.push(label.startsWith("les ") ? `celle des ${label.slice(4)}` : `celle de ${label}`);
    }
    const who = parts.length > 1 ? `la part de chacun, ${joinFr(parts)}` : couple ? "ce que chacun de vous deux finance" : "";
    const steps = [ctx.budgetTotal ? null : "le fixer", who ? `indiquer ${who}` : null].filter(Boolean);
    const todo = steps.length ? `Il reste à ${steps.join(", à ")}, puis à ajouter tes premières dépenses avec leurs échéances.` : "Il reste à ajouter tes premières dépenses avec leurs échéances.";
    const opening = ctx.budgetTotal ? `tu as prévu un budget de ${euros(ctx.budgetTotal)}.` : "ton budget n’a pas encore de montant prévu.";
    return {
      subject: "Fini le budget sur des bouts de papier",
      preheader: "Indique la part de chacun et ajoute tes premières dépenses.",
      title: TITRES.budget,
      paras: [`${hello(ctx.firstName)}, ${opening} ${todo}`, `Tu vois ensuite${who ? ", pour chacun," : ""} ce qui a déjà été payé et ce qu’il reste à régler.`],
      image: "budget.png",
      button: "Compléter mon budget",
      link: linkTo(ctx.origin, "/dashboard/budget", "budget"),
      aside: "Si tu as déjà un devis ou une facture, tu peux l’ajouter directement comme dépense.",
    };
  },
};

export const STEPS = Object.keys(ETAPES);

// 25 000 € reste lisible : le texte des paragraphes est échappé, puis les montants retrouvent leurs espaces insécables
const htmlText = (s) => esc(s).replace(/(\d) (\d{3})/g, "$1&nbsp;$2").replace(/ €/g, "&nbsp;€").replace(/ ([;:?!])/g, "&nbsp;$1");

export function demarrageMail(etape, ctx) {
  const m = ETAPES[etape](ctx);
  const assets = `${ctx.origin}/mail`;
  const text = [
    m.title,
    ...m.paras,
    `${m.button} : ${m.link}`,
    m.aside,
    "À bientôt,\nStan de Merry",
    `Ne plus recevoir ces conseils : ${ctx.unsub}`,
  ].join("\n\n");

  const hero = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#bfe9a6;border-radius:20px;border-collapse:separate"><tr><td style="padding:32px 28px">
<img src="${esc(assets)}/merry.png" width="145" height="30" alt="Merry" style="display:block;border:0;width:145px;height:30px">
<h1 style="margin:32px 0 0;font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:32px;line-height:1.08;letter-spacing:-0.01em;color:#1c1c1a">${esc(m.title)}</h1>
${m.paras.map((p) => `<p style="margin:14px 0 0;font-size:16px;line-height:1.5;color:#1c1c1a">${htmlText(p)}</p>`).join("\n")}
</td></tr></table>`;

  const image = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;background:#f6f5f1;border-radius:20px;border-collapse:separate"><tr><td style="padding:20px 24px">
<img src="${esc(assets)}/demarrage/${m.image}" width="480" alt="" style="display:block;border:0;width:100%;max-width:480px;height:auto">
</td></tr></table>`;

  const cta = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px"><tr><td align="center">
<a href="${esc(m.link)}" style="display:inline-block;width:300px;max-width:100%;box-sizing:border-box;background:#1c1c1a;color:#ffffff;text-align:center;text-decoration:none;padding:17px 0;border-radius:999px;font-weight:700;font-size:15px;line-height:18px">${esc(m.button)}</a>
</td></tr></table>`;

  const footer = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;background:#f6f5f1;border-top:1px solid #ecebe6"><tr><td style="padding:16px;font-size:12px;color:#9c9a90;line-height:1.6">Merry · withmerry.com<br>Tu reçois ce mail car tu as créé ton mariage sur Merry.<br><a href="${esc(ctx.unsub)}" style="color:#6b6a63;text-decoration:underline">Ne plus recevoir ces conseils</a></td></tr></table>`;

  const body = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1c1c1a;max-width:560px">
${hero}
${image}
${cta}
<p style="margin:20px 0 0;font-size:14px;line-height:1.6;color:#6b6a63">${htmlText(m.aside)}</p>
<p style="margin:24px 0 0;font-size:15px;line-height:1.6">À bientôt,<br><strong>Stan</strong> de Merry</p>
${footer}
</div>`;

  return { subject: m.subject, preheader: m.preheader, text, html: mailShell({ title: m.subject, preheader: m.preheader, body }) };
}

// « mardi » dans la semaine écoulée, « le 3 novembre » au-delà
function createdWhen(createdAt, now) {
  const days = (now - new Date(createdAt)) / 86400000;
  const opts = { timeZone: "Europe/Paris" };
  return days < 6.5 ? new Date(createdAt).toLocaleDateString("fr-FR", { ...opts, weekday: "long" }) : `le ${new Date(createdAt).toLocaleDateString("fr-FR", { ...opts, day: "numeric", month: "long" })}`;
}

const longDate = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });

// V54 : le mot de Stan, écrit comme un mail personnel (aucune mise en page, Arial du client). Remplace le mail
// budget au troisième envoi quand rien n'a bougé. `rdv` : lien de prise de rendez-vous, facultatif.
export function stanMail(ctx) {
  const opening = `Tu as créé ton espace Merry ${createdWhen(ctx.createdAt, ctx.now)} pour préparer ton mariage${ctx.weddingDate ? ` du ${longDate(ctx.weddingDate)}` : ""}. Si quelque chose t’a manqué pour commencer, ou si un import n’a pas fonctionné, tu peux répondre directement à ce mail.`;
  const call = ctx.rdv ? "Si tu préfères en parler de vive voix, tu peux aussi réserver un appel de quinze minutes :" : "";
  const subject = "Ton mariage sur Merry";
  const text = [`${hello(ctx.firstName)},`, opening, ...(call ? [`${call} ${ctx.rdv}`] : []), "Bonne soirée,\nStan\nFondateur de Merry", `--\nNe plus recevoir ces conseils : ${ctx.unsub}`].join("\n\n");
  const p = (inner) => `<p style="margin:0 0 16px">${inner}</p>`;
  const body = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14.5px;line-height:1.6;color:#1c1c1a">
${p(`${esc(hello(ctx.firstName))},`)}
${p(htmlText(opening))}
${call ? p(`${htmlText(call)} <a href="${esc(ctx.rdv)}" style="color:#1a56c4">${esc(ctx.rdv.replace(/^https?:\/\//, ""))}</a>`) : ""}
${p("Bonne soirée,<br>Stan<br>Fondateur de Merry")}
<p style="margin:28px 0 0;font-size:12px;color:#9c9a90">--<br>Ne plus recevoir ces conseils&nbsp;: <a href="${esc(ctx.unsub)}" style="color:#9c9a90">withmerry.com/desinscription</a></p>
</div>`;
  return { subject, preheader: "", text, html: mailShell({ title: subject, body }) };
}

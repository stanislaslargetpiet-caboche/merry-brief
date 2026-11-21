// Mails de démarrage des prestataires (D-378, canvas page « 7 - mails », V66 à V68) : photos, tarifs, calendrier.
// Fonctions pures, sans base : le choix du mail et les données viennent de lib/server/demarrageProJob.js. Même
// gabarit que les mails de démarrage des couples (lib/server/demarrageMail.js), au tu (D-124), signé Stan de Merry.
// Promesses relues dans le code le 20 nov. 2026 : 3 photos au moins (app/pro/fiche), le prix le plus bas devient le
// « À partir de » des couples (trigger pro_formulas_price), le brouillon de réponse lit le calendrier
// (app/api/pro/brouillon), l'option qui expire est rappelée deux jours avant (V32, lib/server/mailJobs.js).

import { esc, mailShell } from "@/lib/server/mailShell";

export const PHOTOS_MIN = 3;

// Titre de chaque mail, repris par les tests et le pilotage
export const TITRES = {
  photos: "Une fiche complète en trois photos",
  tarifs: "Ton prix, visible avant le premier message",
  calendrier: "Ton calendrier, lu à chaque demande",
};

export const campagneDe = (etape) => `demarrage-pro-${etape}`;
const linkTo = (origin, path, etape, hash = "") => `${origin}${path}?utm_source=mail&utm_medium=email&utm_campaign=${campagneDe(etape)}${hash}`;

const fiche = (name) => (name ? `ta fiche ${name}` : "ta fiche");
const NOMBRES = ["aucune photo", "qu’une photo", "que deux photos"];

// ctx : { origin, unsub, vendorName, category, photoCount }
const ETAPES = {
  photos(ctx) {
    const n = Math.max(0, Math.min(ctx.photoCount || 0, PHOTOS_MIN - 1));
    const subject = n === 0 ? "Fini la fiche sans photo" : n === 1 ? "Fini la fiche avec une seule photo" : "Fini la fiche avec deux photos seulement";
    const has = n === 0 ? "Ta fiche n’en a encore aucune" : n === 1 ? "Ta fiche n’en a encore qu’une" : "Ta fiche n’en a encore que deux";
    return {
      subject,
      preheader: `${has}. Il en faut au moins trois.`,
      title: TITRES.photos,
      paras: [
        `Bonjour, ${fiche(ctx.vendorName)} n’a encore ${NOMBRES[n]}, et il en faut au moins trois pour qu’elle soit complète.`,
        "La première photo sert de couverture ; tu changes l’ordre en les faisant glisser.",
      ],
      image: "photos.png",
      button: "Ajouter mes photos",
      link: linkTo(ctx.origin, "/pro/fiche", "photos", "#photos"),
      aside: "Tu peux les ajouter depuis ton ordinateur ou ton téléphone.",
    };
  },

  tarifs(ctx) {
    return {
      subject: "Fini le « c’est combien ? » en premier message",
      preheader: "Ta fiche n’affiche encore aucun tarif. Une formule suffit.",
      title: TITRES.tarifs,
      paras: [
        `Bonjour, ${fiche(ctx.vendorName)} n’affiche encore aucun tarif. Sans prix, le premier message d’un couple te demande presque toujours le tien.`,
        "Une formule suffit pour commencer : un forfait, un prix par invité ou à la nuit, en haute et en basse saison si tu en as. Le prix le plus bas devient le « À partir de » que les couples voient sur ta fiche.",
      ],
      image: "tarifs.png",
      button: "Ajouter une formule",
      link: linkTo(ctx.origin, "/pro/tarifs", "tarifs"),
      aside: ctx.category === "lieu" ? "Tu pourras ensuite ajouter des options, comme le brunch du lendemain." : "Tu pourras ensuite ajouter des options à tes formules.",
    };
  },

  calendrier(ctx) {
    return {
      subject: "Fini les demandes pour une date déjà prise",
      preheader: "Ton calendrier est vide. Indique les dates réservées ou en option.",
      title: TITRES.calendrier,
      paras: [
        "Bonjour, ton calendrier sur Merry est encore vide. Indique les dates déjà réservées, celles que tu as posées en option et celles que tu bloques.",
        "Quand une demande arrive, Merry regarde ton calendrier et prépare ta réponse : la date est libre, ou elle est prise et tu proposes d’en parler.",
      ],
      image: "calendrier.png",
      button: "Remplir mon calendrier",
      link: linkTo(ctx.origin, "/pro/tarifs", "calendrier"),
      aside: "Une option posée expire à la date que tu choisis ; Merry te prévient deux jours avant.",
    };
  },
};

export const STEPS = Object.keys(ETAPES);

const htmlText = (s) => esc(s).replace(/ ([;:?!»])/g, "&nbsp;$1").replace(/« /g, "«&nbsp;");

export function demarrageProMail(etape, ctx) {
  const m = ETAPES[etape](ctx);
  const assets = `${ctx.origin}/mail`;
  const text = [m.title, ...m.paras, `${m.button} : ${m.link}`, m.aside, "À bientôt,\nStan de Merry", `Ne plus recevoir ces conseils : ${ctx.unsub}`].join("\n\n");

  const hero = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#bfe9a6;border-radius:20px;border-collapse:separate"><tr><td style="padding:32px 28px">
<img src="${esc(assets)}/merry.png" width="145" height="30" alt="Merry" style="display:block;border:0;width:145px;height:30px">
<h1 style="margin:32px 0 0;font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:32px;line-height:1.08;letter-spacing:-0.01em;color:#1c1c1a">${esc(m.title)}</h1>
${m.paras.map((p) => `<p style="margin:14px 0 0;font-size:16px;line-height:1.5;color:#1c1c1a">${htmlText(p)}</p>`).join("\n")}
</td></tr></table>`;

  const image = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;background:#f6f5f1;border-radius:20px;border-collapse:separate"><tr><td style="padding:20px 24px">
<img src="${esc(assets)}/demarrage/pro-${m.image}" width="480" alt="" style="display:block;border:0;width:100%;max-width:480px;height:auto">
</td></tr></table>`;

  const cta = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px"><tr><td align="center">
<a href="${esc(m.link)}" style="display:inline-block;width:300px;max-width:100%;box-sizing:border-box;background:#1c1c1a;color:#ffffff;text-align:center;text-decoration:none;padding:17px 0;border-radius:999px;font-weight:700;font-size:15px;line-height:18px">${esc(m.button)}</a>
</td></tr></table>`;

  const why = ctx.vendorName ? `Tu reçois ce mail car tu gères la fiche ${esc(ctx.vendorName)} sur Merry.` : "Tu reçois ce mail car tu gères une fiche sur Merry.";
  const footer = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;background:#f6f5f1;border-top:1px solid #ecebe6"><tr><td style="padding:16px;font-size:12px;color:#9c9a90;line-height:1.6">Merry · withmerry.com<br>${why}<br><a href="${esc(ctx.unsub)}" style="color:#6b6a63;text-decoration:underline">Ne plus recevoir ces conseils</a></td></tr></table>`;

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

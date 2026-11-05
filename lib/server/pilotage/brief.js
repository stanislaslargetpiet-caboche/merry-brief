// Mail quotidien de 8 h (Paris) à Stan : ce qui demande un coup d'œil, puis les chiffres d'hier comparés à la
// veille, depuis les mêmes sources que la page de pilotage. Fonction pure (données collectées sur 2 jours en
// entrée, objet mail en sortie), testée dans tests/pilotageBrief.test.js. Tableaux et styles en ligne : Gmail
// ignore flex et grid.

import { buildSante } from "@/lib/pilotage/sante";
import { esc, logoBlock } from "@/lib/server/mailShell";
import { alignSeries, dayList, fmtDuration, fmtInt } from "./shape";

const TONE = {
  bad: { label: "Alerte", bg: "#fde0de", ink: "#b42318" },
  warn: { label: "À voir", bg: "#ffe6cc", ink: "#8a4b0f" },
  neutral: { label: "Info", bg: "#efeeea", ink: "#4d4c46" },
};
const ORDER = { bad: 0, warn: 1, neutral: 2 };

export const PILOTAGE_URL = "https://app.withmerry.com/pilotage";

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Les alertes du matin : les erreurs et les points à voir, plus les sources qu'on ne sait pas lire (rien d'autre
// n'est dit : les « OK » et les infos courantes restent sur la page)
export function morningAlerts(sante) {
  return sante
    .filter((s) => s.tone === "bad" || s.tone === "warn" || (s.tone === "neutral" && /non lue?s?\b/i.test(s.titre)))
    .sort((a, b) => ORDER[a.tone] - ORDER[b.tone]);
}

// Chiffres d'hier et d'avant-hier : les séries par jour finissent par aujourd'hui (heure de Paris)
export function yesterdayRows(data, now = new Date()) {
  const sb = data.supabase;
  const ph = data.posthog?.disponible ? data.posthog : null;
  const rs = data.resend?.disponible ? data.resend : null;
  const gsc = data.google?.disponible ? data.google : null;
  const jours = sb?.series?.length ? sb.series.map((r) => r.jour) : dayList(2, now);
  const n = jours.length;
  const out = [];
  const add = (name, y, p, fmt = fmtInt) => {
    if (y === undefined || y === null) return;
    out.push({ name, status: p === undefined || p === null ? fmt(y) : `${fmt(y)} · avant-hier ${fmt(p)}` });
  };
  const pair = (rows, key) => [rows[n - 2]?.[key], rows[n - 3]?.[key]];

  if (sb?.series?.length) {
    const rows = sb.series;
    for (const [name, key] of [["Nouveaux comptes", "inscriptions"], ["Mariages créés", "mariages"], ["Demandes de devis", "demandes"], ["Messages des couples", "messages_couple"], ["Réponses des prestataires", "messages_pro"], ["Réponses RSVP", "reponses_rsvp"]]) {
      const [y, p] = pair(rows, key);
      add(name, y, p);
    }
    if (sb.totaux?.comptes_actifs !== undefined) add("Comptes connectés, hier et ce matin", sb.totaux.comptes_actifs);
  }
  if (ph) {
    const site = alignSeries(jours, ph.site?.series, ["visiteurs", "pages", "sessions"]);
    const app = alignSeries(jours, ph.app?.series, ["sessions", "pages", "duree"]);
    add("Visiteurs du site", ...pair(site, "visiteurs"));
    add("Sessions dans l'appli", ...pair(app, "sessions"));
    const [dy, dp] = pair(app, "duree");
    if (dy) add("Durée moyenne d'une session", Math.round(dy), dp ? Math.round(dp) : null, fmtDuration);
  }
  if (rs) add("Mails envoyés, hier et ce matin", rs.envoyes);
  if (gsc?.sitemaps?.[0]) add("Pages indexées par Google", `${fmtInt(gsc.sitemaps[0].indexes)} sur ${fmtInt(gsc.sitemaps[0].soumis)}`, null, (v) => v);
  return out;
}

export function buildBrief(data, now = new Date()) {
  const sante = buildSante(data, 2);
  const alertes = morningAlerts(sante);
  const nbAlertes = alertes.filter((a) => a.tone !== "neutral").length;
  const date = cap(new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" }).format(now));
  const heading = nbAlertes ? `${nbAlertes} alerte${nbAlertes > 1 ? "s" : ""} ce matin` : "Rien d'anormal ce matin";
  const subject = `Merry · ${date.toLowerCase()} · ${nbAlertes ? `${nbAlertes} alerte${nbAlertes > 1 ? "s" : ""}` : "rien d'anormal"}`;
  const rows = yesterdayRows(data, now);

  const text = [
    `${heading}. ${date}.`,
    "",
    ...(alertes.length ? alertes.map((a) => `- ${TONE[a.tone].label} : ${a.titre}. ${a.detail}`.slice(0, 320)) : ["Aucune alerte sur les sources lues."]),
    "",
    ...(rows.length ? ["Hier :", ...rows.map((r) => `- ${r.name} : ${r.status}`), ""] : []),
    `Le détail : ${PILOTAGE_URL}`,
  ].join("\n");

  const alertBlock = alertes.length
    ? alertes
        .map(
          (a) =>
            `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;background:#f6f5f1;border-radius:20px;border-collapse:separate"><tr><td style="padding:14px 16px">
<span style="display:inline-block;padding:2px 10px;border-radius:999px;background:${TONE[a.tone].bg};color:${TONE[a.tone].ink};font-size:11px;font-weight:700">${TONE[a.tone].label}</span>
<div style="margin-top:6px;font-size:15px;font-weight:700;line-height:1.35">${esc(a.titre)}</div>
<div style="margin-top:2px;font-size:13px;color:#6b6a63;line-height:1.45">${esc(String(a.detail).slice(0, 260))}</div>
</td></tr></table>`,
        )
        .join("\n")
    : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f1;border-radius:20px;border-collapse:separate"><tr><td style="padding:14px 16px;font-size:15px"><span style="display:inline-block;padding:2px 10px;border-radius:999px;background:#dff3e1;color:#1f6b30;font-size:11px;font-weight:700">OK</span><div style="margin-top:6px;font-weight:700">Aucune alerte sur les sources lues.</div></td></tr></table>`;

  const rowsBlock = rows.length
    ? `<h2 style="margin:28px 0 10px;font-size:18px;font-weight:700">Hier</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f1;border-radius:20px;border-collapse:separate"><tr><td style="padding:6px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows
        .map((r, i) => `<tr><td style="padding:10px 0;font-size:14px;${i ? "border-top:1px solid #ecebe6" : ""}">${esc(r.name)}</td><td align="right" style="padding:10px 0;font-size:14px;font-weight:700;white-space:nowrap;${i ? "border-top:1px solid #ecebe6" : ""}">${esc(r.status)}</td></tr>`)
        .join("")}</table>
</td></tr></table>`
    : "";

  const body = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1c1c1a;max-width:560px">
${logoBlock}
<h1 style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:26px;line-height:1.15;color:#1c1c1a">${esc(heading)}</h1>
<p style="margin:0 0 20px;font-size:14px;color:#6b6a63">${esc(date)}</p>
${alertBlock}
${rowsBlock}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px"><tr><td align="center"><a href="${PILOTAGE_URL}" style="display:inline-block;background:#1c1c1a;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:700;font-size:15px">Ouvrir le pilotage</a></td></tr></table>
<p style="margin:24px 0 0;font-size:12px;color:#9c9a90;line-height:1.5">Merry · withmerry.com<br>Mail du pilotage de Merry, envoyé chaque matin vers 8 h.</p>
</div>`;

  return { subject, text, body, preheader: alertes[0] ? `${alertes[0].titre}` : "Aucune alerte sur les sources lues.", alertes: nbAlertes };
}

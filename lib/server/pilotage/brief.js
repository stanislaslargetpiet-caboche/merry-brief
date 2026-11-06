// Mail quotidien de 8 h (Paris) à Stan : ce qui demande un coup d'œil, puis les chiffres d'hier comparés à la
// veille, depuis les mêmes sources que la page de pilotage. Fonction pure (données collectées sur 2 jours en
// entrée, objet mail en sortie), testée dans tests/pilotageBrief.test.js. Tableaux et styles en ligne : Gmail
// ignore flex et grid.

import { buildSante } from "@/lib/pilotage/sante";
import { esc, logoBlock } from "@/lib/server/mailShell";
import { alignSeries, dayList, delta, fmtAgo, fmtDateTime, fmtDuration, fmtEur, fmtInt } from "./shape";

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

// Coûts du registre (section Coûts du pilotage) : le mois en cours et les 30 derniers jours, avec l'équivalent par
// jour. Rien tant que le registre est vide ou non lu.
export function costRows(data, now = new Date()) {
  const c = data.couts;
  if (!c?.disponible || !c.lignes) return [];
  const month = new Intl.DateTimeFormat("fr-FR", { month: "long", timeZone: "Europe/Paris" }).format(now);
  return [
    { name: `Dépensé en ${month}`, status: `${fmtEur(c.mois)} · ${fmtEur(c.mois_par_jour)} par jour` },
    { name: "30 derniers jours", status: `${fmtEur(c.trente_jours)} · ${fmtEur(c.trente_par_jour)} par jour` },
  ];
}


// Pastels du design system (citron, beurre, anis, pistache) : fond des tuiles et des titres de tableau
const PASTEL = {
  citron: { bg: "#fffdb8", ink: "#574e00" },
  beurre: { bg: "#fff5cc", ink: "#6b5300" },
  anis: { bg: "#f5fcd2", ink: "#4e5a00" },
  pistache: { bg: "#e6f7dc", ink: "#2f5a1a" },
};

// Qui s'est connecté sur les 24 dernières heures, et les derniers comptes créés (section Utilisateurs du pilotage)
export function userRows(data, now = new Date()) {
  const u = data.utilisateurs;
  if (!u?.utilisateurs) return null;
  const since = now.getTime() - 24 * 3600 * 1000;
  const logged = u.utilisateurs.filter((x) => x.derniere_connexion && Date.parse(x.derniere_connexion) >= since);
  return {
    connectes: logged,
    comptes: [...u.utilisateurs].sort((a, b) => Date.parse(b.cree) - Date.parse(a.cree)).slice(0, 6),
    tuiles: [
      { label: "Connectés sur 24 h", now: u.fenetre?.connectes?.n, prev: u.fenetre?.connectes?.prec, tone: "pistache" },
      { label: "Nouveaux comptes", now: u.fenetre?.comptes_crees?.n, prev: u.fenetre?.comptes_crees?.prec, tone: "citron" },
      { label: "Invités ajoutés", now: u.fenetre?.invites_ajoutes?.n, prev: u.fenetre?.invites_ajoutes?.prec, tone: "anis" },
      { label: "Demandes de devis", now: u.fenetre?.devis?.n, prev: u.fenetre?.devis?.prec, tone: "beurre" },
    ].filter((t) => typeof t.now === "number"),
    bilan: u.totaux ? `${fmtInt(u.totaux.mariages)} mariages : ${fmtInt(u.totaux.avec_site)} ont un site (${fmtInt(u.totaux.avec_site_publie)} publié${u.totaux.avec_site_publie > 1 ? "s" : ""}), ${fmtInt(u.totaux.avec_invites)} ont au moins un invité, ${fmtInt(u.totaux.avec_devis)} ont demandé un devis.` : null,
  };
}

const siteLabel = (u) => (u.site === "publié" ? "Site publié" : u.site === "brouillon" ? "Site brouillon" : "Pas de site");
const who = (u) => u.couple || "sans mariage";

function tileHtml(t, side) {
  const c = PASTEL[t.tone];
  const d = typeof t.prev === "number" ? delta(t.now, t.prev) : null;
  const sub = d ? (d.sens === "stable" ? "= vs 24 h avant" : `${d.diff > 0 ? "+" : "−"}${fmtInt(Math.abs(d.diff))} vs 24 h avant`) : "";
  const col = d?.sens === "hausse" ? "#1f6b30" : d?.sens === "baisse" ? "#b42318" : "#6b5300";
  return `<td width="50%" valign="top" style="padding:${side === "left" ? "0 6px 12px 0" : "0 0 12px 6px"}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${c.bg};border-radius:20px;border-collapse:separate"><tr><td style="padding:14px 16px">
<div style="font-size:30px;font-weight:700;line-height:1.1;color:#1c1c1a">${esc(fmtInt(t.now))}</div>
<div style="margin-top:2px;font-size:13px;font-weight:700;color:${c.ink}">${esc(t.label)}</div>
<div style="margin-top:2px;font-size:12px;color:${col}">${esc(sub)}&nbsp;</div>
</td></tr></table></td>`;
}

function tilesHtml(tuiles) {
  if (!tuiles.length) return "";
  const rows = [];
  for (let i = 0; i < tuiles.length; i += 2) rows.push(`<tr>${tileHtml(tuiles[i], "left")}${tuiles[i + 1] ? tileHtml(tuiles[i + 1], "right") : '<td width="50%"></td>'}</tr>`);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 0">${rows.join("")}</table>`;
}

// Tableau à colonnes : titre en pastille colorée, entêtes en petites capitales, lignes séparées d'un filet
function gridHtml({ title, tone, cols, rows, empty, foot }) {
  const c = PASTEL[tone];
  const head = `<h2 style="margin:28px 0 10px;font-size:18px;font-weight:700"><span style="display:inline-block;padding:4px 14px;border-radius:999px;background:${c.bg};color:#1c1c1a">${esc(title)}</span></h2>`;
  if (!rows.length) return `${head}<div style="font-size:14px;color:#6b6a63">${esc(empty)}</div>`;
  const hasHead = cols.some((k) => k.label);
  const th = cols.map((k) => `<td align="${k.right ? "right" : "left"}" style="padding:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#6b6a63;white-space:nowrap">${esc(k.label)}</td>`).join("");
  const body = rows
    .map((r, i) => `<tr>${cols.map((k) => `<td align="${k.right ? "right" : "left"}" style="padding:9px ${k.right ? "0 9px 8px" : "8px 9px 0"};font-size:14px;${k.bold ? "font-weight:700;" : ""}${i ? "border-top:1px solid #ecebe6;" : hasHead ? "border-top:1px solid #d9d7cf;" : ""}${k.right ? "white-space:nowrap" : ""}">${esc(k.get(r))}</td>`).join("")}</tr>`)
    .join("");
  return `${head}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f1;border-radius:20px;border-collapse:separate"><tr><td style="padding:14px 16px 8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${hasHead ? `<tr>${th}</tr>` : ""}${body}</table>${foot ? `<div style="padding:0 0 8px;font-size:12px;color:#6b6a63">${esc(foot)}</div>` : ""}</td></tr></table>`;
}

export function buildBrief(data, now = new Date()) {
  const sante = buildSante(data, 2);
  const alertes = morningAlerts(sante);
  const nbAlertes = alertes.filter((a) => a.tone !== "neutral").length;
  const date = cap(new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" }).format(now));
  const heading = nbAlertes ? `${nbAlertes} alerte${nbAlertes > 1 ? "s" : ""} ce matin` : "Rien d'anormal ce matin";
  const subject = `Merry · ${date.toLowerCase()} · ${nbAlertes ? `${nbAlertes} alerte${nbAlertes > 1 ? "s" : ""}` : "rien d'anormal"}`;
  const rows = yesterdayRows(data, now);
  const costs = costRows(data, now);
  const users = userRows(data, now);
  const MAX_CONNECTED = 8;
  const shownConnected = users ? users.connectes.slice(0, MAX_CONNECTED) : [];
  const moreConnected = users ? users.connectes.length - shownConnected.length : 0;

  const text = [
    `${heading}. ${date}.`,
    "",
    ...(alertes.length ? alertes.map((a) => `- ${TONE[a.tone].label} : ${a.titre}. ${a.detail}`.slice(0, 320)) : ["Aucune alerte sur les sources lues."]),
    "",
    ...(users
      ? [
          ...(users.tuiles.length ? ["24 h :", ...users.tuiles.map((t) => `- ${t.label} : ${fmtInt(t.now)}${typeof t.prev === "number" ? ` (24 h avant ${fmtInt(t.prev)})` : ""}`), ""] : []),
          `Connectés sur 24 h (${users.connectes.length}) :`,
          ...(shownConnected.length ? shownConnected.map((x) => `- ${x.email} · ${who(x)} · ${fmtAgo(x.derniere_connexion, now.getTime())} · ${siteLabel(x)}, ${x.invites ?? 0} invité(s)`) : ["- personne"]),
          ...(moreConnected > 0 ? [`- et ${moreConnected} autre(s)`] : []),
          "",
          "Derniers comptes :",
          ...users.comptes.map((x) => `- ${x.email} · ${who(x)} · créé ${fmtAgo(x.cree, now.getTime())}`),
          ...(users.bilan ? ["", users.bilan] : []),
          "",
        ]
      : []),
    ...(costs.length ? ["Coûts :", ...costs.map((r) => `- ${r.name} : ${r.status}`), ""] : []),
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

  const nameStatus = [{ label: "", get: (r) => r.name }, { label: "", right: true, bold: true, get: (r) => r.status }];
  const costsBlock = costs.length ? gridHtml({ title: "Coûts", tone: "anis", cols: nameStatus, rows: costs }) : "";
  const rowsBlock = rows.length ? gridHtml({ title: "Hier", tone: "beurre", cols: nameStatus, rows }) : "";
  const usersBlock = users
    ? tilesHtml(users.tuiles) +
      gridHtml({
        title: `Connectés sur 24 h · ${users.connectes.length}`,
        tone: "pistache",
        cols: [
          { label: "Utilisateur", bold: true, get: (x) => x.email },
          { label: "Couple", get: (x) => who(x) },
          { label: "Dernière connexion", right: true, get: (x) => fmtAgo(x.derniere_connexion, now.getTime()) },
        ],
        rows: shownConnected,
        empty: "Personne ne s'est connecté sur les dernières 24 heures.",
        foot: moreConnected > 0 ? `et ${moreConnected} autre(s) dans le pilotage` : users.bilan,
      }) +
      gridHtml({
        title: "Derniers comptes créés",
        tone: "citron",
        cols: [
          { label: "Adresse", bold: true, get: (x) => x.email },
          { label: "Couple", get: (x) => who(x) },
          { label: "Créé", right: true, get: (x) => fmtDateTime(x.cree) },
        ],
        rows: users.comptes,
        empty: "Aucun compte.",
      })
    : "";

  const body = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1c1c1a;max-width:600px">
${logoBlock}
<h1 style="margin:0 0 4px;font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:26px;line-height:1.15;color:#1c1c1a">${esc(heading)}</h1>
<p style="margin:0 0 20px;font-size:14px;color:#6b6a63">${esc(date)}</p>
${alertBlock}
${usersBlock}
${costsBlock}
${rowsBlock}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px"><tr><td align="center"><a href="${PILOTAGE_URL}" style="display:inline-block;background:#1c1c1a;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:700;font-size:15px">Ouvrir le pilotage</a></td></tr></table>
<p style="margin:24px 0 0;font-size:12px;color:#9c9a90;line-height:1.5">Merry · withmerry.com<br>Mail du pilotage de Merry, envoyé chaque matin vers 8 h.</p>
</div>`;

  return { subject, text, body, preheader: alertes[0] ? `${alertes[0].titre}` : "Aucune alerte sur les sources lues.", alertes: nbAlertes };
}

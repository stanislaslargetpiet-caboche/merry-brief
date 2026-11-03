// Mail quotidien à Stan (midi) : activité du dashboard et du site vitrine sur les dernières 24h.
// Appelée une fois par jour par une routine planifiée (claude.ai/code/routines), jamais par le navigateur.
// Nécessite DAILY_DIGEST_SECRET (en-tête x-cron-key), SUPABASE_SERVICE_ROLE_KEY, POSTHOG_PERSONAL_API_KEY
// et RESEND_API_KEY côté serveur (Vercel > Settings > Environment Variables) ; sans l'une de ces clés, la
// route répond 501 plutôt que d'envoyer un mail à moitié rempli.
//
// Connexions comptées via Supabase (auth.admin, last_sign_in_at), pas PostHog : PostHog ne voit que les
// personnes qui ont accepté le bandeau cookies (cf. notes/journal.md, 3 nov. 2026), donc sous-compte.
// Tout le reste (temps passé, pages, erreurs, trafic du site) vient de PostHog, seule source qui le mesure.

import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const POSTHOG_PROJECT_ID = "321035";
const POSTHOG_API = "https://eu.posthog.com";
const TO = "stanislas.largetpiet@gmail.com";
const FROM = process.env.MERRY_MAIL_FROM || "Merry <onboarding@resend.dev>";

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

async function hogql(query) {
  const key = process.env.POSTHOG_PERSONAL_API_KEY;
  const res = await fetch(`${POSTHOG_API}/api/projects/${POSTHOG_PROJECT_ID}/query/`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
  });
  if (!res.ok) throw new Error(`posthog_query_${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  return json.results || [];
}

// Connexions des dernières 24h : auth.admin (service_role), pas soumis au consentement cookies.
async function countLogins(admin) {
  const since = Date.now() - 24 * 3600 * 1000;
  let count = 0;
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const u of data.users) {
      if (u.last_sign_in_at && Date.parse(u.last_sign_in_at) >= since) count += 1;
    }
    if (data.users.length < 1000) break;
  }
  return count;
}

// Même logique que le cohort PostHog "Internal / Test users" (notes/journal.md, 3 nov. 2026) : on écarte le
// propre trafic de Stan et celui des agents (dev, localhost) des statistiques, sinon ils polluent les moyennes.
const NOT_INTERNAL = `
  (person.properties.email IS NULL OR person.properties.email NOT IN ('stanislas.largetpiet@gmail.com', 'largetstan@gmail.com'))
  AND (properties.$host IS NULL OR properties.$host NOT LIKE '%localhost%')
`;
// Domaine exact plutôt qu'un préfixe : un host inattendu (prévisualisation Vercel, etc.) est écarté des
// deux catégories plutôt que de polluer l'une d'elles.
const DASHBOARD_HOST = `properties.$host = 'app.withmerry.com'`;
const SITE_HOST = `properties.$host IN ('withmerry.com', 'www.withmerry.com')`;

async function gatherStats(admin) {
  const [logins, [dash], [[topPage, topPageViews] = []], [[exceptions]], [[rageClicks]], [[visitors, pageviews]], landing, [[bounceRate]]] =
    await Promise.all([
      countLogins(admin),
      hogql(`
        SELECT avg(duration), avg(pages) FROM (
          SELECT properties.$session_id AS sid,
                 dateDiff('second', min(timestamp), max(timestamp)) AS duration,
                 countIf(event = '$pageview') AS pages
          FROM events
          WHERE timestamp > now() - INTERVAL 1 DAY AND ${DASHBOARD_HOST} AND ${NOT_INTERNAL}
          GROUP BY sid
        )
      `),
      hogql(`
        SELECT properties.$pathname, count() AS n
        FROM events
        WHERE event = '$pageview' AND timestamp > now() - INTERVAL 1 DAY AND ${DASHBOARD_HOST} AND ${NOT_INTERNAL}
        GROUP BY properties.$pathname
        ORDER BY n DESC LIMIT 1
      `),
      hogql(`SELECT count() FROM events WHERE event = '$exception' AND timestamp > now() - INTERVAL 1 DAY AND ${DASHBOARD_HOST} AND ${NOT_INTERNAL}`),
      hogql(`SELECT count() FROM events WHERE event = '$rageclick' AND timestamp > now() - INTERVAL 1 DAY AND ${DASHBOARD_HOST} AND ${NOT_INTERNAL}`),
      hogql(`
        SELECT uniq(distinct_id), count()
        FROM events
        WHERE event = '$pageview' AND timestamp > now() - INTERVAL 1 DAY AND ${SITE_HOST} AND ${NOT_INTERNAL}
      `),
      hogql(`
        SELECT path, count() AS n FROM (
          SELECT properties.$session_id AS sid, argMin(properties.$pathname, timestamp) AS path
          FROM events
          WHERE event = '$pageview' AND timestamp > now() - INTERVAL 1 DAY AND ${SITE_HOST} AND ${NOT_INTERNAL}
          GROUP BY sid
        )
        GROUP BY path ORDER BY n DESC LIMIT 5
      `),
      hogql(`
        SELECT countIf(pages = 1) / count() FROM (
          SELECT properties.$session_id AS sid, countIf(event = '$pageview') AS pages
          FROM events
          WHERE timestamp > now() - INTERVAL 1 DAY AND ${SITE_HOST} AND ${NOT_INTERNAL}
          GROUP BY sid
        )
      `),
    ]);

  return {
    logins,
    avgDurationS: Math.round(dash?.[0] || 0),
    avgPages: Math.round((dash?.[1] || 0) * 10) / 10,
    topPage: topPage || null,
    topPageViews: topPageViews || 0,
    exceptions: exceptions || 0,
    rageClicks: rageClicks || 0,
    visitors: visitors || 0,
    pageviews: pageviews || 0,
    landing: landing.map(([path, n]) => ({ path, n })),
    bounceRate: Math.round((bounceRate || 0) * 100),
  };
}

function renderEmail(stats, dateLabel) {
  const bugAlert = stats.exceptions > 0 || stats.rageClicks > 0;
  const minutes = Math.round(stats.avgDurationS / 60);
  const duration = minutes >= 1 ? `${minutes} min` : `${stats.avgDurationS} s`;

  const rows = (items, fmt) => items.map((x) => `<li>${esc(fmt(x))}</li>`).join("");

  return `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
      <h2 style="margin-bottom:4px">Merry · activité du ${esc(dateLabel)}</h2>
      <p style="font-size:15px;color:#444">
        <strong>${stats.logins}</strong> connexion${stats.logins > 1 ? "s" : ""} ·
        <strong>${duration}</strong> en moyenne par session ·
        ${bugAlert ? "⚠️ anomalies à regarder" : "✅ rien d'anormal"}
      </p>

      <h3>Dashboard organisateurs</h3>
      <ul>
        <li>${stats.logins} connexion(s) sur 24h (Supabase)</li>
        <li>${duration} passées en moyenne par session, ${stats.avgPages} page(s) vue(s) en moyenne</li>
        <li>Page la plus consultée : ${stats.topPage ? `<code>${esc(stats.topPage)}</code> (${stats.topPageViews} vue${stats.topPageViews > 1 ? "s" : ""})` : "aucune donnée"}</li>
        <li>${stats.exceptions} erreur(s) détectée(s), ${stats.rageClicks} clic(s) de rage</li>
      </ul>

      <h3>Site vitrine</h3>
      <ul>
        <li>${stats.visitors} visiteur(s) unique(s), ${stats.pageviews} page(s) vue(s)</li>
        <li>Taux de rebond : ${stats.bounceRate}%</li>
        ${stats.landing.length ? `<li>Pages d'entrée les plus visitées :<ul>${rows(stats.landing, (x) => `${x.path} (${x.n})`)}</ul></li>` : ""}
      </ul>

      <p style="margin-top:24px"><a href="https://eu.posthog.com/project/321035">Voir le détail dans PostHog →</a></p>
    </div>
  `;
}

export async function POST(req) {
  const secret = process.env.DAILY_DIGEST_SECRET;
  if (!secret || req.headers.get("x-cron-key") !== secret) return Response.json({ error: "unauthorized" }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service || !process.env.POSTHOG_PERSONAL_API_KEY || !process.env.RESEND_API_KEY) {
    return Response.json({ error: "missing_config" }, { status: 501 });
  }

  const admin = createClient(url, service, { auth: { persistSession: false } });
  const stats = await gatherStats(admin);
  const dateLabel = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    body: JSON.stringify({
      from: FROM,
      to: [TO],
      subject: `Merry · activité du ${dateLabel}`,
      html: renderEmail(stats, dateLabel),
    }),
  });
  if (!res.ok) return Response.json({ error: "mail_failed", detail: (await res.text()).slice(0, 300) }, { status: 502 });

  return Response.json({ ok: true, stats });
}

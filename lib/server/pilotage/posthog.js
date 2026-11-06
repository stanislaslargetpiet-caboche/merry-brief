// Lecture de PostHog (projet « Merry », hébergement UE) pour la page de pilotage, par requêtes HogQL.
// Même convention que l'ancien brief quotidien (supprimé le 5 nov. 2026) : le trafic de Stan, des navigateurs
// pilotés par un programme (propriété `automatise`, posée par lib/analytics.js) et de localhost est écarté, le site
// et l'appli sont distingués par leur domaine exact. Les agents IA qui ne chargent pas le JavaScript (GPTBot,
// ClaudeBot…) n'entrent jamais dans ces chiffres : ils sont relevés à part par le middleware (événement `bot_hit`).
// Chaque requête est indépendante : une qui échoue remonte dans `erreurs` sans priver la page des autres.

import { exceptionTitle, replayUrl, templatePath } from "./shape";

const PROJECT_ID = process.env.POSTHOG_PROJECT_ID || "321035";
const API = process.env.POSTHOG_API_HOST || "https://eu.posthog.com";

const NOT_INTERNAL = `
  (person.properties.email IS NULL OR person.properties.email NOT IN ('stanislas.largetpiet@gmail.com', 'largetstan@gmail.com'))
  AND (properties.$host IS NULL OR properties.$host NOT LIKE '%localhost%')
  AND properties.automatise IS NULL
`;
const AGENTS_SITES = `properties.site IN ('withmerry.com', 'www.withmerry.com', 'app.withmerry.com')`;
// Le scanner Replay Vision relu par la page Bugs : son nom dans PostHog doit rester celui-ci
const SCANNER = "Bugs visibles";
const SCANNED = `event = '$recording_observed' AND properties.scanner_name = '${SCANNER}' AND coalesce(properties.recording_subject_email, '') NOT IN ('stanislas.largetpiet@gmail.com', 'largetstan@gmail.com')`;
const APP = `properties.$host = 'app.withmerry.com'`;
const SITE = `properties.$host IN ('withmerry.com', 'www.withmerry.com')`;

async function hogql(query, signal) {
  const key = process.env.POSTHOG_PERSONAL_API_KEY;
  const res = await fetch(`${API}/api/projects/${PROJECT_ID}/query/`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
    signal,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`posthog_${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  return json.results || [];
}

// Moteurs de recherche reconnus dans le domaine d'origine de la première page d'une session
const ENGINES = "google|bing|duckduckgo|ecosia|qwant|yahoo|brave|yandex|startpage";
const organicSessions = (since) => `
  SELECT properties.$session_id AS sid, min(timestamp) AS debut,
         argMin(properties.$referring_domain, timestamp) AS origine,
         argMin(properties.$pathname, timestamp) AS entree,
         countIf(event = '$pageview') AS pages
  FROM events
  WHERE event = '$pageview' AND timestamp > now() - INTERVAL ${since} DAY AND ${SITE} AND ${NOT_INTERNAL} AND properties.$session_id IS NOT NULL
  GROUP BY sid
  HAVING match(coalesce(origine, ''), '${ENGINES}')
`;

const sessionsOf = (host, since) => `
  SELECT properties.$session_id AS sid,
         min(timestamp) AS debut,
         dateDiff('second', min(timestamp), max(timestamp)) AS duree,
         countIf(event = '$pageview') AS pages
  FROM events
  WHERE timestamp > now() - INTERVAL ${since} DAY AND ${host} AND ${NOT_INTERNAL} AND properties.$session_id IS NOT NULL
  GROUP BY sid
`;

// Toutes les requêtes de la page, chacune nommée : `days` est la période courante, les séries couvrent 2 × days.
function queries(days) {
  const d2 = 2 * days;
  return {
    // Site vitrine, par jour : visiteurs, pages vues, sessions
    site_series: `
      SELECT toDate(timestamp) AS jour, uniq(distinct_id), count(), uniq(properties.$session_id)
      FROM events
      WHERE event = '$pageview' AND timestamp > now() - INTERVAL ${d2} DAY AND ${SITE} AND ${NOT_INTERNAL}
      GROUP BY jour ORDER BY jour
    `,
    // Agents IA lus par le middleware (événement bot_hit) : par jour, par famille, par page, par domaine
    agents_series: `
      SELECT toDate(timestamp) AS jour, count(), uniq(properties.chemin)
      FROM events
      WHERE event = 'bot_hit' AND timestamp > now() - INTERVAL ${d2} DAY AND ${AGENTS_SITES}
      GROUP BY jour ORDER BY jour
    `,
    agents_familles: `
      SELECT properties.famille AS famille, properties.operateur, properties.type, count(), uniq(properties.chemin), max(timestamp)
      FROM events
      WHERE event = 'bot_hit' AND timestamp > now() - INTERVAL ${days} DAY AND ${AGENTS_SITES}
      GROUP BY famille, properties.operateur, properties.type ORDER BY count() DESC LIMIT 50
    `,
    agents_pages: `
      SELECT properties.chemin AS chemin, count(), uniq(properties.famille)
      FROM events
      WHERE event = 'bot_hit' AND timestamp > now() - INTERVAL ${days} DAY AND ${AGENTS_SITES}
      GROUP BY chemin ORDER BY count() DESC LIMIT 200
    `,
    agents_sites: `
      SELECT properties.site, count()
      FROM events
      WHERE event = 'bot_hit' AND timestamp > now() - INTERVAL ${days} DAY AND ${AGENTS_SITES}
      GROUP BY properties.site
    `,
    // Navigateurs pilotés par un programme, écartés des autres chiffres : sessions et pages vues, par domaine
    agents_navigateurs: `
      SELECT properties.$host, uniq(properties.$session_id), countIf(event = '$pageview')
      FROM events
      WHERE timestamp > now() - INTERVAL ${days} DAY AND properties.automatise = 'oui' AND (${SITE} OR ${APP})
      GROUP BY properties.$host
    `,
    // Rafales (au moins quatre pages en cinq secondes ou moins) restées dans les chiffres : un humain ne lit pas si vite
    agents_rafales_site: `
      SELECT countIf(pages >= 4 AND duree <= 5), count() FROM (${sessionsOf(SITE, days)})
    `,
    agents_rafales_app: `
      SELECT countIf(pages >= 4 AND duree <= 5), count() FROM (${sessionsOf(APP, days)})
    `,
    // Appli, par jour : personnes, sessions, pages vues, durée moyenne de session
    app_series: `
      SELECT toDate(debut) AS jour, uniq(sid), sum(pages), avg(duree), uniq(sid)
      FROM (${sessionsOf(APP, d2)})
      GROUP BY jour ORDER BY jour
    `,
    app_users_series: `
      SELECT toDate(timestamp) AS jour, uniq(distinct_id)
      FROM events
      WHERE timestamp > now() - INTERVAL ${d2} DAY AND ${APP} AND ${NOT_INTERNAL}
      GROUP BY jour ORDER BY jour
    `,
    // Sessions de l'appli sur la période courante : nombre, durée moyenne et médiane, pages par session
    app_sessions: `
      SELECT count(), avg(duree), quantile(0.5)(duree), avg(pages), countIf(duree >= 60)
      FROM (${sessionsOf(APP, days)})
    `,
    app_sessions_prev: `
      SELECT count(), avg(duree), quantile(0.5)(duree), avg(pages), countIf(duree >= 60)
      FROM (${sessionsOf(APP, d2)})
      WHERE debut <= now() - INTERVAL ${days} DAY
    `,
    // Pages de l'appli les plus vues (chemins ramenés à leur gabarit côté serveur)
    app_pages: `
      SELECT properties.$pathname AS chemin, count() AS vues, uniq(properties.$session_id) AS sessions, uniq(distinct_id) AS personnes
      FROM events
      WHERE event = '$pageview' AND timestamp > now() - INTERVAL ${days} DAY AND ${APP} AND ${NOT_INTERNAL}
      GROUP BY chemin ORDER BY vues DESC LIMIT 200
    `,
    // Temps passé par page : écart jusqu'à l'événement suivant de la même session, plafonné à 30 minutes
    app_time: `
      SELECT chemin, sum(duree), count()
      FROM (
        SELECT properties.$session_id AS sid, properties.$pathname AS chemin, timestamp AS t,
               leadInFrame(timestamp) OVER (PARTITION BY sid ORDER BY timestamp ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS suivant,
               dateDiff('second', t, suivant) AS duree
        FROM events
        WHERE timestamp > now() - INTERVAL ${days} DAY AND ${APP} AND ${NOT_INTERNAL} AND properties.$session_id IS NOT NULL
      )
      WHERE suivant IS NOT NULL AND duree > 0 AND duree < 1800 AND chemin IS NOT NULL
      GROUP BY chemin ORDER BY sum(duree) DESC LIMIT 200
    `,
    // Entonnoir d'onboarding : personnes vues à chaque étape, comptes créés, échecs
    funnel: `
      SELECT properties.step_key, uniq(distinct_id)
      FROM events
      WHERE event = 'onboarding_step_viewed' AND timestamp > now() - INTERVAL ${days} DAY AND ${NOT_INTERNAL}
      GROUP BY properties.step_key
    `,
    funnel_end: `
      SELECT event, uniq(distinct_id)
      FROM events
      WHERE event IN ('onboarding_completed', 'onboarding_signup_failed') AND timestamp > now() - INTERVAL ${days} DAY AND ${NOT_INTERNAL}
      GROUP BY event
    `,
    // Site vitrine sur la période courante
    site_pages: `
      SELECT properties.$pathname AS chemin, count() AS vues, uniq(distinct_id) AS visiteurs
      FROM events
      WHERE event = '$pageview' AND timestamp > now() - INTERVAL ${days} DAY AND ${SITE} AND ${NOT_INTERNAL}
      GROUP BY chemin ORDER BY vues DESC LIMIT 12
    `,
    site_entries: `
      SELECT chemin, count() AS n FROM (
        SELECT properties.$session_id AS sid, argMin(properties.$pathname, timestamp) AS chemin
        FROM events
        WHERE event = '$pageview' AND timestamp > now() - INTERVAL ${days} DAY AND ${SITE} AND ${NOT_INTERNAL}
        GROUP BY sid
      ) GROUP BY chemin ORDER BY n DESC LIMIT 8
    `,
    site_referrers: `
      SELECT coalesce(nullif(properties.$referring_domain, ''), '$direct') AS source, uniq(properties.$session_id) AS sessions
      FROM events
      WHERE event = '$pageview' AND timestamp > now() - INTERVAL ${days} DAY AND ${SITE} AND ${NOT_INTERNAL}
      GROUP BY source ORDER BY sessions DESC LIMIT 10
    `,
    site_utm: `
      SELECT properties.utm_source, properties.utm_campaign, uniq(properties.$session_id) AS sessions
      FROM events
      WHERE event = '$pageview' AND timestamp > now() - INTERVAL ${days} DAY AND ${SITE} AND ${NOT_INTERNAL} AND properties.utm_source IS NOT NULL
      GROUP BY properties.utm_source, properties.utm_campaign ORDER BY sessions DESC LIMIT 10
    `,
    site_devices: `
      SELECT coalesce(properties.$device_type, 'Inconnu'), uniq(properties.$session_id)
      FROM events
      WHERE event = '$pageview' AND timestamp > now() - INTERVAL ${days} DAY AND ${SITE} AND ${NOT_INTERNAL}
      GROUP BY 1 ORDER BY 2 DESC
    `,
    site_countries: `
      SELECT coalesce(properties.$geoip_country_name, 'Inconnu'), uniq(properties.$session_id)
      FROM events
      WHERE event = '$pageview' AND timestamp > now() - INTERVAL ${days} DAY AND ${SITE} AND ${NOT_INTERNAL}
      GROUP BY 1 ORDER BY 2 DESC LIMIT 8
    `,
    site_bounce: `
      SELECT countIf(pages = 1), count(), avg(duree) FROM (${sessionsOf(SITE, days)})
    `,
    site_bounce_prev: `
      SELECT countIf(pages = 1), count(), avg(duree) FROM (${sessionsOf(SITE, d2)}) WHERE debut <= now() - INTERVAL ${days} DAY
    `,
    // Référencement : sessions du site arrivées depuis un moteur de recherche
    seo_series: `SELECT toDate(debut) AS jour, count() FROM (${organicSessions(d2)}) GROUP BY jour ORDER BY jour`,
    seo_entries: `SELECT entree, count() AS n, avg(pages) FROM (${organicSessions(days)}) GROUP BY entree ORDER BY n DESC LIMIT 10`,
    seo_engines: `SELECT origine, count() AS n FROM (${organicSessions(days)}) GROUP BY origine ORDER BY n DESC LIMIT 6`,
    // Appareils de l'appli (le téléphone d'abord, attendu à 80 % de l'usage)
    app_devices: `
      SELECT coalesce(properties.$device_type, 'Inconnu'), uniq(properties.$session_id)
      FROM events
      WHERE event = '$pageview' AND timestamp > now() - INTERVAL ${days} DAY AND ${APP} AND ${NOT_INTERNAL}
      GROUP BY 1 ORDER BY 2 DESC
    `,
    // Bugs : exceptions et clics de rage, par jour (site et appli confondus), puis les dernières exceptions
    bugs_series: `
      SELECT toDate(timestamp) AS jour, countIf(event = '$exception'), countIf(event = '$rageclick'), countIf(event = '$dead_click')
      FROM events
      WHERE event IN ('$exception', '$rageclick', '$dead_click') AND timestamp > now() - INTERVAL ${d2} DAY AND ${NOT_INTERNAL}
      GROUP BY jour ORDER BY jour
    `,
    exceptions: `
      SELECT timestamp, properties.$host, properties.$pathname, properties.$exception_list, properties.$exception_message, properties.$exception_type, distinct_id, properties.$session_id, properties.$browser, properties.$device_type
      FROM events
      WHERE event = '$exception' AND timestamp > now() - INTERVAL ${days} DAY AND ${NOT_INTERNAL}
      ORDER BY timestamp DESC LIMIT 40
    `,
    rageclicks: `
      SELECT properties.$host, properties.$pathname, count(), max(timestamp)
      FROM events
      WHERE event = '$rageclick' AND timestamp > now() - INTERVAL ${days} DAY AND ${NOT_INTERNAL}
      GROUP BY 1, 2 ORDER BY count() DESC LIMIT 10
    `,
    // Replay Vision : sessions analysées par le scanner, puis celles où il a vu un bug
    scans: `
      SELECT count(), countIf(properties.scanner_output_verdict = 'yes')
      FROM events
      WHERE ${SCANNED} AND timestamp > now() - INTERVAL ${days} DAY
    `,
    scan_bugs: `
      SELECT timestamp, properties.session_id, properties.scanner_output_reasoning, properties.scanner_output_key_moment_ms
      FROM events
      WHERE ${SCANNED} AND properties.scanner_output_verdict = 'yes' AND timestamp > now() - INTERVAL ${days} DAY
      ORDER BY toFloat(properties.scanner_output_notability) DESC, timestamp DESC LIMIT 15
    `,
    // Web vitals (p75) de l'appli et du site, si PostHog les collecte
    vitals: `
      SELECT properties.$host,
             quantile(0.75)(toFloat(properties.$web_vitals_LCP_value)),
             quantile(0.75)(toFloat(properties.$web_vitals_INP_value)),
             quantile(0.75)(toFloat(properties.$web_vitals_CLS_value)),
             count()
      FROM events
      WHERE event = '$web_vitals' AND timestamp > now() - INTERVAL ${days} DAY AND ${NOT_INTERNAL}
      GROUP BY 1 ORDER BY count() DESC LIMIT 4
    `,
    // Personnes actives dans l'appli sur la période, et celles de la période précédente
    app_people: `
      SELECT uniq(distinct_id) FROM events WHERE timestamp > now() - INTERVAL ${days} DAY AND ${APP} AND ${NOT_INTERNAL}
    `,
    app_people_prev: `
      SELECT uniq(distinct_id) FROM events
      WHERE timestamp > now() - INTERVAL ${d2} DAY AND timestamp <= now() - INTERVAL ${days} DAY AND ${APP} AND ${NOT_INTERNAL}
    `,
  };
}

// Regroupe les lignes par chemin gabarit (les ids de fiches et de mariages ne font qu'une page)
function groupPaths(rows, mapRow) {
  const by = new Map();
  for (const row of rows || []) {
    const key = templatePath(row[0]);
    const cur = by.get(key) || { chemin: key };
    mapRow(cur, row);
    by.set(key, cur);
  }
  return [...by.values()];
}

export async function readPostHog(days, { signal } = {}) {
  const erreurs = [];
  const q = queries(days);
  const names = Object.keys(q);
  const settled = await Promise.allSettled(names.map((name) => hogql(q[name], signal)));
  const r = {};
  names.forEach((name, i) => {
    const s = settled[i];
    if (s.status === "fulfilled") r[name] = s.value;
    else {
      r[name] = null;
      erreurs.push({ source: `posthog.${name}`, message: String(s.reason?.message || s.reason).slice(0, 300) });
    }
  });

  const pages = groupPaths(r.app_pages, (acc, [, vues, sessions, personnes]) => {
    acc.vues = (acc.vues || 0) + Number(vues || 0);
    acc.sessions = (acc.sessions || 0) + Number(sessions || 0);
    acc.personnes = Math.max(acc.personnes || 0, Number(personnes || 0));
  }).sort((a, b) => b.vues - a.vues);
  const temps = groupPaths(r.app_time, (acc, [, total, n]) => {
    acc.total = (acc.total || 0) + Number(total || 0);
    acc.n = (acc.n || 0) + Number(n || 0);
  })
    .map((x) => ({ ...x, moyenne: x.n ? x.total / x.n : 0 }))
    .sort((a, b) => b.total - a.total);

  const funnel = Object.fromEntries((r.funnel || []).map(([k, n]) => [k, Number(n) || 0]));
  const funnelEnd = Object.fromEntries((r.funnel_end || []).map(([k, n]) => [k, Number(n) || 0]));

  const sessions = (row) =>
    row ? { n: Number(row[0]) || 0, duree: Number(row[1]) || 0, mediane: Number(row[2]) || 0, pages: Number(row[3]) || 0, engagees: Number(row[4]) || 0 } : null;
  const bounce = (row) => (row ? { rebonds: Number(row[0]) || 0, sessions: Number(row[1]) || 0, duree: Number(row[2]) || 0 } : null);

  const parHote = (rows, host) => (rows || []).filter((row) => (Array.isArray(host) ? host.includes(row[0]) : row[0] === host));
  const sommePar = (rows, host, i) => parHote(rows, host).reduce((acc, row) => acc + (Number(row[i]) || 0), 0);
  const rafales = (row) => (row ? { rafales: Number(row[0]) || 0, sessions: Number(row[1]) || 0 } : null);
  const agentPages = groupPaths(r.agents_pages, (acc, [, n, familles]) => {
    acc.n = (acc.n || 0) + Number(n || 0);
    acc.familles = Math.max(acc.familles || 0, Number(familles || 0));
  }).sort((a, b) => b.n - a.n);

  return {
    disponible: true,
    erreurs,
    agents: {
      series: r.agents_series,
      familles: (r.agents_familles || []).map(([famille, operateur, type, n, pages, dernier]) => ({ famille, operateur, type, n: Number(n) || 0, pages: Number(pages) || 0, dernier })),
      pages: agentPages,
      sites: Object.fromEntries((r.agents_sites || []).map(([site, n]) => [site, Number(n) || 0])),
      navigateurs: {
        site: { sessions: sommePar(r.agents_navigateurs, ["withmerry.com", "www.withmerry.com"], 1), pages: sommePar(r.agents_navigateurs, ["withmerry.com", "www.withmerry.com"], 2) },
        app: { sessions: sommePar(r.agents_navigateurs, "app.withmerry.com", 1), pages: sommePar(r.agents_navigateurs, "app.withmerry.com", 2) },
      },
      rafales: { site: rafales(r.agents_rafales_site?.[0]), app: rafales(r.agents_rafales_app?.[0]) },
    },
    site: {
      series: r.site_series,
      pages: (r.site_pages || []).map(([chemin, vues, visiteurs]) => ({ chemin: chemin || "/", vues: Number(vues) || 0, visiteurs: Number(visiteurs) || 0 })),
      entrees: (r.site_entries || []).map(([chemin, n]) => ({ chemin: chemin || "/", n: Number(n) || 0 })),
      sources: (r.site_referrers || []).map(([source, n]) => ({ source: source === "$direct" ? "Accès direct" : source, n: Number(n) || 0 })),
      utm: (r.site_utm || []).map(([source, campagne, n]) => ({ source, campagne, n: Number(n) || 0 })),
      appareils: (r.site_devices || []).map(([k, n]) => ({ label: k, n: Number(n) || 0 })),
      pays: (r.site_countries || []).map(([k, n]) => ({ label: k, n: Number(n) || 0 })),
      rebond: bounce(r.site_bounce?.[0]),
      rebond_prec: bounce(r.site_bounce_prev?.[0]),
    },
    seo: {
      series: r.seo_series,
      entrees: (r.seo_entries || []).map(([chemin, n, pages]) => ({ chemin: chemin || "/", n: Number(n) || 0, pages: Number(pages) || 0 })),
      moteurs: (r.seo_engines || []).map(([label, n]) => ({ label, n: Number(n) || 0 })),
    },
    app: {
      series: r.app_series,
      personnes_series: r.app_users_series,
      sessions: sessions(r.app_sessions?.[0]),
      sessions_prec: sessions(r.app_sessions_prev?.[0]),
      personnes: Number(r.app_people?.[0]?.[0]) || 0,
      personnes_prec: Number(r.app_people_prev?.[0]?.[0]) || 0,
      pages,
      temps,
      appareils: (r.app_devices || []).map(([k, n]) => ({ label: k, n: Number(n) || 0 })),
      funnel: {
        fete: funnel.fete || 0,
        equipe: funnel.equipe || 0,
        essentiel: funnel.essentiel || 0,
        compte: funnel.compte || 0,
        preparation: funnel.preparation || 0,
        termine: funnelEnd.onboarding_completed || 0,
        echecs: funnelEnd.onboarding_signup_failed || 0,
      },
    },
    bugs: {
      series: r.bugs_series,
      exceptions: (r.exceptions || []).map(([ts, host, chemin, list, message, type, who, sid, navigateur, appareil]) => ({
        quand: ts,
        hote: host,
        chemin,
        titre: exceptionTitle({ $exception_list: list, $exception_message: message, $exception_type: type }),
        personne: who,
        session: sid,
        navigateur,
        appareil,
      })),
      rage: (r.rageclicks || []).map(([host, chemin, n, dernier]) => ({ hote: host, chemin, n: Number(n) || 0, dernier })),
      replays: {
        analysees: Number(r.scans?.[0]?.[0]) || 0,
        bugs: Number(r.scans?.[0]?.[1]) || 0,
        liste: (r.scan_bugs || []).map(([quand, session, raison, moment]) => ({ quand, raison, lien: replayUrl(session, moment) })),
      },
      vitals: (r.vitals || []).map(([host, lcp, inp, cls, n]) => ({ hote: host, lcp: Number(lcp) || null, inp: Number(inp) || null, cls: Number(cls) || null, n: Number(n) || 0 })),
    },
  };
}

// Dernier événement reçu par PostHog pour chaque personne identifiée de l'appli (id Supabase → ISO), sur 90 jours.
// Sert au tableau Utilisateurs : sans événement récent, le lien PostHog serait vide (pas de consentement aux cookies,
// ou navigateur qui bloque PostHog). Volontairement sans NOT_INTERNAL : on veut aussi retrouver les comptes de Stan.
export async function readPostHogLastSeen({ signal } = {}) {
  const rows = await hogql(
    `SELECT distinct_id, max(timestamp) FROM events WHERE timestamp > now() - INTERVAL 90 DAY AND ${APP} GROUP BY distinct_id LIMIT 10000`,
    signal,
  );
  return Object.fromEntries(rows.map(([id, at]) => [id, new Date(`${String(at).replace(" ", "T")}${/Z|[+-]\d\d:?\d\d$/.test(String(at)) ? "" : "Z"}`).toISOString()]));
}

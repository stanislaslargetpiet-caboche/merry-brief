// Google Search Console pour la page de pilotage : clics, impressions, position, requêtes, pages et sitemaps.
// Accès par un compte de service (Google Cloud, projet Clos45, « merry-pilotage ») ajouté comme utilisateur de la
// propriété Search Console. Sa clé JSON va telle quelle dans GOOGLE_SERVICE_ACCOUNT_JSON (Vercel, Production) ;
// la propriété lue est GSC_SITE (par défaut sc-domain:withmerry.com). Sans clé, la section explique quoi faire.
// Aucune dépendance : le jeton est signé avec node:crypto.

import { createSign } from "node:crypto";

const SITE = process.env.GSC_SITE || "sc-domain:withmerry.com";
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const API = "https://searchconsole.googleapis.com/webmasters/v3";

const b64url = (input) => Buffer.from(input).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

export function readServiceAccount(raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
  const text = String(raw || "").trim();
  if (!text) return null;
  try {
    // La clé peut être collée en JSON ou en base64 (plus sûr pour les retours à la ligne)
    const json = JSON.parse(text.startsWith("{") ? text : Buffer.from(text, "base64").toString("utf8"));
    if (!json.client_email || !json.private_key) return null;
    return { email: json.client_email, key: String(json.private_key).replace(/\\n/g, "\n") };
  } catch {
    return null;
  }
}

export function signedJwt(account, now = Math.floor(Date.now() / 1000)) {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({ iss: account.email, scope: SCOPE, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  return `${header}.${claims}.${b64url(signer.sign(account.key))}`;
}

async function accessToken(account, signal) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: signedJwt(account) }),
    signal,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`google_token_${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).access_token;
}

const day = (ts) => new Date(ts).toISOString().slice(0, 10);

export async function readSearchConsole(days, { signal } = {}) {
  const account = readServiceAccount();
  if (!account) {
    return { disponible: false, raison: "GOOGLE_SERVICE_ACCOUNT_JSON manquante : crée une clé JSON pour le compte de service merry-pilotage et colle-la sur Vercel (Production)" };
  }
  const token = await accessToken(account, signal);
  const site = encodeURIComponent(SITE);
  const call = async (path, body) => {
    const res = await fetch(`${API}/sites/${site}${path}`, {
      method: body ? "POST" : "GET",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal,
      cache: "no-store",
    });
    if (res.status === 403 || res.status === 404) {
      const err = new Error("acces");
      err.acces = true;
      throw err;
    }
    if (!res.ok) throw new Error(`gsc_${res.status}: ${(await res.text()).slice(0, 200)}`);
    return res.json();
  };

  const now = Date.now();
  const end = day(now);
  const startCur = day(now - (days - 1) * 86400 * 1000);
  const start2 = day(now - (2 * days - 1) * 86400 * 1000);
  const query = (dimensions, startDate, rowLimit) => call("/searchAnalytics/query", { startDate, endDate: end, dimensions, rowLimit, dataState: "all" });

  try {
    const [byDay, queries, pages, devices, sitemaps] = await Promise.all([
      query(["date"], start2, 100),
      query(["query"], startCur, 15),
      query(["page"], startCur, 15),
      query(["device"], startCur, 5),
      call("/sitemaps"),
    ]);
    const row = (r) => ({ clics: r.clicks || 0, impressions: r.impressions || 0, ctr: r.ctr || 0, position: r.position || 0 });
    return {
      disponible: true,
      site: SITE,
      compte: account.email,
      series: (byDay.rows || []).map((r) => [r.keys[0], r.clicks || 0, r.impressions || 0, r.position || 0]),
      requetes: (queries.rows || []).map((r) => ({ requete: r.keys[0], ...row(r) })),
      pages: (pages.rows || []).map((r) => ({ page: String(r.keys[0]).replace(/^https?:\/\/[^/]+/, "") || "/", ...row(r) })),
      appareils: (devices.rows || []).map((r) => ({ label: r.keys[0], n: r.clicks || 0, impressions: r.impressions || 0 })),
      sitemaps: (sitemaps.sitemap || []).map((s) => ({
        chemin: s.path,
        soumis: Number((s.contents || []).reduce((a, c) => a + Number(c.submitted || 0), 0)),
        indexes: Number((s.contents || []).reduce((a, c) => a + Number(c.indexed || 0), 0)),
        erreurs: Number(s.errors || 0),
        avertissements: Number(s.warnings || 0),
        lu: s.lastDownloaded || null,
        en_attente: Boolean(s.isPending),
      })),
    };
  } catch (e) {
    if (e.acces) {
      return { disponible: false, raison: `le compte ${account.email} n'a pas accès à ${SITE} : valide la propriété dans Search Console, puis ajoute cette adresse dans Paramètres > Utilisateurs et autorisations` };
    }
    throw e;
  }
}

// Santé technique du référencement, vérifiée par Merry lui-même sans aucune clé : robots.txt, sitemap, et un
// échantillon de pages du sitemap relues comme le ferait un moteur (réponse, titre, description, canonique,
// noindex). L'échantillon tourne chaque jour : en un mois, toutes les pages y passent.

const SITE_URL = process.env.PILOTAGE_SITE_URL || "https://www.withmerry.com";
const SAMPLE = 12;
const UA = "MerryPilotage/1.0 (+https://www.withmerry.com)";

async function get(url, signal, ms = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener("abort", onAbort);
  try {
    const res = await fetch(url, { headers: { "user-agent": UA }, signal: ctrl.signal, cache: "no-store", redirect: "manual" });
    return { status: res.status, text: res.status === 200 ? await res.text() : "", location: res.headers.get("location") };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

const pick = (html, re) => (html.match(re)?.[1] || "").replace(/\s+/g, " ").trim();

// Ce qu'un moteur lit d'une page : fonction pure, testée
export function auditHtml(html, url) {
  const title = pick(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const description = pick(html, /<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i) || pick(html, /<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i);
  const canonical = pick(html, /<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']*)["']/i) || pick(html, /<link[^>]+href=["']([^"']*)["'][^>]*rel=["']canonical["']/i);
  const robots = pick(html, /<meta[^>]+name=["']robots["'][^>]*content=["']([^"']*)["']/i);
  const h1 = (html.match(/<h1[\s>]/gi) || []).length;
  const problemes = [];
  if (!title) problemes.push("pas de titre");
  else if (title.length > 65) problemes.push(`titre long (${title.length} caractères)`);
  if (!description) problemes.push("pas de description");
  else if (description.length > 170) problemes.push(`description longue (${description.length} caractères)`);
  if (/noindex/i.test(robots)) problemes.push("noindex");
  if (!canonical) problemes.push("pas d'adresse canonique");
  else if (url && canonical.replace(/\/$/, "") !== String(url).replace(/\/$/, "")) problemes.push("canonique vers une autre adresse");
  if (h1 === 0) problemes.push("pas de h1");
  else if (h1 > 1) problemes.push(`${h1} h1`);
  return { title, description, canonical, h1, problemes };
}

// Échantillon stable sur une journée et différent le lendemain
export function sampleUrls(urls, n, dayIndex) {
  const list = urls || [];
  if (list.length <= n) return list;
  const step = Math.floor(list.length / n);
  const offset = ((dayIndex % step) + step) % step;
  const out = [];
  for (let i = 0; i < n; i++) out.push(list[(offset + i * step) % list.length]);
  return out;
}

export function sectionOf(url) {
  const path = String(url).replace(/^https?:\/\/[^/]+/, "") || "/";
  const parts = path.split("/").filter(Boolean);
  if (!parts.length) return "/";
  return parts[0] === "mariage" && parts[1] ? `/mariage/${parts[1]}` : `/${parts[0]}`;
}

export async function readSeoHealth({ signal } = {}) {
  const [robots, sitemap] = await Promise.all([get(`${SITE_URL}/robots.txt`, signal), get(`${SITE_URL}/sitemap.xml`, signal, 15000)]);
  const urls = [...sitemap.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  const sections = new Map();
  for (const u of urls) sections.set(sectionOf(u), (sections.get(sectionOf(u)) || 0) + 1);

  const dayIndex = Math.floor(Date.now() / 86400000);
  const sample = [SITE_URL + "/", ...sampleUrls(urls.filter((u) => u.replace(/\/$/, "") !== SITE_URL), SAMPLE, dayIndex)];
  const pages = await Promise.all(
    sample.map(async (url) => {
      const started = Date.now();
      try {
        const res = await get(url, signal);
        const ms = Date.now() - started;
        if (res.status !== 200) return { url, statut: res.status, ms, problemes: [res.status >= 300 && res.status < 400 ? `redirige vers ${res.location || "?"}` : `réponse ${res.status}`] };
        const audit = auditHtml(res.text, url);
        return { url, statut: 200, ms, titre: audit.title, problemes: audit.problemes };
      } catch (e) {
        return { url, statut: 0, ms: Date.now() - started, problemes: [e.name === "AbortError" ? "pas de réponse en 8 s" : "injoignable"] };
      }
    }),
  );

  return {
    disponible: true,
    site: SITE_URL,
    robots: { statut: robots.status, sitemap_declare: /sitemap:\s*\S+/i.test(robots.text), bloque_tout: /^\s*disallow:\s*\/\s*$/im.test(robots.text) },
    sitemap: { statut: sitemap.status, urls: urls.length, sections: [...sections.entries()].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n) },
    pages: pages.map((p) => ({ ...p, chemin: p.url.replace(/^https?:\/\/[^/]+/, "") || "/" })),
    pages_en_defaut: pages.filter((p) => p.problemes.length).length,
    lenteur_ms: Math.round(pages.reduce((a, p) => a + p.ms, 0) / Math.max(1, pages.length)),
  };
}

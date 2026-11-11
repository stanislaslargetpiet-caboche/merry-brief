import { NextResponse } from "next/server";
import { VITRINE_HOSTS, VITRINE_PAGES } from "@/lib/vitrine/routes";
import { classifyAgent } from "@/lib/agentsIa";
import { compter, isPageRequest, isPageVisit, isRobot, sourceOf } from "@/lib/compteur";
import { classifyRobot } from "@/lib/robots";

// withmerry.com et www servent le site vitrine (pages /vitrine/* de cette appli) et les pages SEO
// (/mariage/*) ; l'appli reste sur app.withmerry.com. Les pages réservées à l'appli renvoient vers
// app.withmerry.com, et les pages SEO demandées sur app.withmerry.com vers www.withmerry.com.
const APP_ONLY = /^\/(dashboard|pro|connexion|pilotage|s|f|api)(\/|$)/;
const SEO_ONLY = /^\/(mariage(\/|$)|sitemap\.xml$)/;
const VITRINE_PATHS = Object.fromEntries(Object.entries(VITRINE_PAGES).map(([path, page]) => [page.replace(/\/$/, ""), path]));
// Alias Vercel stables du projet : on n'y laisse jamais traîner de lien, on renvoie vers withmerry.com.
// Les URLs de preview par déploiement (hash-stan-f307.vercel.app) restent intactes pour tester une branche.
const VERCEL_STABLE_ALIASES = ["merry-brief.vercel.app", "merry-brief-stan-f307.vercel.app"];

function route(req) {
  const host = (req.headers.get("host") || "").split(":")[0].toLowerCase();
  const { pathname, search } = req.nextUrl;
  // Tâches planifiées Vercel : appelées sur le domaine de production, une redirection les perdrait
  if (pathname.startsWith("/api/interne/")) return NextResponse.next();
  if (VERCEL_STABLE_ALIASES.includes(host)) {
    const target = APP_ONLY.test(pathname) ? "app.withmerry.com" : "www.withmerry.com";
    return NextResponse.redirect(`https://${target}${pathname}${search}`, 308);
  }
  // Les pages internes /vitrine/* n'ont qu'une adresse publique : celle du site (/, /partenaires…)
  const publicPath = VITRINE_PATHS[pathname.replace(/\/$/, "")];
  if (publicPath && (host === "app.withmerry.com" || VITRINE_HOSTS.includes(host))) {
    return NextResponse.redirect(`https://www.withmerry.com${publicPath}${search}`, 308);
  }
  // /mariage seul n'a pas de page : il mène à la première liste plutôt qu'à une 404
  if (pathname.replace(/\/$/, "") === "/mariage") return NextResponse.redirect(`https://www.withmerry.com/mariage/lieux${search}`, 308);
  if (host === "app.withmerry.com" && SEO_ONLY.test(pathname)) {
    return NextResponse.redirect(`https://www.withmerry.com${pathname}${search}`, 308);
  }
  if (!VITRINE_HOSTS.includes(host)) {
    // Prévisualisation Vercel ou local : les liens du site (adresses publiques) mènent aux pages internes
    const internal = pathname !== "/" && VITRINE_PAGES[pathname];
    return internal ? NextResponse.rewrite(new URL(`${internal}${search}`, req.url)) : NextResponse.next();
  }
  if (pathname === "/home") return NextResponse.redirect(new URL(`/${search}`, req.url), 308);
  const target = VITRINE_PAGES[pathname];
  if (target) return NextResponse.rewrite(new URL(`${target}${search}`, req.url));
  if (APP_ONLY.test(pathname)) return NextResponse.redirect(`https://app.withmerry.com${pathname}${search}`, 308);
  return NextResponse.next();
}

// Agents IA (GPTBot, ClaudeBot, PerplexityBot…) : ils n'exécutent pas le JavaScript, donc PostHog côté navigateur ne
// les voit jamais. On les relève ici, à la requête, sous l'événement `bot_hit` (lu par la page Agents IA du
// pilotage). Pas de profil de personne, pas d'adresse IP, et la propriété s'appelle `site` (pas `$host`) pour que
// les requêtes du site et de l'appli ne les comptent pas comme des visiteurs.
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com";

function reportAgent(req, event, agent, nom = "bot_hit") {
  if (!POSTHOG_KEY) return;
  const host = (req.headers.get("host") || "").split(":")[0].toLowerCase();
  if (!host || host.includes("localhost")) return;
  const send = fetch(`${POSTHOG_HOST}/capture/`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      api_key: POSTHOG_KEY,
      event: nom,
      distinct_id: `agent:${agent.famille}`,
      properties: { ...agent, site: host, chemin: req.nextUrl.pathname, agent_ua: (req.headers.get("user-agent") || "").slice(0, 300), $process_person_profile: false, $lib: "merry-middleware" },
    }),
  }).catch(() => {});
  event?.waitUntil?.(send);
}

// Compteur anonyme (lib/compteur.js) : une page du site vitrine, ou l'onboarding de l'appli, ouverts par un navigateur
function etapeDe(req) {
  const host = (req.headers.get("host") || "").split(":")[0].toLowerCase();
  if (VITRINE_HOSTS.includes(host) && VITRINE_PAGES[req.nextUrl.pathname]) return "site";
  if (host === "app.withmerry.com" && req.nextUrl.pathname === "/") return "appli";
  return null;
}

export function middleware(req, event) {
  const res = route(req);
  // L'appli (app.withmerry.com) n'a rien à faire dans Google : le site et les pages SEO vivent sur www
  if ((req.headers.get("host") || "").split(":")[0].toLowerCase() === "app.withmerry.com") res.headers.set("X-Robots-Tag", "noindex");
  const landed = res.status < 300 || res.status >= 400;
  // Une redirection n'est pas une lecture : l'agent est compté sur l'adresse où il atterrit
  const agent = landed ? classifyAgent(req.headers.get("user-agent")) : null;
  if (agent && !req.nextUrl.pathname.startsWith("/api/interne/")) reportAgent(req, event, agent);
  const etape = landed && !agent ? etapeDe(req) : null;
  // Robots ordinaires (moteurs, aperçus de lien, scripts) sur une page du site : relevés à part des visites humaines
  if (etape === "site" && isPageRequest(req.headers, req.method) && isRobot(req.headers.get("user-agent"))) {
    reportAgent(req, event, classifyRobot(req.headers.get("user-agent")), "robot_hit");
  }
  if (etape && isPageVisit(req.headers, req.method)) {
    const send = compter({ etape, source: sourceOf(req.nextUrl.search), site: (req.headers.get("host") || "").split(":")[0].toLowerCase() });
    if (send) event?.waitUntil?.(send);
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/|favicon|icon|apple-icon|.*\\.[a-zA-Z0-9]+$).*)", "/sitemap.xml"],
};

// Robots qui ouvrent le site sans être des agents IA (lib/agentsIa.js) : moteurs de recherche, aperçus de lien,
// outils de mesure, scripts, requêtes sans User-Agent. Relevés par le middleware sous `robot_hit`, lus par l'onglet
// Site du pilotage à côté des visites humaines. Un User-Agent se falsifie : c'est ce que le robot déclare être.

const ROBOTS = [
  { re: /Googlebot|AdsBot-Google|Mediapartners-Google|Google-InspectionTool|GoogleOther/i, famille: "Googlebot", categorie: "Moteur de recherche" },
  { re: /bingbot|BingPreview|msnbot/i, famille: "Bingbot", categorie: "Moteur de recherche" },
  { re: /DuckDuckBot|Qwantify|Yandex|Baiduspider|Slurp|Applebot|SeznamBot|Ecosia/i, famille: "Autres moteurs", categorie: "Moteur de recherche" },
  { re: /facebookexternalhit|facebookcatalog|Facebot/i, famille: "Facebook", categorie: "Aperçu de lien" },
  { re: /WhatsApp/i, famille: "WhatsApp", categorie: "Aperçu de lien" },
  { re: /Telegram|Slackbot|LinkedInBot|Twitterbot|Discordbot|SkypeUriPreview|preview/i, famille: "Autres aperçus", categorie: "Aperçu de lien" },
  { re: /Lighthouse|PageSpeed|GTmetrix|Pingdom|UptimeRobot|StatusCake|Datadog|Vercel/i, famille: "Mesure et surveillance", categorie: "Outil de mesure" },
  { re: /AhrefsBot|SemrushBot|MJ12bot|DotBot|BLEXBot|Screaming Frog|SiteAuditBot|DataForSeoBot/i, famille: "Outils SEO", categorie: "Outil de mesure" },
  { re: /HeadlessChrome|PhantomJS|Puppeteer|Playwright|Selenium/i, famille: "Navigateur sans écran", categorie: "Script" },
  { re: /curl|wget|python|node-fetch|axios|go-http|java\/|okhttp|libwww|scrapy|httpclient/i, famille: "Scripts", categorie: "Script" },
];

export const CATEGORIES_ROBOTS = ["Moteur de recherche", "Aperçu de lien", "Outil de mesure", "Script", "Autre"];

/** { famille, categorie } d'un User-Agent de robot (ou absent). À n'appeler que si lib/compteur isRobot est vrai. */
export function classifyRobot(userAgent) {
  const ua = typeof userAgent === "string" ? userAgent.trim() : "";
  if (!ua) return { famille: "Sans User-Agent", categorie: "Autre" };
  for (const r of ROBOTS) if (r.re.test(ua)) return { famille: r.famille, categorie: r.categorie };
  return { famille: "Autres robots", categorie: "Autre" };
}

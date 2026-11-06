// Agents IA qui lisent le site et l'appli, reconnus à leur User-Agent (middleware.js, page Croissance > Agents IA du
// pilotage). Fonctions pures, testées (tests/agentsIa.test.js). Un User-Agent se falsifie : c'est un relevé de ce que
// les agents déclarent être, pas une preuve.
//
// Trois types : « entrainement » (collecte pour entraîner un modèle), « recherche » (index d'un moteur de réponses),
// « utilisateur » (agent qui lit une page parce que quelqu'un le lui a demandé à l'instant).
// Les robots des moteurs classiques (Googlebot, Bingbot) ne sont pas des agents IA : ils sont suivis par la section
// Référencement, pas ici. Google-Extended n'est pas un User-Agent (c'est un réglage de robots.txt) : il n'apparaît pas.

export const AGENTS_IA = [
  { re: /GPTBot/i, famille: "GPTBot", operateur: "OpenAI", type: "entrainement" },
  { re: /OAI-SearchBot/i, famille: "OAI-SearchBot", operateur: "OpenAI", type: "recherche" },
  { re: /ChatGPT-User/i, famille: "ChatGPT-User", operateur: "OpenAI", type: "utilisateur" },
  { re: /ClaudeBot/i, famille: "ClaudeBot", operateur: "Anthropic", type: "entrainement" },
  { re: /Claude-SearchBot/i, famille: "Claude-SearchBot", operateur: "Anthropic", type: "recherche" },
  { re: /Claude-User/i, famille: "Claude-User", operateur: "Anthropic", type: "utilisateur" },
  { re: /anthropic-ai|Claude-Web/i, famille: "Anthropic (ancien)", operateur: "Anthropic", type: "entrainement" },
  { re: /PerplexityBot/i, famille: "PerplexityBot", operateur: "Perplexity", type: "recherche" },
  { re: /Perplexity-User/i, famille: "Perplexity-User", operateur: "Perplexity", type: "utilisateur" },
  { re: /Google-Extended|GoogleOther|Google-CloudVertexBot|Gemini-Deep-Research/i, famille: "Google (IA)", operateur: "Google", type: "entrainement" },
  { re: /meta-externalagent|meta-externalfetcher|FacebookBot/i, famille: "Meta (IA)", operateur: "Meta", type: "entrainement" },
  { re: /Applebot-Extended/i, famille: "Applebot-Extended", operateur: "Apple", type: "entrainement" },
  { re: /Amazonbot/i, famille: "Amazonbot", operateur: "Amazon", type: "entrainement" },
  { re: /Bytespider/i, famille: "Bytespider", operateur: "ByteDance", type: "entrainement" },
  { re: /CCBot/i, famille: "CCBot", operateur: "Common Crawl", type: "entrainement" },
  { re: /cohere-ai|cohere-training-data-crawler/i, famille: "Cohere", operateur: "Cohere", type: "entrainement" },
  { re: /MistralAI-User/i, famille: "MistralAI-User", operateur: "Mistral", type: "utilisateur" },
  { re: /DuckAssistBot/i, famille: "DuckAssistBot", operateur: "DuckDuckGo", type: "utilisateur" },
  { re: /YouBot/i, famille: "YouBot", operateur: "You.com", type: "recherche" },
  { re: /Diffbot/i, famille: "Diffbot", operateur: "Diffbot", type: "entrainement" },
  { re: /Timpibot|ImagesiftBot|Omgilibot|PetalBot/i, famille: "Autres collecteurs", operateur: "Divers", type: "entrainement" },
];

export const AGENT_TYPES = {
  entrainement: "Entraînement",
  recherche: "Recherche",
  utilisateur: "Pour un utilisateur",
};

/** { famille, operateur, type } si le User-Agent est celui d'un agent IA connu, sinon null. */
export function classifyAgent(userAgent) {
  const ua = typeof userAgent === "string" ? userAgent : "";
  if (!ua) return null;
  for (const a of AGENTS_IA) if (a.re.test(ua)) return { famille: a.famille, operateur: a.operateur, type: a.type };
  return null;
}

/**
 * Navigateur piloté par un programme (Playwright, Puppeteer, Selenium, agents à navigateur réel) : à appeler dans
 * le navigateur, sur `navigator`. Ne prouve rien dans l'autre sens : un agent bien déguisé passe.
 */
export function looksAutomated(nav) {
  if (!nav) return false;
  if (nav.webdriver === true) return true;
  return /HeadlessChrome|PhantomJS|Puppeteer|Playwright|Selenium/i.test(nav.userAgent || "");
}

// Compteur anonyme du parcours d'arrivée : combien de visites arrivent sur le site, ouvrent l'appli, puis voient chaque
// écran de l'onboarding, par lien d'arrivée (?source=meta-a…). Sans cookie ni identifiant : chaque passage est un
// événement `compteur` isolé dans PostHog (distinct_id jetable, pas de profil, pas d'adresse IP), relu en totaux par
// la page Site du pilotage. Rien ne relie deux étapes d'une même personne : c'est un entonnoir de volumes, pas de
// parcours. Les étapes avec cookies acceptés restent dans PostHog côté navigateur (lib/analytics.js).

export const ETAPES = [
  { id: "site", label: "Visites" },
  { id: "appli", label: "Appli ouverte" },
  { id: "equipe", label: "1.\u00a0Équipe", onboarding: true },
  { id: "essentiel", label: "2.\u00a0Lieu, date, budget", onboarding: true },
  { id: "preparation", label: "Chargement", onboarding: true },
  { id: "compte", label: "3.\u00a0Compte", onboarding: true },
];
const IDS = new Set(ETAPES.map((e) => e.id));

export const isEtape = (id) => IDS.has(id);

// Source lisible dans une adresse (« ?source=meta-a&fbclid=… ») ; null si absente ou douteuse
export function sourceOf(search) {
  const source = new URLSearchParams(search || "").get("source");
  return source && /^[\w-]{1,40}$/.test(source) ? source : null;
}

// Source d'une publicité payante (meta-a, google-b…), par opposition aux liens du site, des mails ou du référencement
export const isPub = (source) => /^(meta|fb|ig|google|gads|tiktok|pinterest|linkedin|snap)-/i.test(source || "");

// Entonnoir du compteur, complété des inscriptions de la période (briefs, section Utilisateurs)
export function avecInscriptions(rows, sources) {
  const inscrits = new Map((sources || []).map((x) => [x.label, x.n]));
  const lignes = (rows || []).map((r) => ({ ...r, inscriptions: inscrits.get(r.source) || 0 }));
  for (const [label, n] of inscrits) if (n && !lignes.some((r) => r.source === label)) lignes.push({ source: label, ...Object.fromEntries(ETAPES.map((e) => [e.id, 0])), inscriptions: n });
  return lignes;
}

// Robots et aperçus de lien (Facebook, WhatsApp, Slack…) : pas des visites
const NOT_A_VISIT = /bot|crawl|spider|slurp|facebookexternalhit|facebookcatalog|preview|whatsapp|telegram|headless|lighthouse|curl|wget|python|node-fetch/i;

export const isRobot = (ua) => !ua || NOT_A_VISIT.test(ua);

// Requête d'une page (pas un préchargement, pas une navigation interne de Next.js), par un navigateur ou un robot
export function isPageRequest(headers, method = "GET") {
  if (method !== "GET") return false;
  if (headers.get("rsc") || headers.get("next-router-prefetch") || headers.get("purpose") === "prefetch" || headers.get("sec-purpose")?.includes("prefetch")) return false;
  const dest = headers.get("sec-fetch-dest");
  return !dest || dest === "document";
}

// Visite d'une personne : une requête de page dont le User-Agent n'est pas celui d'un robot
export const isPageVisit = (headers, method = "GET") => isPageRequest(headers, method) && !isRobot(headers.get("user-agent"));

// Appareils de l'équipe : on ouvre une fois une adresse du site avec ?interne=1 (?interne=0 pour retirer) et un
// repère « ne me compte pas » reste sur cet appareil. Il ne dit rien d'une personne et les visiteurs n'en reçoivent
// jamais : le compteur reste sans cookie pour eux. Le repère couvre le site, l'appli et les écrans de l'onboarding.
export const COOKIE_INTERNE = "merry_interne";

/** "pose" ou "retire" si l'adresse porte ?interne=1 ou ?interne=0, sinon null. */
export function interneDemande(search) {
  const valeur = new URLSearchParams(search || "").get("interne");
  return valeur === "1" ? "pose" : valeur === "0" ? "retire" : null;
}

/** Vrai si la requête vient d'un appareil de l'équipe (repère posé par ?interne=1). */
export const isInterne = (headers) => /(?:^|;\s*)merry_interne=1(?:;|$)/.test(headers.get("cookie") || "");

// Ce que la requête dit d'elle-même : un navigateur qui ouvre une page envoie Sec-Fetch-Dest: document,
// Sec-Fetch-Mode: navigate et Accept-Language ; un script qui imite son nom d'ordinateur oublie souvent les trois.
// Relevé à part sur chaque visite du site pour mesurer l'écart avant de filtrer quoi que ce soit.
export function qualiteEntetes(headers) {
  const dest = headers.get("sec-fetch-dest");
  const mode = headers.get("sec-fetch-mode");
  if (!dest && !mode) return "sans_sec_fetch";
  if (dest !== "document" || mode !== "navigate") return "autre";
  return headers.get("accept-language") ? "complet" : "sans_langue";
}

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com";

// Envoi côté serveur ; renvoie la promesse pour waitUntil (rien en local ni sans clé)
export function compter({ etape, source, site, entetes }) {
  if (!POSTHOG_KEY || !isEtape(etape) || !site || site.includes("localhost")) return null;
  return fetch(`${POSTHOG_HOST}/capture/`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      api_key: POSTHOG_KEY,
      event: "compteur",
      distinct_id: `compteur:${crypto.randomUUID()}`,
      properties: { etape, source: source || null, site, entetes: entetes || null, $process_person_profile: false, $ip: null, $lib: "merry-compteur" },
    }),
  }).catch(() => {});
}

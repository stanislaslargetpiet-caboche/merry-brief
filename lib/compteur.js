// Compteur anonyme du parcours d'arrivée : combien de visites arrivent sur le site, ouvrent l'appli, puis voient chaque
// écran de l'onboarding, par lien d'arrivée (?source=meta-a…). Sans cookie ni identifiant : chaque passage est un
// événement `compteur` isolé dans PostHog (distinct_id jetable, pas de profil, pas d'adresse IP), relu en totaux par
// la page Site du pilotage. Rien ne relie deux étapes d'une même personne : c'est un entonnoir de volumes, pas de
// parcours. Les étapes avec cookies acceptés restent dans PostHog côté navigateur (lib/analytics.js).

export const ETAPES = [
  { id: "site", label: "Site" },
  { id: "appli", label: "Appli" },
  { id: "fete", label: "Fête" },
  { id: "equipe", label: "Équipe" },
  { id: "essentiel", label: "Essentiel" },
  { id: "preparation", label: "Préparation" },
  { id: "compte", label: "Compte" },
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

// Requête d'une page par un navigateur (pas un préchargement, pas une navigation interne de Next.js)
export function isPageVisit(headers, method = "GET") {
  if (method !== "GET") return false;
  if (headers.get("rsc") || headers.get("next-router-prefetch") || headers.get("purpose") === "prefetch" || headers.get("sec-purpose")?.includes("prefetch")) return false;
  const dest = headers.get("sec-fetch-dest");
  if (dest && dest !== "document") return false;
  return !isRobot(headers.get("user-agent"));
}

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com";

// Envoi côté serveur ; renvoie la promesse pour waitUntil (rien en local ni sans clé)
export function compter({ etape, source, site }) {
  if (!POSTHOG_KEY || !isEtape(etape) || !site || site.includes("localhost")) return null;
  return fetch(`${POSTHOG_HOST}/capture/`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      api_key: POSTHOG_KEY,
      event: "compteur",
      distinct_id: `compteur:${crypto.randomUUID()}`,
      properties: { etape, source: source || null, site, $process_person_profile: false, $ip: null, $lib: "merry-compteur" },
    }),
  }).catch(() => {});
}

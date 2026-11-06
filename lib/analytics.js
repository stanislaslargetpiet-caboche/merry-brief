"use client";

import { looksAutomated } from "@/lib/agentsIa";

// Suivi produit (PostHog, hébergement UE) : qui s'est connecté et quand, le
// parcours (clics, temps passé, replay de session) et l'entonnoir d'onboarding.
// Sans clé (pas de .env.local, ou en local sans la variable), tout est
// silencieusement désactivé : aucun appel réseau, rien à configurer pour développer.
const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const UI_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com";
// Les événements partent vers notre propre domaine (next.config.mjs les relaie vers PostHog) plutôt que vers
// eu.i.posthog.com : un bloqueur de pub qui cible PostHog par son nom de domaine ne voit plus la différence
// avec le reste du site. ui_host reste eu.i.posthog.com, utilisé seulement pour la barre d'outils PostHog.
const API_HOST = "/ingest";

// Le module posthog-js (environ 60 Ko) n'est téléchargé qu'après l'accord : rien ne part sur le réseau avant,
// et le site vitrine n'en porte pas le poids.
let posthog = null;
let ready = false;
// Dernière identification demandée avant que PostHog soit prêt : la connexion est lue plus vite que le module ne
// charge, et l'ignorer laissait la session du jour sous un identifiant anonyme.
let pendingIdentity = null;

// Consentement (bandeau cookies, components/CookieBanner.js) : rien ne part vers
// PostHog, aucun cookie n'est posé, tant que la personne n'a pas accepté.
export const CONSENT_KEY = "merry-cookies";
export const analyticsEnabled = !!KEY;

export function readConsent() {
  try {
    const v = window.localStorage.getItem(CONSENT_KEY);
    return v === "yes" || v === "no" ? v : null;
  } catch {
    return null;
  }
}

export function setConsent(value) {
  try {
    window.localStorage.setItem(CONSENT_KEY, value);
  } catch {
    /* ignore */
  }
  if (value === "yes") initAnalytics();
  else if (ready) posthog.opt_out_capturing();
}

let loading = null;

export function initAnalytics() {
  if (ready || loading || !KEY || typeof window === "undefined") return;
  if (readConsent() !== "yes") return;
  loading = import("posthog-js").then((mod) => {
    posthog = mod.default;
    start();
  });
}

const SECRET_PARAMS = ["invitation", "fiche", "token", "code"];
function scrubUrl(value) {
  if (typeof value !== "string" || !value.includes("?")) return value;
  try {
    const u = new URL(value, "https://x.invalid");
    SECRET_PARAMS.forEach((n) => u.searchParams.delete(n));
    const out = u.pathname + (u.search || "") + u.hash;
    return /^https?:/i.test(value) ? u.origin + out : out;
  } catch {
    return value;
  }
}

// Navigateur piloté par un programme (agents à navigateur réel, Playwright…) : chaque événement le porte, le
// premier pageview compris, et le pilotage écarte ces sessions de ses chiffres (lib/server/pilotage/posthog.js).
function scrub(event) {
  if (!event?.properties) return event;
  if (typeof navigator !== "undefined" && looksAutomated(navigator)) event.properties.automatise = "oui";
  ["$current_url", "$referrer", "$pathname", "$initial_current_url", "$initial_referrer"].forEach((k) => {
    if (k in event.properties) event.properties[k] = scrubUrl(event.properties[k]);
  });
  return event;
}

function start() {
  if (ready) return;
  posthog.init(KEY, {
    api_host: API_HOST,
    ui_host: UI_HOST,
    // Suit aussi les couples qui abandonnent l'onboarding avant de créer un compte.
    person_profiles: "always",
    // Ni jeton d'invitation ni identifiant de fiche dans les adresses envoyées à PostHog
    before_send: scrub,
    // Coupés par défaut dans le projet PostHog : sans eux, le pilotage affiche zéro erreur et zéro clic mort.
    capture_exceptions: true,
    capture_dead_clicks: true,
    session_recording: {
      // On voit les clics et le parcours, jamais le texte tapé (email, mot de passe, budget…).
      maskAllInputs: true,
      // Ni le texte affiché : adresses masquées des invités, noms d'établissements, messages des couples.
      maskTextSelector: "*",
    },
  });
  ready = true;
  // Identification demandée pendant le chargement de posthog-js (ou avant l'accord) : on la rejoue maintenant.
  if (pendingIdentity) {
    posthog.identify(pendingIdentity.id, pendingIdentity.props);
    pendingIdentity = null;
  }
}

/** À appeler une fois qu'on connaît l'utilisateur (connexion, ou juste après la création du compte). */
export function identifyUser(user, props) {
  if (!user?.id) return;
  const identity = { id: user.id, props: { email: user.email || null, ...props } };
  if (!ready) {
    pendingIdentity = identity;
    return;
  }
  posthog.identify(identity.id, identity.props);
}

/** À appeler à la déconnexion, pour ne pas mélanger deux personnes sur le même navigateur. */
export function resetAnalytics() {
  pendingIdentity = null;
  if (!ready) return;
  posthog.reset();
}

/** Les erreurs de rendu arrêtées par app/error.js n'arrivent pas jusqu'à la capture automatique. */
export function trackError(error, props) {
  if (!ready) return;
  posthog.captureException(error, props);
}

export function trackEvent(name, props) {
  if (!ready) return;
  posthog.capture(name, props);
}

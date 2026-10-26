"use client";

import posthog from "posthog-js";

// Suivi produit (PostHog, hébergement UE) : qui s'est connecté et quand, le
// parcours (clics, temps passé, replay de session) et l'entonnoir d'onboarding.
// Sans clé (pas de .env.local, ou en local sans la variable), tout est
// silencieusement désactivé : aucun appel réseau, rien à configurer pour développer.
const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com";

let ready = false;

export function initAnalytics() {
  if (ready || !KEY || typeof window === "undefined") return;
  posthog.init(KEY, {
    api_host: HOST,
    // Suit aussi les couples qui abandonnent l'onboarding avant de créer un compte.
    person_profiles: "always",
    session_recording: {
      // On voit les clics et le parcours, jamais le texte tapé (email, mot de passe, budget…).
      maskAllInputs: true,
    },
  });
  ready = true;
}

/** À appeler une fois qu'on connaît l'utilisateur (connexion, ou juste après la création du compte). */
export function identifyUser(user, props) {
  if (!ready || !user?.id) return;
  posthog.identify(user.id, { email: user.email || null, ...props });
}

/** À appeler à la déconnexion, pour ne pas mélanger deux personnes sur le même navigateur. */
export function resetAnalytics() {
  if (!ready) return;
  posthog.reset();
}

export function trackEvent(name, props) {
  if (!ready) return;
  posthog.capture(name, props);
}

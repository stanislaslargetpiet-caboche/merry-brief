import { looksAutomated } from "@/lib/agentsIa";

// Côté navigateur : signale un écran de l'onboarding au compteur anonyme (lib/compteur.js, /api/compteur).
// Chaque écran compte une fois par chargement de page, sans rien stocker sur l'appareil.
const vus = new Set();

export function compterEtape(etape) {
  if (typeof window === "undefined" || vus.has(etape)) return;
  vus.add(etape);
  if (looksAutomated(window.navigator)) return;
  const body = JSON.stringify({ etape, search: window.location.search.slice(0, 200) });
  try {
    if (window.navigator.sendBeacon?.("/api/compteur", new Blob([body], { type: "text/plain" }))) return;
  } catch {
    /* sendBeacon indisponible : on passe par fetch */
  }
  fetch("/api/compteur", { method: "POST", body, keepalive: true }).catch(() => {});
}

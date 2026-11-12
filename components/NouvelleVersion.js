"use client";

// Recharge un onglet resté ouvert sur une ancienne version de l'appli (règles et seuils dans lib/version.js) :
// - au retour sur l'onglet après au moins 10 minutes ailleurs ;
// - juste après une navigation interne : la page demandée se charge alors en entier, avec le nouveau code.
// Jamais pendant une saisie ni avec une fenêtre ouverte : on retente au retour ou à la navigation suivants.
// Ne rend rien à l'écran.

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { trackEvent } from "@/lib/analytics";
import { CHECK_EVERY_MS, VERSION_ONGLET, canReloadNow, claimReload, isStale, shouldReload } from "@/lib/version";

async function versionEnLigne(s) {
  const now = Date.now();
  if (now - s.checkedAt < CHECK_EVERY_MS) return s.enLigne;
  s.checkedAt = now;
  try {
    const res = await fetch("/api/version", { cache: "no-store" });
    if (res.ok) s.enLigne = String((await res.json()).version || "");
  } catch {
    /* hors ligne : on garde la dernière version connue */
  }
  return s.enLigne;
}

async function peutEtreRecharger(s, motif, awayMs = 0) {
  const enLigne = await versionEnLigne(s);
  const stale = isStale(VERSION_ONGLET, enLigne);
  if (!shouldReload({ stale, awayMs, sinceNavMs: Date.now() - s.navAt, safe: canReloadNow(document) })) return;
  if (!claimReload(enLigne, window.sessionStorage)) return;
  trackEvent("version_rechargee", { de: VERSION_ONGLET.slice(0, 7), vers: enLigne.slice(0, 7), motif });
  window.location.reload();
}

export default function NouvelleVersion() {
  const pathname = usePathname();
  const state = useRef({ enLigne: "", checkedAt: 0, hiddenAt: 0, navAt: 0, path: null });

  useEffect(() => {
    if (!VERSION_ONGLET) return undefined;
    const s = state.current;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        s.hiddenAt = Date.now();
      } else if (s.hiddenAt) {
        const awayMs = Date.now() - s.hiddenAt;
        s.hiddenAt = 0;
        peutEtreRecharger(s, "retour", awayMs);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Le premier passage est le chargement de la page, déjà à jour : seules les navigations suivantes comptent
  useEffect(() => {
    const s = state.current;
    const first = s.path === null;
    s.path = pathname;
    if (first || !VERSION_ONGLET) return;
    s.navAt = Date.now();
    peutEtreRecharger(s, "navigation");
  }, [pathname]);

  return null;
}

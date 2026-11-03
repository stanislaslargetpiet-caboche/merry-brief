"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

// Mesure des boutons du site vitrine : tout lien portant data-track="nom" envoie un événement nommé
// (après accord cookies, sinon rien ne part). Les pages restent des composants serveur, sans JS par bouton.
export default function Track() {
  useEffect(() => {
    const onClick = (e) => {
      const a = e.target.closest?.("[data-track]");
      if (a) trackEvent("vitrine_cta", { cta: a.dataset.track, page: window.location.pathname, href: a.getAttribute("href") });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}

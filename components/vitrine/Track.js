"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";
import { withSource } from "@/lib/vitrine/routes";

// Mesure des boutons du site vitrine : tout lien portant data-track="nom" envoie un événement nommé
// (après accord cookies, sinon rien ne part). Les pages restent des composants serveur, sans JS par bouton.
// Le lien d'inscription reprend au clic la source de l'adresse (withSource), sans dépendre de l'accord cookies.
export default function Track() {
  useEffect(() => {
    const onClick = (e) => {
      const link = e.target.closest?.("a");
      if (link) link.setAttribute("href", withSource(link.getAttribute("href"), window.location.search));
      const a = e.target.closest?.("[data-track]");
      if (a) trackEvent("vitrine_cta", { cta: a.dataset.track, page: window.location.pathname, href: a.getAttribute("href") });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}

"use client";

// Fait suivre la source d'une annonce de lien en lien sur les pages SEO (lib/seo/sourceLinks.js) : l'adresse du lien
// est complétée au moment du clic, les pages restent statiques et en cache.
import { useEffect } from "react";
import { lienAvecSource, sourceASuivre } from "@/lib/seo/sourceLinks";

export default function SourceLinks() {
  useEffect(() => {
    const source = sourceASuivre(window.location.search);
    if (!source) return undefined;
    const complete = (e) => {
      const a = e.target?.closest?.("a[href]");
      if (!a) return;
      const next = lienAvecSource(a.getAttribute("href"), source, window.location.origin);
      if (next !== a.getAttribute("href")) a.setAttribute("href", next);
    };
    document.addEventListener("click", complete, true);
    document.addEventListener("auxclick", complete, true);
    return () => {
      document.removeEventListener("click", complete, true);
      document.removeEventListener("auxclick", complete, true);
    };
  }, []);
  return null;
}

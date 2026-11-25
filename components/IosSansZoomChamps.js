"use client";

import { useEffect } from "react";

// Sur iPhone et iPad (Safari et l'appli iOS), toucher un champ dont le texte fait moins de 16 px fait zoomer
// la page, et elle reste zoomée ensuite : tout l'écran paraît décalé, coupé à gauche (retour du 25 nov. 2026,
// recherche des prestataires à 15 px). maximum-scale=1 empêche ce zoom automatique. Safari laisse toujours
// zoomer à deux doigts ; Android, qui ne zoome pas sur les champs, n'est pas touché et garde son zoom.
export function isIos(nav) {
  if (!nav) return false;
  return /iP(hone|ad|od)/.test(nav.platform || "") || /iP(hone|ad|od)/.test(nav.userAgent || "") || (nav.platform === "MacIntel" && nav.maxTouchPoints > 1);
}

export function withMaxScale(content) {
  const c = String(content || "");
  return /maximum-scale/.test(c) ? c : `${c}${c ? ", " : ""}maximum-scale=1`;
}

export default function IosSansZoomChamps() {
  useEffect(() => {
    if (!isIos(window.navigator)) return;
    const meta = document.querySelector('meta[name="viewport"]');
    if (meta) meta.setAttribute("content", withMaxScale(meta.getAttribute("content")));
  }, []);
  return null;
}

// Couleur du tableau de bord choisie par chaque organisateur dans Réglages (pêche, corail ou mangue).
// Gardée dans les métadonnées du compte Supabase (elle suit la personne d'un appareil à l'autre)
// et recopiée dans le navigateur pour s'afficher dès le chargement, sans clignotement.

import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";

export const ACCENTS = [
  { key: "peche", label: "Pêche pastel", color: "#f6c9a8", tint: "#fcebdd", ink: "#8a3f1c" },
  { key: "corail", label: "Corail", color: "#ff8a6b", tint: "#ffe0d6", ink: "#8a2e14" },
  { key: "mangue", label: "Mangue", color: "#ffb54a", tint: "#ffebc7", ink: "#7a4a00" },
];

const KEY = "merry-accent";
const EVENT = "merry-accent";
const valid = (k) => (ACCENTS.some((a) => a.key === k) ? k : "peche");

function read() {
  try {
    return valid(window.localStorage.getItem(KEY));
  } catch {
    return "peche";
  }
}

function subscribe(cb) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useAccent() {
  return useSyncExternalStore(subscribe, read, () => "peche");
}

function remember(key) {
  try {
    window.localStorage.setItem(KEY, key);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT));
}

// Au chargement : la couleur enregistrée sur le compte l'emporte sur celle du navigateur
export function syncAccent(user) {
  const saved = user?.user_metadata?.accent;
  if (saved && valid(saved) !== read()) remember(valid(saved));
}

export async function saveAccent(key, live) {
  remember(valid(key));
  if (!live) return true;
  const { error } = await supabase.auth.updateUser({ data: { accent: valid(key) } });
  return !error;
}

// Couleur du tableau de bord choisie par chaque organisateur dans Réglages (citron, jaune beurre, anis ou pistache).
// Gardée dans les métadonnées du compte Supabase (elle suit la personne d'un appareil à l'autre)
// et recopiée dans le navigateur pour s'afficher dès le chargement, sans clignotement.

import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";

export const ACCENTS = [
  { key: "citron", label: "Citron", color: "#fff700", tint: "#fffdb8", ink: "#574e00" },
  { key: "beurre", label: "Jaune beurre", color: "#ffe58a", tint: "#fff5cc", ink: "#6b5300" },
  { key: "anis", label: "Anis", color: "#e4f78f", tint: "#f5fcd2", ink: "#4e5a00" },
  { key: "pistache", label: "Pistache", color: "#bfe9a6", tint: "#e6f7dc", ink: "#2f5a1a" },
];

// Les anciennes couleurs (pêche, corail, mangue, retirées le 30 octobre 2026) repassent au citron
const DEFAULT = "citron";

const KEY = "merry-accent";
const EVENT = "merry-accent";
const valid = (k) => (ACCENTS.some((a) => a.key === k) ? k : DEFAULT);

function read() {
  try {
    return valid(window.localStorage.getItem(KEY));
  } catch {
    return DEFAULT;
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
  return useSyncExternalStore(subscribe, read, () => DEFAULT);
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

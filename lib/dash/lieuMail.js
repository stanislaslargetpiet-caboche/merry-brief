"use client";

// Mail « le lieu est réservé, prochaine étape le traiteur » (/api/mariage/lieu-signe, planche V64).
// Toujours en best-effort : le devis reste de toute façon enregistré.

import { supabase } from "@/lib/supabase";

export async function notifyLieuSigne(weddingId, lieuName) {
  if (!supabase || !weddingId) return;
  try {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token;
    if (!token) return;
    await fetch("/api/mariage/lieu-signe", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ weddingId, lieuName }),
    });
  } catch (e) {
    console.warn("[merry] notification lieu signé indisponible", e?.message || e);
  }
}

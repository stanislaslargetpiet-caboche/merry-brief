"use client";

// Prévient le couple par mail qu'un prestataire leur a répondu (/api/prestataires/notifier-couple).
// Toujours en best-effort : la réponse reste enregistrée dans Merry même si le mail ne part pas
// (pas de mail connu pour les organisateurs, clé Resend absente, etc.).

import { supabase } from "@/lib/supabase";

export async function notifyCouple(clientId) {
  if (!supabase || !clientId) return;
  try {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token;
    if (!token) return;
    await fetch("/api/prestataires/notifier-couple", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ clientId }),
    });
  } catch (e) {
    console.warn("[merry] notification couple indisponible", e?.message || e);
  }
}

"use client";

// Prévient le couple par mail qu'un prestataire leur a répondu ou leur a envoyé une proposition
// (/api/prestataires/notifier-couple). Toujours en best-effort : le message reste enregistré dans
// Merry même si le mail ne part pas (pas de mail connu pour les organisateurs, clé Resend absente, etc.).

import { supabase } from "@/lib/supabase";

// kind : « proposition » quand le prestataire écrit en premier ; sans valeur pour une réponse
export async function notifyCouple(clientId, kind) {
  if (!supabase || !clientId) return;
  try {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token;
    if (!token) return;
    await fetch("/api/prestataires/notifier-couple", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ clientId, kind }),
    });
  } catch (e) {
    console.warn("[merry] notification couple indisponible", e?.message || e);
  }
}

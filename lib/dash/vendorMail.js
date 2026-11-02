"use client";

// Prévient un prestataire par mail qu'un couple lui a écrit sur Merry (/api/prestataires/notifier-vendor).
// Toujours en best-effort : le message reste enregistré dans Merry même si le mail ne part pas
// (pas de mail connu pour ce prestataire, clé Resend absente, etc.).

import { supabase } from "@/lib/supabase";

export async function notifyVendor(vendorId) {
  if (!supabase || !vendorId) return;
  try {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token;
    if (!token) return;
    await fetch("/api/prestataires/notifier-vendor", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ vendorId }),
    });
  } catch (e) {
    console.warn("[merry] notification prestataire indisponible", e?.message || e);
  }
}

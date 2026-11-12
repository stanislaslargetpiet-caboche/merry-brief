"use client";

// Prévient un prestataire par mail qu'un couple lui a écrit sur Merry (/api/prestataires/notifier-vendor).
// Toujours en best-effort : le message reste enregistré dans Merry même si le mail ne part pas
// (pas de mail connu pour ce prestataire, clé Resend absente, etc.).

import { supabase } from "@/lib/supabase";

// request : facultatif, pour une demande de devis (message, dates, budget, questions, sign, guests) —
// affiché dans le mail en plus du simple « X vous a écrit ». Absent pour un message de la Messagerie.
export async function notifyVendor(vendorId, request) {
  if (!supabase || !vendorId) return;
  try {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token;
    if (!token) return;
    await fetch("/api/prestataires/notifier-vendor", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ vendorId, ...(request || {}) }),
    });
  } catch (e) {
    console.warn("[merry] notification prestataire indisponible", e?.message || e);
  }
}

// Confirme au couple que ses demandes sont bien parties (/api/prestataires/notifier-couple-demandes,
// planche V55). names : les prestataires dont l'envoi a réussi.
export async function notifyCoupleDemandes(names) {
  if (!supabase || !names?.length) return;
  try {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token;
    if (!token) return;
    await fetch("/api/prestataires/notifier-couple-demandes", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ names }),
    });
  } catch (e) {
    console.warn("[merry] confirmation des demandes indisponible", e?.message || e);
  }
}

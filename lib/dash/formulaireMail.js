"use client";

// Mails V59 et V60 (leçon Mariages.net, D-305) : /api/formulaire/apres-import et /api/formulaire/partage.
// Toujours en best-effort : le formulaire et la liste restent de toute façon enregistrés sans eux.

import { supabase } from "@/lib/supabase";

async function post(path, payload) {
  if (!supabase) return;
  try {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token;
    if (!token) return;
    await fetch(path, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
  } catch (e) {
    console.warn(`[merry] ${path} indisponible`, e?.message || e);
  }
}

export const notifyFormulaireApresImport = (weddingId, duplicates) => post("/api/formulaire/apres-import", { weddingId, duplicates });
export const notifyFormulairePartage = () => post("/api/formulaire/partage", {});

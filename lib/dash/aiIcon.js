// Après la création ou le renommage d'une tâche ou d'un poste, l'IA choisit
// l'icône d'après son thème principal ; l'icône devinée par mots-clés reste
// affichée en attendant, et si l'IA n'est pas activée.

import { supabase } from "@/lib/supabase";
import { ICON_KEYS } from "@/components/dash/icons";

let off = false; // pas de clé IA : on n'insiste pas

export async function refineIcon(dash, table, id, text, current) {
  if (off || dash.mode !== "live" || !supabase || !id || !String(text || "").trim()) return;
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) return;
    const res = await fetch("/api/icon", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ text, kind: table === "budget_items" ? "poste" : "tache" }),
    });
    if (res.status === 501) {
      off = true;
      return;
    }
    if (!res.ok) return;
    const { icon } = await res.json();
    if (ICON_KEYS.includes(icon) && icon !== current) await dash.update(table, id, { icon });
  } catch {
    /* l'icône devinée reste */
  }
}

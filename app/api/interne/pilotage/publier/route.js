// Dépôt des routines News of the Day et Feature of the Day dans la page Aujourd'hui du pilotage.
// Une ligne par rubrique et par jour : un second passage le même jour remplace le premier.
// Accès par l'en-tête x-cron-key (PILOTAGE_PUBLIER_KEY), propre à cette route : les routines n'ont pas de session.

import { createClient } from "@supabase/supabase-js";
import { ecrireParCle } from "@/lib/server/pilotage/items";
import { parisDay } from "@/lib/server/pilotage/reseau";
import { validatePublication } from "@/lib/pilotage/items";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  const cle = process.env.PILOTAGE_PUBLIER_KEY;
  if (!cle || req.headers.get("x-cron-key") !== cle) return Response.json({ error: "interdit" }, { status: 403 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return Response.json({ error: "indisponible" }, { status: 501 });
  const v = validatePublication(await req.json().catch(() => null), parisDay(Date.now()));
  if (!v.ok) return Response.json({ error: "invalide", champ: v.erreur }, { status: 400 });
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await ecrireParCle(admin, v.valeur);
  if (error) {
    console.error("[merry] publication pilotage", error.message);
    return Response.json({ error: "ecriture" }, { status: 500 });
  }
  return Response.json({ ok: true });
}

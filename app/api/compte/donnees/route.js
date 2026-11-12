// Réglages > Effacer mes données (D-130) : efface le mariage affiché, pour tous ses organisateurs (fichiers, mails
// envoyés, données en cascade). Les comptes restent ; au prochain chargement, le tableau de bord repart d'un mariage
// neuf recréé depuis le brief (merry_bootstrap). Seul un organisateur du mariage peut l'effacer.
// Nécessite SUPABASE_SERVICE_ROLE_KEY côté serveur ; sans clé, la route répond 501 et l'écran le dit.

import { createClient } from "@supabase/supabase-js";
import { effacerMariage, estOrganisateur } from "@/lib/server/effacement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "private, no-store" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(req) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return Response.json({ error: "indisponible" }, { status: 501, headers: NO_STORE });
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return Response.json({ error: "connexion" }, { status: 401, headers: NO_STORE });
  const body = await req.json().catch(() => null);
  if (!UUID.test(String(body?.mariage || ""))) return Response.json({ error: "invalide" }, { status: 400, headers: NO_STORE });

  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return Response.json({ error: "connexion" }, { status: 401, headers: NO_STORE });
  try {
    if (!(await estOrganisateur(admin, data.user.id, body.mariage))) return Response.json({ error: "interdit" }, { status: 403, headers: NO_STORE });
    const fait = await effacerMariage(admin, body.mariage);
    console.info("[merry] effacement", body.mariage, fait.fichiers, "fichiers", fait.mails, "mails");
    return Response.json({ ok: true }, { headers: NO_STORE });
  } catch (e) {
    console.error("[merry] effacement", e?.message || e);
    return Response.json({ error: "echec" }, { status: 500, headers: NO_STORE });
  }
}

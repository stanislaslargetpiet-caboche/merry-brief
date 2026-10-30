// Réglages > Supprimer mon compte : supprime le compte Supabase de la personne connectée.
// Ses places d'organisateur restent dans les mariages (user_id remis à vide), les données du mariage
// restent pour les autres organisateurs ; ses préférences et imports partent avec le compte (cascade).
// Nécessite SUPABASE_SERVICE_ROLE_KEY côté serveur ; sans clé, la route répond 501 et l'écran le dit.

import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function DELETE(req) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return Response.json({ error: "indisponible" }, { status: 501 });
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return Response.json({ error: "connexion" }, { status: 401 });

  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return Response.json({ error: "connexion" }, { status: 401 });

  const { error: delErr } = await admin.auth.admin.deleteUser(data.user.id);
  if (delErr) return Response.json({ error: "echec" }, { status: 500 });
  return Response.json({ ok: true });
}

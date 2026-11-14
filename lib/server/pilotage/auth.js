// Accès aux routes internes du pilotage : le jeton de session Supabase d'une adresse autorisée
// (PILOTAGE_EMAILS ou approuvée dans Coulisses › Accès), vérifié côté serveur. Renvoie { admin, email } ou { refus: Response }.
// Un refus 403 porte le statut de la demande (`demande` : en_attente, refuse ou null) pour l'écran d'attente.

import { createClient } from "@supabase/supabase-js";
import { statutAcces } from "./acces";

// Le compte du jeton, sans regarder s'il a accès : { admin, email } ou { refus }
export async function requireSession(req) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return { refus: Response.json({ error: "indisponible" }, { status: 501 }) };
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return { refus: Response.json({ error: "connexion" }, { status: 401 }) };
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin.auth.getUser(token);
  const email = String(data?.user?.email || "").toLowerCase();
  if (error || !email) return { refus: Response.json({ error: "connexion" }, { status: 401 }) };
  return { admin, email };
}

export async function requirePilot(req) {
  const who = await requireSession(req);
  if (who.refus) return who;
  const statut = await statutAcces(who.admin, who.email);
  if (statut !== "permanent" && statut !== "approuve") {
    return { refus: Response.json({ error: "interdit", demande: statut }, { status: 403, headers: { "cache-control": "private, no-store" } }) };
  }
  return who;
}

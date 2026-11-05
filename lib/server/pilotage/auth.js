// Accès aux routes internes du pilotage : le jeton de session Supabase d'une adresse autorisée
// (PILOTAGE_EMAILS), vérifié côté serveur. Renvoie { admin, email } ou { refus: Response }.

import { createClient } from "@supabase/supabase-js";
import { allowedEmails } from "./acces";

export async function requirePilot(req) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return { refus: Response.json({ error: "indisponible" }, { status: 501 }) };
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return { refus: Response.json({ error: "connexion" }, { status: 401 }) };
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin.auth.getUser(token);
  const email = String(data?.user?.email || "").toLowerCase();
  if (error || !email) return { refus: Response.json({ error: "connexion" }, { status: 401 }) };
  if (!allowedEmails().has(email)) return { refus: Response.json({ error: "interdit" }, { status: 403 }) };
  return { admin, email };
}

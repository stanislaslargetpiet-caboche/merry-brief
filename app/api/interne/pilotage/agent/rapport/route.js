// Retour du compte rendu d'un agent du pilotage : l'agent poste { id, jeton, texte } à la fin de son travail.
// Pas de session Supabase ici : le jeton, tiré au lancement et propre à une ligne de pilotage_rapports, tient lieu d'accès.
// Il ne sert qu'une fois (la ligne passe de « en cours » à « prêt ») et ne permet rien d'autre que d'écrire ce rapport.

import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "private, no-store" };
const validId = (id) => /^[0-9a-f-]{36}$/i.test(id);

function memes(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function POST(req) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return Response.json({ error: "indisponible" }, { status: 501, headers: NO_STORE });
  const body = await req.json().catch(() => null);
  const id = String(body?.id ?? "");
  const jeton = String(body?.jeton ?? "");
  const texte = String(body?.texte ?? "").trim().slice(0, 20000);
  if (!validId(id) || !jeton || !texte) return Response.json({ error: "invalide" }, { status: 400, headers: NO_STORE });
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin.from("pilotage_rapports").select("id, jeton, statut").eq("id", id).maybeSingle();
  if (error) return Response.json({ error: "lecture" }, { status: 502, headers: NO_STORE });
  if (!data || data.statut !== "en_cours" || !data.jeton || !memes(data.jeton, jeton)) return Response.json({ error: "refusé" }, { status: 403, headers: NO_STORE });
  const { error: ecriture } = await admin.from("pilotage_rapports").update({ texte, statut: "pret", jeton: "", maj_le: new Date().toISOString() }).eq("id", id).eq("statut", "en_cours");
  if (ecriture) return Response.json({ error: "écriture" }, { status: 502, headers: NO_STORE });
  return Response.json({ ok: true }, { headers: NO_STORE });
}

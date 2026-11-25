// Réception des chiffres Google Ads (D-381) : le script collé dans le compte Google Ads
// (scripts/google-ads/merry-depense.js) envoie chaque heure dépense, impressions et clics des derniers jours, par
// campagne, mot-clé et recherche tapée. Jeton à part (GOOGLE_ADS_SCRIPT_SECRET) : il vit dans le compte Google Ads et
// n'ouvre rien d'autre que cette route.
import { NIVEAUX_DEPENSE, validerEnvoi } from "@/lib/server/pilotage/googleAds";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "private, no-store" };

function autorise(req) {
  const secret = process.env.GOOGLE_ADS_SCRIPT_SECRET;
  return Boolean(secret) && secret.length >= 24 && req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(req) {
  if (!autorise(req)) return Response.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  const body = await req.json().catch(() => null);
  const v = validerEnvoi(body);
  if (!v.ok) return Response.json({ error: "invalide", detail: v.erreur }, { status: 400, headers: NO_STORE });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return Response.json({ error: "indisponible" }, { status: 501, headers: NO_STORE });
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const maj = new Date().toISOString();
  const ecrire = (lignes) => admin.from("google_ads_jours").upsert(lignes.map((l) => ({ ...l, maj })), { onConflict: "jour,niveau,campagne_id,groupe,terme,correspondance" });
  let { error } = await ecrire(v.lignes);
  // Table d'avant la persona (supabase/google-ads-persona.sql pas encore collé) : on garde au moins la dépense
  if (error?.code === "23514" && v.lignes.some((l) => !NIVEAUX_DEPENSE.includes(l.niveau))) {
    ({ error } = await ecrire(v.lignes.filter((l) => NIVEAUX_DEPENSE.includes(l.niveau))));
  }
  if (error) return Response.json({ error: "ecriture", message: error.message.slice(0, 200) }, { status: 500, headers: NO_STORE });
  return Response.json({ ok: true, lignes: v.lignes.length }, { headers: NO_STORE });
}

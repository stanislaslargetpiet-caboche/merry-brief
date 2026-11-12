// Récap du samedi 8 h (Paris) aux couples (D-296, lib/server/recapJob.js), qui remplace les mails de présentation
// du samedi. Appelée deux fois le samedi par Vercel (6 h et 7 h UTC, vercel.json) : la route ne travaille que le
// samedi, quand l'heure de Paris est 8 ou 9 ; une clé par samedi, mariage et adresse dans mail_sent empêche tout
// double envoi.
//  GET  Vercel, jeton CRON_SECRET. ?force=1 ignore le jour et l'heure, jamais la clé.
//       ?dry=1 compte les mails sans en envoyer ni réserver de clé.

import { createClient } from "@supabase/supabase-js";
import { publicOrigin } from "@/lib/server/origin";
import { isSaturday, runRecap } from "@/lib/server/recapJob";
import { inBriefWindow, parisParts } from "@/lib/server/pilotage/schedule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "unauthorized" }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service || !process.env.RESEND_API_KEY) return Response.json({ error: "missing_config" }, { status: 501 });

  const params = new URL(req.url).searchParams;
  const dry = params.get("dry") === "1";
  const now = new Date();
  const { hour } = parisParts(now);
  if (!dry && params.get("force") !== "1" && !(isSaturday(now) && inBriefWindow(hour))) return Response.json({ ok: true, passe: "hors fenêtre", heure_paris: hour });

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    return Response.json({ heure_paris: hour, dry, ...(await runRecap(admin, publicOrigin(), now, { dry })) });
  } catch (e) {
    console.error("[merry] récap du samedi", e?.message || e);
    return Response.json({ error: String(e?.message || e).slice(0, 200) }, { status: 500 });
  }
}

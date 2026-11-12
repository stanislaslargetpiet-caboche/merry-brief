// Mail de 20 h (Paris) « Nouvelles activités sur votre mariage », seulement aux organisateurs dont le mariage a
// bougé depuis la veille à 20 h (lib/server/activiteJob.js). Appelée deux fois par jour par Vercel (18 h et 19 h UTC,
// vercel.json) : l'offre Hobby lance une tâche n'importe quand dans l'heure indiquée et ne connaît pas l'heure d'été,
// donc la route ne travaille que si l'heure de Paris est 20 ou 21 ; une clé par mariage, adresse et jour dans
// mail_sent empêche tout double envoi. Viennent ensuite les mails de démarrage des couples
// (lib/server/demarrageJob.js) : passés après, ils voient qui a déjà reçu le mail de 20 h et le laissent seul ce jour-là.
//  GET  Vercel, jeton CRON_SECRET. ?force=1 ignore la fenêtre horaire, jamais la clé du jour.
//       ?dry=1 compte les mails sans en envoyer ni réserver de clé.

import { createClient } from "@supabase/supabase-js";
import { publicOrigin } from "@/lib/server/origin";
import { runActivite } from "@/lib/server/activiteJob";
import { runDemarrage } from "@/lib/server/demarrageJob";
import { SEND_HOURS } from "@/lib/server/activiteMail";
import { parisParts } from "@/lib/server/pilotage/schedule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
  if (!dry && params.get("force") !== "1" && !SEND_HOURS.includes(hour)) return Response.json({ ok: true, passe: "hors fenêtre", heure_paris: hour });

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  let activite;
  try {
    activite = await runActivite(admin, publicOrigin(), now, { dry });
  } catch (e) {
    console.error("[merry] activité quotidienne", e?.message || e);
    activite = { error: String(e?.message || e).slice(0, 200) };
  }
  // Une panne de l'un n'empêche pas l'autre
  let demarrage;
  try {
    demarrage = await runDemarrage(admin, publicOrigin(), now, { dry });
  } catch (e) {
    console.error("[merry] mails de démarrage", e?.message || e);
    demarrage = { error: String(e?.message || e).slice(0, 200) };
  }
  const failed = activite.error && demarrage.error;
  return Response.json({ heure_paris: hour, dry, ...activite, demarrage }, { status: failed ? 500 : 200 });
}

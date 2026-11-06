// Tâche quotidienne de 8 h (Paris) : le mail du pilotage à Stan, puis les relances aux couples et aux prestataires
// (lib/server/mailJobs.js, déjà idempotentes). Appelée deux fois par jour par Vercel (6 h et 7 h UTC, vercel.json) :
// l'offre Hobby lance une tâche n'importe quand dans l'heure indiquée et ne connaît pas l'heure d'été, donc la route
// ne travaille que si l'heure de Paris est 8 ou 9, et une clé par jour dans mail_sent empêche tout double envoi.
//  GET   Vercel, jeton CRON_SECRET. ?force=1 ignore la fenêtre horaire, jamais la clé du jour.
//  POST  ?test=1, avec CRON_SECRET ou la session d'une adresse de PILOTAGE_EMAILS (bouton de la page de pilotage) :
//        envoie le mail tout de suite, sans clé du jour, sans relances.

import { createClient } from "@supabase/supabase-js";
import { publicOrigin } from "@/lib/server/origin";
import { runMailJobs } from "@/lib/server/mailJobs";
import { buildBrief } from "@/lib/server/pilotage/brief";
import { requirePilot } from "@/lib/server/pilotage/auth";
import { collectPilotage } from "@/lib/server/pilotage/collect";
import { briefKey, inBriefWindow, parisParts } from "@/lib/server/pilotage/schedule";
import { mailShell } from "@/lib/server/mailShell";
import { sendMail } from "@/lib/server/sendMail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TO = process.env.BRIEF_TO || "stanislas.largetpiet@gmail.com";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service || !process.env.RESEND_API_KEY) return null;
  return createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
}

const byCron = (req) => Boolean(process.env.CRON_SECRET) && req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;

async function sendBrief(admin) {
  const data = await collectPilotage({ admin, days: 2, fresh: true, windowMs: 24 * 3600 * 1000 });
  const brief = buildBrief(data, new Date());
  const ok = await sendMail({
    to: TO,
    subject: brief.subject,
    text: brief.text,
    html: mailShell({ title: brief.subject, preheader: brief.preheader, body: brief.body }),
    label: "brief quotidien",
  });
  return { ok, alertes: brief.alertes, sujet: brief.subject };
}

export async function GET(req) {
  if (!byCron(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const admin = adminClient();
  if (!admin) return Response.json({ error: "missing_config" }, { status: 501 });

  const force = new URL(req.url).searchParams.get("force") === "1";
  const now = new Date();
  const { hour } = parisParts(now);
  if (!force && !inBriefWindow(hour)) return Response.json({ ok: true, passe: "hors fenêtre", heure_paris: hour });

  const report = { heure_paris: hour };
  // Une clé par jour : le second passage de la journée, ou une reprise, ne renvoie rien. Un envoi raté rend la clé.
  const key = briefKey(now);
  try {
    const { error } = await admin.from("mail_sent").insert({ key });
    if (error && String(error.code) !== "23505") throw new Error(error.message);
    if (error) report.brief = "déjà envoyé aujourd'hui";
    else {
      const sent = await sendBrief(admin);
      if (!sent.ok) await admin.from("mail_sent").delete().eq("key", key);
      report.brief = sent.ok ? { envoye: true, alertes: sent.alertes } : "échec de l'envoi";
    }
  } catch (e) {
    await admin.from("mail_sent").delete().eq("key", key);
    console.error("[merry] brief quotidien", e?.message || e);
    report.brief = `erreur : ${String(e?.message || e).slice(0, 200)}`;
  }

  try {
    report.relances = await runMailJobs(admin, publicOrigin());
  } catch (e) {
    console.error("[merry] relances", e?.message || e);
    report.relances = "erreur";
  }
  return Response.json(report, { status: String(report.brief).startsWith("erreur") || report.brief === "échec de l'envoi" ? 500 : 200 });
}

export async function POST(req) {
  if (new URL(req.url).searchParams.get("test") !== "1") return Response.json({ error: "test_only" }, { status: 400 });
  let admin = adminClient();
  if (!byCron(req)) {
    const who = await requirePilot(req);
    if (who.refus) return who.refus;
    admin = adminClient();
  }
  if (!admin) return Response.json({ error: "missing_config" }, { status: 501 });
  const sent = await sendBrief(admin);
  return Response.json({ ok: sent.ok, to: TO, sujet: sent.sujet, alertes: sent.alertes }, { status: sent.ok ? 200 : 502 });
}

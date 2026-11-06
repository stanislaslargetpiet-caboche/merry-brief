// Webhook Resend : reçoit les événements de chaque mail (délivré, ouvert, cliqué, rebond, plainte) et les range
// dans mail_events pour la page de pilotage. Appelé par Resend, jamais par le navigateur : la signature Svix
// (RESEND_WEBHOOK_SECRET) fait foi, sans elle la route refuse tout. Sous /api/interne/ pour échapper aux
// redirections de domaine du middleware.

import { createClient } from "@supabase/supabase-js";
import { eventRow, verifySignature } from "@/lib/server/resendWebhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !url || !service) return Response.json({ error: "missing_config" }, { status: 501 });

  const body = await req.text();
  const ok = verifySignature({
    secret,
    id: req.headers.get("svix-id"),
    timestamp: req.headers.get("svix-timestamp"),
    signature: req.headers.get("svix-signature"),
    body,
  });
  if (!ok) return Response.json({ error: "unauthorized" }, { status: 401 });

  let event;
  try {
    event = JSON.parse(body);
  } catch {
    return Response.json({ error: "bad_json" }, { status: 400 });
  }
  const row = eventRow(req.headers.get("svix-id"), event);
  // Un type que Merry ne suit pas (ou sans identifiant de mail) est accusé sans être gardé : Resend ne le renvoie pas
  if (!row) return Response.json({ ok: true, ignored: true });

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await admin.from("mail_events").upsert(row, { onConflict: "svix_id", ignoreDuplicates: true });
  if (error) {
    console.error("[merry] webhook resend", error.message);
    // 500 : Resend retente l'envoi
    return Response.json({ error: "store_failed" }, { status: 500 });
  }
  return Response.json({ ok: true });
}

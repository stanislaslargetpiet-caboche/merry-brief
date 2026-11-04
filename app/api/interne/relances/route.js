// Relances et résumés quotidiens, appelés par la tâche planifiée Vercel (vercel.json), jamais par le
// navigateur. Vercel envoie CRON_SECRET en jeton ; sans cette variable, la route refuse tout.

import { createClient } from "@supabase/supabase-js";
import { publicOrigin } from "@/lib/server/origin";
import { runMailJobs } from "@/lib/server/mailJobs";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "unauthorized" }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service || !process.env.RESEND_API_KEY) return Response.json({ error: "missing_config" }, { status: 501 });
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  return Response.json(await runMailJobs(admin, publicOrigin()));
}

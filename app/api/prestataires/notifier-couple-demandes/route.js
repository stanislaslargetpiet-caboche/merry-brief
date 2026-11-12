// Confirme au couple, par mail, que sa ou ses demandes de devis sont bien parties (planche V55).
// Appelé depuis lib/dash/store.js (sendQuotes) juste après l'envoi aux prestataires. Part à tous les
// organisateurs ayant un compte sur ce mariage (wedding_members), pas seulement à celui qui a cliqué
// (D-311). Toujours en best-effort : les demandes restent de toute façon enregistrées dans Merry, seul
// ce mail est facultatif.

import { createClient } from "@supabase/supabase-js";
import { publicOrigin } from "@/lib/server/origin";
import { allowUser } from "@/lib/server/rate";
import { demandesEnvoyeesMail } from "@/lib/server/demandeCoupleMail";
import { sendMail } from "@/lib/server/sendMail";

export const runtime = "nodejs";

export async function POST(req) {
  if (!process.env.RESEND_API_KEY) return Response.json({ error: "no_mail" }, { status: 501 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!url || !key || !token) return Response.json({ error: "auth" }, { status: 401 });
  const sb = createClient(url, key, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: user } = await sb.auth.getUser(token);
  const me = String(user?.user?.email || "").trim();
  if (!me) return Response.json({ error: "auth" }, { status: 401 });

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const names = Array.isArray(body.names) ? body.names.map((n) => String(n || "").slice(0, 120).trim()).filter(Boolean).slice(0, 20) : [];
  if (!names.length) return Response.json({ error: "bad_request" }, { status: 400 });
  const weddingId = String(body.weddingId || "");

  if (!(await allowUser(sb, "couple_mail", 60, 86400))) return Response.json({ error: "quota" }, { status: 429 });

  // Lus avec le jeton de l'appelant : les règles d'accès (is_wedding_member) limitent déjà le résultat
  // à l'équipe du mariage de l'appelant.
  let recipients = [me];
  if (weddingId) {
    const { data: members } = await sb.from("wedding_members").select("email, user_id").eq("wedding_id", weddingId);
    const emails = (members || []).filter((m) => m.user_id && m.email).map((m) => String(m.email).trim().toLowerCase());
    if (emails.length) recipients = [...new Set(emails)];
  }

  const dashboardLink = `${publicOrigin(req)}/dashboard/prestataires/messagerie`;
  const mail = demandesEnvoyeesMail({ names, dashboardLink });
  let sent = 0;
  for (const to of recipients) {
    if (await sendMail({ to, ...mail, label: "demandes envoyées" })) sent += 1;
  }
  if (!sent) return Response.json({ error: "send_failed" }, { status: 502 });
  return Response.json({ ok: true, sent });
}

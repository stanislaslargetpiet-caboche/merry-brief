// Mail « ta liste compte N invités » juste après un import, quand le formulaire n'a encore jamais été
// partagé (planche V59, leçon Mariages.net). Appelé depuis app/dashboard/invites/importer/page.js.
// N'envoie qu'une fois par mariage (mail_sent, via deliver) : plusieurs imports ne redonnent pas le mail.
// Toujours en best-effort : les invités importés restent de toute façon enregistrés.

import { createClient } from "@supabase/supabase-js";
import { publicOrigin } from "@/lib/server/origin";
import { allowUser } from "@/lib/server/rate";
import { apresImportMail } from "@/lib/server/formulaireLeconsMail";
import { deliver } from "@/lib/server/mailJobs";

export const runtime = "nodejs";

export async function POST(req) {
  if (!process.env.RESEND_API_KEY) return Response.json({ error: "no_mail" }, { status: 501 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!url || !key || !service || !token) return Response.json({ error: "auth" }, { status: 401 });
  const sb = createClient(url, key, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: user } = await sb.auth.getUser(token);
  const to = String(user?.user?.email || "").trim();
  if (!user?.user || !to) return Response.json({ error: "auth" }, { status: 401 });

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const weddingId = String(body.weddingId || "");
  if (!weddingId) return Response.json({ error: "bad_request" }, { status: 400 });

  // Lues avec le jeton de l'appelant : les règles d'accès (is_wedding_member) suffisent à vérifier
  // qu'il organise bien ce mariage.
  const { data: form } = await sb.from("guest_forms").select("shared_at").eq("wedding_id", weddingId).maybeSingle();
  if (form?.shared_at) return Response.json({ ok: true, skipped: "deja_partage" });
  const { count } = await sb.from("guests").select("id", { count: "exact", head: true }).eq("wedding_id", weddingId);
  if (!count) return Response.json({ ok: true, skipped: "aucun_invite" });

  if (!(await allowUser(sb, "couple_mail", 60, 86400))) return Response.json({ error: "quota" }, { status: 429 });

  const duplicates = Math.max(0, Math.round(Number(body.duplicates) || 0));
  const formLink = `${publicOrigin(req)}/dashboard/invites/formulaire`;
  const mail = apresImportMail({ guestCount: count, duplicates, formLink });
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const sent = await deliver(admin, `lecon-v59:${weddingId}`, { to, ...mail, label: "après import" });
  return Response.json({ ok: true, sent });
}

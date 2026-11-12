// Confirme au couple que son formulaire invités est en ligne, la première fois qu'il copie ou partage
// le lien (planche V60, leçon Mariages.net). Appelé depuis app/dashboard/invites/formulaire/page.js,
// une fois par mariage (guest_forms.shared_at, supabase/mails-lecons.sql). Toujours en best-effort : le
// lien fonctionne de toute façon, seul ce mail est facultatif.

import { createClient } from "@supabase/supabase-js";
import { publicOrigin } from "@/lib/server/origin";
import { allowUser } from "@/lib/server/rate";
import { formulairePublieMail } from "@/lib/server/formulaireLeconsMail";
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
  const to = String(user?.user?.email || "").trim();
  if (!to) return Response.json({ error: "auth" }, { status: 401 });

  if (!(await allowUser(sb, "couple_mail", 60, 86400))) return Response.json({ error: "quota" }, { status: 429 });

  const formLink = `${publicOrigin(req)}/dashboard/invites/formulaire`;
  const mail = formulairePublieMail({ formLink });
  const ok = await sendMail({ to, ...mail, label: "formulaire publié" });
  if (!ok) return Response.json({ error: "send_failed" }, { status: 502 });
  return Response.json({ ok: true, sent: 1 });
}

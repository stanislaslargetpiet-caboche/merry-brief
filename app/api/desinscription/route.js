// Page /desinscription (planches V30 et V30b) : lit, retire ou rétablit une adresse dans
// mail_optouts à partir du lien signé du mail, sans compte ni connexion.

import { createClient } from "@supabase/supabase-js";
import { readUnsubLink } from "@/lib/server/mailOptouts";

export const runtime = "nodejs";

const KIND = "vendor_message";

export async function POST(req) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return Response.json({ error: "not_configured" }, { status: 501 });

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const email = readUnsubLink(body.e, body.t);
  if (!email) return Response.json({ error: "bad_link" }, { status: 403 });

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  if (body.action === "desinscrire") {
    const { error } = await admin.from("mail_optouts").upsert({ email, kind: KIND }, { onConflict: "email,kind", ignoreDuplicates: true });
    if (error) return Response.json({ error: "failed" }, { status: 502 });
    return Response.json({ email, out: true });
  }
  if (body.action === "reabonner") {
    const { error } = await admin.from("mail_optouts").delete().eq("email", email).eq("kind", KIND);
    if (error) return Response.json({ error: "failed" }, { status: 502 });
    return Response.json({ email, out: false });
  }
  const { data, error } = await admin.from("mail_optouts").select("email").eq("email", email).eq("kind", KIND).maybeSingle();
  if (error) return Response.json({ error: "failed" }, { status: 502 });
  return Response.json({ email, out: !!data });
}

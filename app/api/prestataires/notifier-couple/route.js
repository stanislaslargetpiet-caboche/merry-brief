// Prévient le couple par mail quand un prestataire leur répond via /pro/demandes (pro_send).
// Nécessite RESEND_API_KEY et SUPABASE_SERVICE_ROLE_KEY côté serveur (Vercel > Settings > Environment
// Variables) et supabase/prestataires-notifier-couple.sql (pro_notify_couple_payload) collé dans Supabase.
// Sans clé, sans RPC ou sans mail connu pour les organisateurs, la route répond sans rien
// envoyer : la réponse reste de toute façon enregistrée dans Merry, seul le mail est facultatif.

import { createClient } from "@supabase/supabase-js";
import { publicOrigin } from "@/lib/server/origin";
import { allowUser } from "@/lib/server/rate";

export const runtime = "nodejs";

const FROM = process.env.MERRY_MAIL_FROM || "Merry <onboarding@resend.dev>";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export async function POST(req) {
  if (!process.env.RESEND_API_KEY) return Response.json({ error: "no_mail" }, { status: 501 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!url || !key || !token) return Response.json({ error: "auth" }, { status: 401 });
  const sb = createClient(url, key, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: user } = await sb.auth.getUser(token);
  if (!user?.user) return Response.json({ error: "auth" }, { status: 401 });

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const clientId = String(body.clientId || "");
  if (!clientId) return Response.json({ error: "bad_request" }, { status: 400 });

  // Les adresses des organisateurs ne sont lues que par le serveur (clé service_role), après avoir
  // vérifié avec le jeton du prestataire que ce client est bien l'un des siens (is_pro_member, RLS)
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!service) return Response.json({ error: "no_mail" }, { status: 501 });
  const { data: client } = await sb.from("pro_clients").select("id, vendor_id").eq("id", clientId).maybeSingle();
  if (!client) return Response.json({ error: "not_found" }, { status: 404 });
  const { data: mine } = await sb.rpc("is_pro_member", { v: client.vendor_id });
  if (mine !== true) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!(await allowUser(sb, "couple_mail", 60, 86400))) return Response.json({ error: "quota" }, { status: 429 });
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: rows, error } = await admin.rpc("pro_notify_couple_payload", { c: clientId });
  if (error) return Response.json({ error: "no_mail" }, { status: 501 });
  const recipients = (rows || []).filter((r) => EMAIL_RE.test(String(r.to_email || "").trim()));
  if (!recipients.length) return Response.json({ error: "no_email" }, { status: 422 });

  const link = `${publicOrigin(req)}/dashboard/prestataires/messagerie`;
  const vendorName = recipients[0].vendor_name || "Un prestataire";

  const subject = `${vendorName} vous a répondu`;
  const text = `Bonjour,\n\n${vendorName} vous a répondu sur Merry.\n\nPour lire le message et répondre :\n${link}\n\nPour votre sécurité, échangez et réglez toujours vos prestataires depuis Merry.\n\nL'équipe Merry`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#111">
<p>Bonjour,</p>
<p>${esc(vendorName)} vous a répondu sur Merry.</p>
<p><a href="${esc(link)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600">Lire le message</a></p>
<p style="font-size:13px;color:#666">Pour votre sécurité, échangez et réglez toujours vos prestataires depuis Merry. Ce lien ne fonctionne qu'une fois connecté·e.<br>S'il ne s'ouvre pas, copiez-le dans votre navigateur :<br>${esc(link)}</p></div>`;

  let sent = 0;
  for (const r of recipients) {
    const to = String(r.to_email).trim();
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      body: JSON.stringify({ from: FROM, to: [to], subject, text, html }),
    });
    if (res.ok) sent += 1;
    else console.error("[merry] notification couple", res.status, await res.text().catch(() => ""));
  }
  if (!sent) return Response.json({ error: "send_failed" }, { status: 502 });
  return Response.json({ ok: true, sent });
}

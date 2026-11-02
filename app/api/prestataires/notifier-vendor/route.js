// Prévient un prestataire par mail (via Resend) qu'un couple lui a écrit sur Merry — demande de devis
// ou message dans la Messagerie — et l'invite à revendiquer sa fiche pour voir et répondre.
// Nécessite RESEND_API_KEY côté serveur (Vercel > Settings > Environment Variables).
// Sans clé ou sans mail connu pour ce prestataire, la route répond sans rien envoyer : le message reste
// de toute façon enregistré dans Merry, seul l'e-mail de relance est facultatif.

import { createClient } from "@supabase/supabase-js";

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
  const vendorId = String(body.vendorId || "");
  if (!vendorId) return Response.json({ error: "bad_request" }, { status: 400 });

  // La lecture passe par les règles d'accès : seul un organisateur du mariage concerné voit cette fiche.
  const { data: vendor } = await sb.from("vendors").select("id, name, email, wedding_id").eq("id", vendorId).maybeSingle();
  if (!vendor) return Response.json({ error: "not_found" }, { status: 404 });
  const to = String(vendor.email || "").trim();
  if (!EMAIL_RE.test(to)) return Response.json({ error: "no_email" }, { status: 422 });

  const { data: wedding } = await sb.from("weddings").select("partner1, partner2").eq("id", vendor.wedding_id).maybeSingle();
  const couple = [wedding?.partner1, wedding?.partner2].filter(Boolean).join(" et ") || "Un couple";

  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const link = `${proto}://${host}/pro/fiche`;

  const subject = `${couple} vous a écrit sur Merry`;
  const text = `Bonjour,\n\n${couple} vous a envoyé un message sur Merry.\n\nPour le lire et répondre, revendiquez votre fiche (gratuit) :\n${link}\n\nL'équipe Merry`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#111">
<p>Bonjour,</p>
<p>${esc(couple)} vous a envoyé un message sur Merry.</p>
<p><a href="${esc(link)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600">Lire le message</a></p>
<p style="font-size:13px;color:#666">Il suffit de revendiquer votre fiche (gratuit) pour le lire et répondre. Ce lien ne fonctionne qu'une fois connecté·e.<br>S'il ne s'ouvre pas, copiez-le dans votre navigateur :<br>${esc(link)}</p></div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    body: JSON.stringify({ from: FROM, to: [to], subject, text, html }),
  });
  if (!res.ok) {
    console.error("[merry] notification prestataire", res.status, await res.text().catch(() => ""));
    return Response.json({ error: "send_failed" }, { status: 502 });
  }
  return Response.json({ ok: true, to });
}

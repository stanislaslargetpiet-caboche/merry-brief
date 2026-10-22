// Envoi automatique de l'invitation d'un organisateur par mail (via Resend), sans passer
// par la messagerie de l'ordinateur de l'expéditeur. Réservé aux organisateurs connectés.
// Nécessite RESEND_API_KEY côté serveur (Vercel > Settings > Environment Variables).
// Sans clé, la route répond 501 et le tableau de bord retombe sur l'ouverture de la messagerie.

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

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const memberId = String(body.memberId || "");
  if (!memberId) return Response.json({ error: "bad_request" }, { status: 400 });

  const { data: user } = await sb.auth.getUser(token);
  if (!user?.user) return Response.json({ error: "auth" }, { status: 401 });

  // La lecture passe par les règles d'accès : seul un organisateur du mariage voit cette ligne.
  const { data: member } = await sb.from("wedding_members").select("id, wedding_id, display_name, email, invite_token, user_id").eq("id", memberId).maybeSingle();
  if (!member) return Response.json({ error: "not_found" }, { status: 404 });
  if (member.user_id) return Response.json({ error: "already_member" }, { status: 409 });
  const to = String(member.email || "").trim();
  if (!EMAIL_RE.test(to)) return Response.json({ error: "no_email" }, { status: 422 });

  const { data: wedding } = await sb.from("weddings").select("partner1, partner2").eq("id", member.wedding_id).maybeSingle();
  const couple = [wedding?.partner1, wedding?.partner2].filter(Boolean).join(" et ") || "nos proches";

  // Signature : le prénom de l'organisateur qui envoie l'invitation
  const { data: me } = await sb.from("wedding_members").select("display_name").eq("wedding_id", member.wedding_id).eq("user_id", user.user.id).maybeSingle();
  const sender = String(me?.display_name || user.user.user_metadata?.first_name || "").trim();

  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const link = `${proto}://${host}/connexion?invitation=${member.invite_token}`;

  const subject = sender ? `${sender} t'invite à rejoindre Merry` : "Tu es invité(e) à rejoindre Merry";
  const text = `Hello !\n\nJe t'invite à rejoindre Merry pour organiser notre événement.\n\n${link}${sender ? `\n\n${sender}` : ""}`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#111">
<p>Hello !</p>
<p>Je t'invite à rejoindre Merry pour organiser notre événement.</p>
<p><a href="${esc(link)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600">Rejoindre Merry</a></p>
${sender ? `<p>${esc(sender)}</p>\n` : ""}<p style="font-size:13px;color:#666">Ce lien ne sert qu'une fois. S'il ne s'ouvre pas, copie-le dans ton navigateur :<br>${esc(link)}</p></div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    body: JSON.stringify({ from: FROM, to: [to], subject, text, html, reply_to: user.user.email || undefined }),
  });
  if (!res.ok) {
    console.error("[merry] envoi invitation", res.status, await res.text().catch(() => ""));
    return Response.json({ error: "send_failed" }, { status: 502 });
  }
  return Response.json({ ok: true, to });
}

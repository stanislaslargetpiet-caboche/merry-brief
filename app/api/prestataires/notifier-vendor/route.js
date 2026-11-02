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
  // Demande de devis (dates/budget/questions) : facultatif, absent pour un message de la Messagerie
  const message = String(body.message || "").slice(0, 4000).trim();
  const dates = Array.isArray(body.dates) ? body.dates.map((d) => String(d || "").slice(0, 200)).filter(Boolean).slice(0, 3) : [];
  const budget = body.budget ? String(body.budget).slice(0, 80) : "";
  const questions = Array.isArray(body.questions) ? body.questions.map((q) => String(q || "").slice(0, 300)).filter(Boolean).slice(0, 10) : [];
  const sign = body.sign ? String(body.sign).slice(0, 300).trim() : "";
  const guests = body.guests ? String(body.guests).slice(0, 60) : "";
  const isRequest = dates.length > 0 || !!budget || questions.length > 0;

  // La lecture passe par les règles d'accès : seul un organisateur du mariage concerné voit cette fiche.
  const { data: vendor } = await sb.from("vendors").select("id, name, email, wedding_id").eq("id", vendorId).maybeSingle();
  if (!vendor) return Response.json({ error: "not_found" }, { status: 404 });
  const to = String(vendor.email || "").trim();
  if (!EMAIL_RE.test(to)) return Response.json({ error: "no_email" }, { status: 422 });

  const { data: wedding } = await sb.from("weddings").select("partner1, partner2").eq("id", vendor.wedding_id).maybeSingle();
  const couple = [wedding?.partner1, wedding?.partner2].filter(Boolean).join(" et ") || "Un couple";
  const initials = [wedding?.partner1, wedding?.partner2].map((n) => String(n || "").trim()[0] || "").join("").toUpperCase() || "M";

  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const link = `${proto}://${host}/pro/fiche`;

  const subject = isRequest ? `${couple} vous a écrit` : `${couple} vous a écrit sur Merry`;
  const plainParts = [`Bonjour,`, message || `${couple} vous a envoyé un message sur Merry.`];
  if (dates.length) plainParts.push(dates[0]);
  if (budget) plainParts.push(`Notre budget : ${budget} au total.`);
  if (questions.length) plainParts.push(questions.map((q) => `– ${q}`).join("\n"));
  if (sign) plainParts.push(sign);
  plainParts.push(`Pour lire le message et répondre, revendiquez votre fiche (gratuit) :\n${link}`, `L'équipe Merry`);
  const text = plainParts.join("\n\n");

  const infoTiles = [
    dates[0] ? { label: "DATE", value: dates[0].replace(/^Dates flexibles\s*:\s*/i, "") } : null,
    guests ? { label: "INVITÉS", value: guests } : null,
    budget ? { label: "BUDGET", value: budget } : null,
  ].filter(Boolean);

  const infoCard = isRequest
    ? `<div style="margin-top:20px;background:#f4f3ef;border-radius:18px;padding:16px">
<div style="display:flex;align-items:center;gap:10px"><span style="flex:none;width:36px;height:36px;border-radius:999px;background:#e9dff3;color:#4a3a5c;display:inline-flex;align-items:center;justify-content:center;font-size:13px;font-weight:700">${esc(initials)}</span><div style="display:flex;flex-direction:column;min-width:0"><span style="font-size:15px;font-weight:600">${esc(couple)}</span><span style="font-size:12px;color:#6b6a63">Vous écrivent via Merry</span></div></div>${
        infoTiles.length
          ? `<div style="margin-top:12px;display:grid;grid-template-columns:repeat(${infoTiles.length},minmax(0,1fr));gap:8px">${infoTiles
              .map(
                (t) =>
                  `<div style="background:#ffffff;border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:5px;min-width:0"><div style="font-size:10.5px;font-weight:600;letter-spacing:.08em;color:#6b6a63">${esc(t.label)}</div><div style="font-size:14px;font-weight:600;white-space:nowrap">${esc(t.value)}</div></div>`,
              )
              .join("")}</div>`
          : ""
      }</div>`
    : "";

  const questionsBlock = questions.length
    ? `<div style="margin-top:20px;background:#ffffff;border:1px solid #ecebe6;border-radius:14px;padding:16px"><span style="font-size:11.5px;font-weight:700;letter-spacing:.08em;color:#6b6a63">QUELQUES QUESTIONS</span><div style="margin-top:10px;display:flex;flex-direction:column;gap:8px;font-size:14.5px;line-height:1.5">${questions.map((q) => `<span>– ${esc(q)}</span>`).join("")}</div></div>`
    : "";

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#111;max-width:560px">
<p>Bonjour,</p>
<p>${esc(message || `${couple} vous a envoyé un message sur Merry.`)}</p>
${infoCard}
${questionsBlock}
${sign ? `<p style="white-space:pre-line">${esc(sign)}</p>` : ""}
<p><a href="${esc(link)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600">Lire le message et répondre</a></p>
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

// Prévient un prestataire par mail (via Resend) qu'un couple lui a écrit sur Merry — demande de devis
// ou message dans la Messagerie — et l'invite à revendiquer sa fiche pour voir et répondre.
// Nécessite RESEND_API_KEY côté serveur (Vercel > Settings > Environment Variables).
// Sans clé ou sans mail connu pour ce prestataire, la route répond sans rien envoyer : le message reste
// de toute façon enregistré dans Merry, seul l'e-mail de relance est facultatif.

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

  // Le texte du mail vient du couple et l'adresse de sa fiche prestataire : 40 mails par jour et par
  // personne, pour que l'expéditeur Merry ne serve pas à envoyer n'importe quoi à n'importe qui
  if (!(await allowUser(sb, "vendor_mail", 40, 86400))) return Response.json({ error: "quota" }, { status: 429 });
  // Le lien ouvre directement la fiche du catalogue à revendiquer, quand on la connaît
  const { data: pick } = await sb.from("vendor_picks").select("catalog_ref").eq("wedding_id", vendor.wedding_id).eq("vendor_id", vendorId).maybeSingle();
  const catalogId = /^catalog:([0-9a-f-]{36})$/i.exec(String(pick?.catalog_ref || ""))?.[1] || null;
  const link = `${publicOrigin(req)}/pro${catalogId ? `?fiche=${catalogId}` : ""}`;

  // Deux prénoms : « vous ont écrit » ; le message du couple commence déjà par « Bonjour », on ne le redouble pas
  const verb = wedding?.partner1 && wedding?.partner2 ? "vous ont écrit" : "vous a écrit";
  const subject = isRequest ? `${couple} ${verb}` : `${couple} ${verb} sur Merry`;
  const greets = /^\s*(bonjour|bonsoir|hello|salut|cher|chère)/i.test(message);
  const plainParts = [...(greets ? [] : [`Bonjour,`]), message || `${couple} ${verb} sur Merry.`];
  if (dates.length) plainParts.push(dates[0]);
  if (budget) plainParts.push(`Notre budget : ${budget} au total.`);
  if (questions.length) plainParts.push(questions.map((q) => `– ${q}`).join("\n"));
  if (sign) plainParts.push(sign);
  plainParts.push(`Répondre sur Merry : ${link}`);
  const text = plainParts.join("\n\n");

  // Premier prénom de chacun, pour le bouton (« Répondre à Camille et Lou », sur le modèle du
  // « Reply to Diana » de HomeExchange) ; on retombe sur le nom complet si on n'a qu'un prénom.
  const firstName = (n) => String(n || "").trim().split(/\s+/)[0] || "";
  const firstNames = [firstName(wedding?.partner1), firstName(wedding?.partner2)].filter(Boolean).join(" et ") || couple;

  // Mise en page en tableaux : Gmail ignore flex et grid (avant le 3 nov. 2026, la pastille du couple
  // était rognée et « DATE » collé à sa valeur). Plus de phrases grises, à la demande de Stan.
  const headerBlock = `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:16px"><tr>
<td width="40" height="40" align="center" valign="middle" style="width:40px;height:40px;border-radius:20px;background:#e9dff3;color:#4a3a5c;font-size:14px;font-weight:700;line-height:40px">${esc(initials)}</td>
<td style="padding-left:12px;font-size:17px;font-weight:700">${esc(couple)}</td>
</tr></table>`;

  // Message (et salutation si elle manque) à l'intérieur d'un encadré, comme le message de Diana
  // chez HomeExchange, pour le distinguer du reste du mail.
  const messageBox = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f3ef;border-radius:16px;border-collapse:separate"><tr><td style="padding:18px 20px;font-size:16px;line-height:1.5">
${greets ? "" : '<p style="margin:0 0 10px">Bonjour,</p>'}<p style="margin:0;white-space:pre-line">${esc(message || `${couple} ${verb} sur Merry.`)}</p>
</td></tr></table>`;

  const infoTiles = [
    dates[0] ? { label: "Date", value: dates[0].replace(/^Dates flexibles\s*:\s*/i, "") } : null,
    guests ? { label: "Invités", value: guests } : null,
    budget ? { label: "Budget", value: budget } : null,
  ].filter(Boolean);

  const tilesBlock = infoTiles.length
    ? infoTiles
        .map(
          (t) =>
            `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;background:#ffffff;border:1px solid #ecebe6;border-radius:10px;border-collapse:separate"><tr><td style="padding:10px 14px"><div style="font-size:12px;color:#6b6a63">${esc(t.label)}</div><div style="margin-top:2px;font-size:15px;font-weight:700">${esc(t.value)}</div></td></tr></table>`,
        )
        .join("")
    : "";

  const questionsBlock = questions.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;border:1px solid #ecebe6;border-radius:14px;border-collapse:separate"><tr><td style="padding:16px;font-size:15px;line-height:1.5"><div style="font-weight:700;margin-bottom:8px">Leurs questions</div>${questions.map((q) => `<div style="margin-top:6px">– ${esc(q)}</div>`).join("")}</td></tr></table>`
    : "";

  // Bouton centré et visible sans avoir à faire défiler, sur le modèle du « Reply to Diana » de
  // HomeExchange : on répond depuis Merry, jamais en répondant directement à ce mail.
  const ctaBlock = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px"><tr><td align="center">
<a href="${esc(link)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:700;font-size:15px">Répondre à ${esc(firstNames)}</a>
</td></tr></table>`;

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#111;max-width:560px">
${headerBlock}
${messageBox}
${tilesBlock}
${questionsBlock}
${sign ? `<p style="white-space:pre-line;margin-top:20px">${esc(sign)}</p>` : ""}
${ctaBlock}
<p style="margin-top:20px;font-size:13px;color:#8a8a82;text-align:center">Vous recevez ce mail car ${esc(couple)} vous a contacté sur Merry. Pour répondre, utilisez le bouton ci-dessus plutôt que de répondre directement à ce mail.</p>
</div>`;

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

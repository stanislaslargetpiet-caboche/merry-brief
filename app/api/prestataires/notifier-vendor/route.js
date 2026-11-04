// Prévient un prestataire par mail (via Resend) qu'un couple lui a écrit sur Merry — demande de devis
// ou message dans la Messagerie — et l'invite à revendiquer sa fiche pour voir et répondre.
// Nécessite RESEND_API_KEY côté serveur (Vercel > Settings > Environment Variables).
// Sans clé ou sans mail connu pour ce prestataire, la route répond sans rien envoyer : le message reste
// de toute façon enregistré dans Merry, seul l'e-mail de relance est facultatif.

import { createClient } from "@supabase/supabase-js";
import { publicOrigin } from "@/lib/server/origin";
import { allowUser } from "@/lib/server/rate";
import { mailShell } from "@/lib/server/mailShell";

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

  // Le lien ouvre directement la fiche du catalogue à revendiquer, quand on la connaît
  const { data: pick } = await sb.from("vendor_picks").select("catalog_ref").eq("wedding_id", vendor.wedding_id).eq("vendor_id", vendorId).maybeSingle();
  const catalogId = /^catalog:([0-9a-f-]{36})$/i.exec(String(pick?.catalog_ref || ""))?.[1] || null;
  const origin = publicOrigin(req);

  // adresse → lien : la fiche du catalogue d'un côté, les comptes qui gèrent déjà la fiche de l'autre.
  // Sans clé service_role ou sans la fonction SQL, on retombe sur la seule adresse de la fiche.
  const recipients = new Map();
  const contact = String(vendor.email || "").trim();
  if (EMAIL_RE.test(contact)) recipients.set(contact.toLowerCase(), `${origin}/pro${catalogId ? `?fiche=${catalogId}` : ""}`);
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (service && catalogId) {
    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: members } = await admin.rpc("pro_notify_vendor_members", { v: catalogId });
    for (const m of members || []) {
      const email = String(m.to_email || "").trim();
      if (EMAIL_RE.test(email)) recipients.set(email.toLowerCase(), `${origin}/pro?fiche=${catalogId}&connexion=1`);
    }
  }
  if (!recipients.size) return Response.json({ error: "no_email" }, { status: 422 });

  const { data: wedding } = await sb.from("weddings").select("partner1, partner2").eq("id", vendor.wedding_id).maybeSingle();
  const couple = [wedding?.partner1, wedding?.partner2].filter(Boolean).join(" et ") || "Un couple";
  const initials = [wedding?.partner1, wedding?.partner2].map((n) => String(n || "").trim()[0] || "").join("").toUpperCase() || "M";

  // Le texte du mail vient du couple et l'adresse de sa fiche prestataire : 40 mails par jour et par
  // personne, pour que l'expéditeur Merry ne serve pas à envoyer n'importe quoi à n'importe qui
  if (!(await allowUser(sb, "vendor_mail", 40, 86400))) return Response.json({ error: "quota" }, { status: 429 });

  // Deux prénoms : « vous ont écrit » ; le message du couple commence déjà par « Bonjour », on ne le redouble pas
  const verb = wedding?.partner1 && wedding?.partner2 ? "vous ont écrit" : "vous a écrit";
  const subject = isRequest ? `${couple} ${verb}` : `${couple} ${verb} sur Merry`;
  const plainParts = [message || `${couple} ${verb} sur Merry.`];
  const [firstDate, ...otherDates] = dates;
  const otherDatesLine = otherDates.length ? `Autres dates possibles : ${otherDates.join(", ")}` : "";
  if (firstDate) plainParts.push(firstDate);
  if (otherDatesLine) plainParts.push(otherDatesLine);
  if (budget) plainParts.push(`Notre budget : ${budget} au total.`);
  if (questions.length) plainParts.push(questions.map((q) => `– ${q}`).join("\n"));
  if (sign) plainParts.push(sign);

  // Premier prénom de chacun, pour le bouton (« Répondre à Camille et Lou », sur le modèle du
  // « Reply to Diana » de HomeExchange) ; on retombe sur le nom complet si on n'a qu'un prénom.
  const firstName = (n) => String(n || "").trim().split(/\s+/)[0] || "";
  const firstNames = [firstName(wedding?.partner1), firstName(wedding?.partner2)].filter(Boolean).join(" et ") || couple;

  // Mise en page en tableaux : Gmail ignore flex et grid (avant le 3 nov. 2026, la pastille du couple
  // était rognée et « DATE » collé à sa valeur). Reprend à l'identique la planche V21 du canvas
  // (page « 7 - mails ») : logo, titre, carte message + tuiles, questions, bouton, pied de page —
  // seules les icônes SVG des tuiles restent absentes (Outlook desktop ne les rend pas).
  const titleBlock = `<h1 style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:26px;line-height:1.15;color:#1c1c1a">${esc(couple)} ${esc(verb)}.</h1>`;

  const headerBlock = `<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td width="36" height="36" align="center" valign="middle" style="width:36px;height:36px;border-radius:18px;background:#fffdb8;color:#574e00;font-size:13px;font-weight:700;line-height:36px">${esc(initials)}</td>
<td style="padding-left:10px;font-size:15px;font-weight:700">${esc(couple)}</td>
</tr></table>`;

  const infoTiles = [
    firstDate ? { label: /^Dates flexibles/i.test(firstDate) ? "Dates flexibles" : "Date", value: firstDate.replace(/^Dates flexibles\s*:\s*/i, "") } : null,
    guests ? { label: "Invités", value: guests } : null,
    budget ? { label: "Budget", value: budget } : null,
  ].filter(Boolean);

  const tilesBlock = infoTiles.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px"><tr>${infoTiles
        .map(
          (t) =>
            `<td width="${Math.floor(100 / infoTiles.length)}%" style="padding-right:8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #ecebe6;border-radius:12px;border-collapse:separate"><tr><td style="padding:10px"><div style="font-size:10.5px;font-weight:600;letter-spacing:.06em;color:#6b6a63;text-transform:uppercase">${esc(t.label)}</div><div style="margin-top:2px;font-size:14px;font-weight:600">${esc(t.value)}</div></td></tr></table></td>`,
        )
        .join("")}</tr></table>`
    : "";

  // Carte avatar + nom + tuiles, comme le mock : le texte du couple vient ensuite, en paragraphes
  // ordinaires sous la carte (jamais à l'intérieur), tel quel sans salutation ajoutée.
  const messageBox = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f1;border-radius:20px;border-collapse:separate"><tr><td style="padding:16px">
${headerBlock}
${tilesBlock}
</td></tr></table>`;

  const messageParts = (message || `${couple} ${verb} sur Merry.`)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:16px 0 0;font-size:15px;line-height:1.6;white-space:pre-line">${esc(p)}</p>`)
    .join("");

  const questionsBlock = questions.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;background:#ffffff;border:1px solid #ecebe6;border-radius:12px;border-collapse:separate"><tr><td style="padding:16px"><div style="font-size:11.5px;font-weight:700;letter-spacing:.06em;color:#6b6a63;text-transform:uppercase">Quelques questions</div><div style="margin-top:10px;font-size:14.5px;line-height:1.6">${questions.map((q) => `<div style="margin-top:6px">– ${esc(q)}</div>`).join("")}</div></td></tr></table>`
    : "";

  // Bouton centré et visible sans avoir à faire défiler ; texte et couleur repris du mock (noir plein,
  // jamais le citron — réservé aux contextes déjà cadrés dans l'accent).
  const ctaBlock = (link) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px"><tr><td align="center">
<a href="${esc(link)}" style="display:inline-block;background:#1c1c1a;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:700;font-size:15px">Lire le message et répondre</a>
</td></tr></table>`;

  // Logo centré sur une pastille citron plein, repris du design validé avec Stan sur le canvas (V20/V21)
  const logoBlock = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px"><tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" style="background:#fff700;border-radius:999px"><tr><td style="padding:10px 24px;font-size:22px;font-weight:800;letter-spacing:-0.01em;color:#1c1c1a">Merry</td></tr></table>
</td></tr></table>`;

  const footerBlock = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;background:#f6f5f1;border-top:1px solid #ecebe6"><tr><td style="padding:18px 4px;font-size:12px;color:#9c9a90">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="font-size:12px;color:#9c9a90;line-height:1.5">Merry · withmerry.com<br>Vous recevez ce mail car votre établissement est référencé sur Merry.</td>
<td align="right" valign="top"><a href="${esc(publicOrigin(req))}/pro" style="color:#9c9a90;text-decoration:underline;white-space:nowrap;font-size:12px">Se désinscrire</a></td>
</tr></table>
</td></tr></table>`;

  // Preheader : l'aperçu que Gmail/Apple Mail affichent dans la liste des messages, invisible une
  // fois le mail ouvert.
  const preheader = (message || `${couple} ${verb} sur Merry.`).slice(0, 140);
  const otherDatesBlock = otherDatesLine ? `<p style="margin:16px 0 0;font-size:15px;line-height:1.6">${esc(otherDatesLine)}</p>` : "";

  let sent = 0;
  for (const [to, link] of recipients) {
    const text = [...plainParts, `Répondre sur Merry : ${link}`].join("\n\n");
    const bodyHtml = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1c1c1a;max-width:560px">
${logoBlock}
${titleBlock}
${messageBox}
${messageParts}
${otherDatesBlock}
${questionsBlock}
${sign ? `<p style="white-space:pre-line;margin-top:20px;font-size:15px;line-height:1.6">${esc(sign)}</p>` : ""}
${ctaBlock(link)}
${footerBlock}
</div>`;
    const html = mailShell({ title: subject, preheader, body: bodyHtml });
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      // Identifiant unique : sans lui, Gmail regroupe les messages et replie le bouton derrière « ••• »
      body: JSON.stringify({ from: FROM, to: [to], subject, text, html, headers: { "X-Entity-Ref-ID": crypto.randomUUID() } }),
    });
    if (res.ok) sent += 1;
    else console.error("[merry] notification prestataire", res.status, await res.text().catch(() => ""));
  }
  if (!sent) return Response.json({ error: "send_failed" }, { status: 502 });
  return Response.json({ ok: true, sent });
}

// Réponse au formulaire invités (/f/[slug] et rubrique « Ta réponse » du site de mariage) : la route
// enregistre la réponse par merry_form_submit, comme le navigateur le faisait, puis envoie à l'invité un
// mail de confirmation (lib/server/formConfirmationMail.js). Passer par le serveur garantit qu'aucun mail
// ne part sans une vraie réponse enregistrée. Les erreurs de la base (« Liste complète », « Date limite
// dépassée », « Trop de réponses ») reviennent telles quelles, le formulaire les traduit.
// Limites du mail : 20 par heure et par adresse IP, 5 par jour et par destinataire. Sans RESEND_API_KEY
// ou SUPABASE_SERVICE_ROLE_KEY, la réponse est enregistrée sans mail ; sans Supabase, 501 et le
// navigateur envoie lui-même.

import { after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { clientIp, publicOrigin } from "@/lib/server/origin";
import { allowKey } from "@/lib/server/rate";
import { sendMail } from "@/lib/server/sendMail";
import { formConfirmationMail, formCouple } from "@/lib/server/formConfirmationMail";

export const runtime = "nodejs";

const SLUG_RE = /^[a-z0-9-]{6,80}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function confirm({ url, anon, slug, payload, ip, origin }) {
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!process.env.RESEND_API_KEY || !service) return;
  const to = String(payload.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(to) || to.length > 200) return;
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  if (!(await allowKey(admin, `form-confirm-ip:${ip}`, 20, 3600))) return;
  if (!(await allowKey(admin, `form-confirm-to:${to}`, 5, 86400))) return;
  const { data: form, error } = await anon.rpc("merry_form_public", { form_slug: slug });
  if (error || !form) {
    console.error("[merry] mail confirmation formulaire : formulaire illisible", error?.message);
    return;
  }
  const mail = formConfirmationMail({ form, payload, link: `${origin}/f/${slug}` });
  await sendMail({ to, ...mail, fromName: formCouple(form), label: "mail confirmation formulaire" });
}

export async function POST(req) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return Response.json({ error: "not_configured" }, { status: 501 });

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const slug = String(body?.slug || "");
  const payload = body?.payload;
  if (!SLUG_RE.test(slug) || !payload || typeof payload !== "object" || Array.isArray(payload)) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const anon = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await anon.rpc("merry_form_submit", { form_slug: slug, payload });
  if (error) {
    console.error("[merry] envoi du formulaire", error.message);
    return Response.json({ error: error.message || "failed" }, { status: 400 });
  }

  // Après la réponse : l'invité voit « Merci, c'est noté » sans attendre le mail
  const job = { url, anon, slug, payload, ip: clientIp(req), origin: publicOrigin(req) };
  after(() => confirm(job).catch((e) => console.error("[merry] mail confirmation formulaire", e?.message || e)));
  return Response.json({ ok: true });
}

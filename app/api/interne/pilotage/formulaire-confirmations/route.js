// Rattrapage du mail de confirmation (D-209) pour les invités qui ont répondu à un formulaire avant sa mise
// en ligne le 10 nov. 2026. Réservé au pilotage (adresses de PILOTAGE_EMAILS, jeton de session Supabase).
//   GET  ?slug=…&avant=ISO : la liste des destinataires, sans rien envoyer
//   POST { slug, avant }   : l'envoi, une seule fois par invité (merry_throttle, clé par fiche)
// Destinataires : les fiches modifiées par le formulaire avant `avant`, avec une adresse mail, hors « +1 ».
// Le récapitulatif est relu dans la liste (présence par moment, accompagnant), pas dans la réponse
// envoyée, qui n'est pas gardée.

import { createClient } from "@supabase/supabase-js";
import { requirePilot } from "@/lib/server/pilotage/auth";
import { publicOrigin } from "@/lib/server/origin";
import { allowKey } from "@/lib/server/rate";
import { sendMail } from "@/lib/server/sendMail";
import { formConfirmationMail, formCouple } from "@/lib/server/formConfirmationMail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NO_STORE = { "cache-control": "private, no-store" };
const SLUG_RE = /^[a-z0-9-]{6,80}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MONTH = 30 * 24 * 3600;

async function recipients(admin, slug, avant) {
  const { data: f } = await admin.from("guest_forms").select("wedding_id").eq("slug", slug).maybeSingle();
  if (!f) return null;
  const w = f.wedding_id;
  const [{ data: acts }, { data: logs }] = await Promise.all([
    admin.from("guest_activity").select("guest_id").eq("wedding_id", w).eq("source", "formulaire").lt("created_at", avant),
    admin.from("guest_response_log").select("guest_id").eq("wedding_id", w).eq("source", "formulaire").lt("created_at", avant),
  ]);
  const ids = [...new Set([...(acts || []), ...(logs || [])].map((r) => r.guest_id).filter(Boolean))];
  if (!ids.length) return [];
  const [{ data: guests }, { data: plus }, { data: responses }] = await Promise.all([
    admin.from("guests").select("id, first_name, last_name, email, plus_one_of").in("id", ids),
    admin.from("guests").select("first_name, last_name, plus_one_of").eq("wedding_id", w).in("plus_one_of", ids),
    admin.from("guest_responses").select("guest_id, event_id, status").in("guest_id", ids),
  ]);
  return (guests || [])
    .filter((g) => !g.plus_one_of && EMAIL_RE.test(String(g.email || "").trim()))
    .map((g) => {
      const other = (plus || []).find((p) => p.plus_one_of === g.id);
      return {
        id: g.id,
        to: String(g.email).trim().toLowerCase(),
        payload: {
          first_name: g.first_name,
          last_name: g.last_name,
          answers: Object.fromEntries((responses || []).filter((r) => r.guest_id === g.id).map((r) => [r.event_id, r.status])),
          plus_one: other ? { first_name: other.first_name, last_name: other.last_name } : null,
        },
      };
    });
}

function readArgs(slug, avant) {
  const when = new Date(String(avant || ""));
  if (!SLUG_RE.test(String(slug || "")) || Number.isNaN(when.getTime())) return null;
  return { slug: String(slug), avant: when.toISOString() };
}

export async function GET(req) {
  const who = await requirePilot(req);
  if (who.refus) return who.refus;
  const params = new URL(req.url).searchParams;
  const args = readArgs(params.get("slug"), params.get("avant"));
  if (!args) return Response.json({ error: "invalide" }, { status: 400, headers: NO_STORE });
  const list = await recipients(who.admin, args.slug, args.avant);
  if (!list) return Response.json({ error: "introuvable" }, { status: 404, headers: NO_STORE });
  return Response.json({ n: list.length, destinataires: list.map((r) => `${r.payload.first_name} ${r.payload.last_name}`.trim()) }, { headers: NO_STORE });
}

export async function POST(req) {
  const who = await requirePilot(req);
  if (who.refus) return who.refus;
  if (!process.env.RESEND_API_KEY) return Response.json({ error: "no_mail" }, { status: 501, headers: NO_STORE });
  const body = await req.json().catch(() => ({}));
  const args = readArgs(body?.slug, body?.avant);
  if (!args) return Response.json({ error: "invalide" }, { status: 400, headers: NO_STORE });
  const list = await recipients(who.admin, args.slug, args.avant);
  if (!list) return Response.json({ error: "introuvable" }, { status: 404, headers: NO_STORE });

  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: form } = await anon.rpc("merry_form_public", { form_slug: args.slug });
  if (!form) return Response.json({ error: "introuvable" }, { status: 404, headers: NO_STORE });
  const link = `${publicOrigin(req)}/f/${args.slug}`;

  const result = { envoyes: 0, deja: 0, echecs: 0 };
  for (const r of list) {
    // Une seule fois par fiche : relancer la route ne renvoie rien à ceux qui l'ont déjà reçu
    if (!(await allowKey(who.admin, `form-confirm-rattrapage:${r.id}`, 1, MONTH))) {
      result.deja += 1;
      continue;
    }
    const mail = formConfirmationMail({ form, payload: r.payload, link });
    const ok = await sendMail({ to: r.to, ...mail, fromName: formCouple(form), label: "mail confirmation formulaire (rattrapage)" });
    result[ok ? "envoyes" : "echecs"] += 1;
    // Resend accepte deux envois par seconde
    await new Promise((resolve) => setTimeout(resolve, 600));
  }
  return Response.json(result, { headers: NO_STORE });
}

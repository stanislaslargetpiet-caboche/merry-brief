// Indicateurs de pilotage de Merry (page /pilotage), réservés aux adresses de PILOTAGE_EMAILS (celles de Stan par
// défaut). La page envoie le jeton de session Supabase ; la route vérifie l'adresse puis lit, en parallèle,
// Supabase (pilotage_stats, supabase/pilotage.sql), PostHog, Resend et Vercel. Chaque source peut manquer ou
// échouer sans priver la page des autres : ses erreurs sont rendues telles quelles dans `erreurs`.

import { createClient } from "@supabase/supabase-js";
import { readPostHog } from "@/lib/server/pilotage/posthog";
import { readResend } from "@/lib/server/pilotage/resend";
import { readSupabase } from "@/lib/server/pilotage/supabase";
import { readVercel } from "@/lib/server/pilotage/vercel";
import { allowedEmails } from "@/lib/server/pilotage/acces";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RANGES = new Set([1, 7, 30]);

async function guarded(name, fn, erreurs) {
  try {
    return await fn();
  } catch (e) {
    erreurs.push({ source: name, message: String(e?.message || e).slice(0, 300) });
    return null;
  }
}

export async function GET(req) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return Response.json({ error: "indisponible" }, { status: 501 });
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return Response.json({ error: "connexion" }, { status: 401 });

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin.auth.getUser(token);
  const email = String(data?.user?.email || "").toLowerCase();
  if (error || !email) return Response.json({ error: "connexion" }, { status: 401 });
  if (!allowedEmails().has(email)) return Response.json({ error: "interdit" }, { status: 403 });

  const asked = Number(new URL(req.url).searchParams.get("jours") || 7);
  const days = RANGES.has(asked) ? asked : 7;
  const erreurs = [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);

  try {
    const [supabase, posthog, resend, vercel] = await Promise.all([
      guarded("supabase", () => readSupabase(admin, days), erreurs),
      process.env.POSTHOG_PERSONAL_API_KEY
        ? guarded("posthog", () => readPostHog(days, { signal: controller.signal }), erreurs)
        : { disponible: false, raison: "POSTHOG_PERSONAL_API_KEY manquante" },
      guarded("resend", () => readResend(days, { signal: controller.signal }), erreurs),
      guarded("vercel", () => readVercel(days, { signal: controller.signal }), erreurs),
    ]);
    if (posthog?.erreurs?.length) erreurs.push(...posthog.erreurs);
    return Response.json(
      { ok: true, jours: days, genere: new Date().toISOString(), supabase, posthog, resend, vercel, erreurs },
      { headers: { "cache-control": "private, no-store" } },
    );
  } finally {
    clearTimeout(timer);
  }
}

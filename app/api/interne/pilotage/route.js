// Indicateurs de pilotage de Merry (page /pilotage), réservés aux adresses de PILOTAGE_EMAILS (celles de Stan par
// défaut). La page envoie le jeton de session Supabase ; la route vérifie l'adresse puis lit, en parallèle,
// Supabase (pilotage_stats, supabase/pilotage.sql), PostHog, Resend, Vercel, Search Console et le site lui-même. Chaque source peut manquer ou
// échouer sans priver la page des autres : ses erreurs sont rendues telles quelles dans `erreurs`.

import { readSearchConsole } from "@/lib/server/pilotage/google";
import { readSeoHealth } from "@/lib/server/pilotage/seo";
import { readPostHog } from "@/lib/server/pilotage/posthog";
import { readResend } from "@/lib/server/pilotage/resend";
import { readSupabase, readSupabaseCached } from "@/lib/server/pilotage/supabase";
import { readVercel } from "@/lib/server/pilotage/vercel";
import { requirePilot } from "@/lib/server/pilotage/auth";

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
  const who = await requirePilot(req);
  if (who.refus) return who.refus;
  const { admin } = who;

  const asked = Number(new URL(req.url).searchParams.get("jours") || 7);
  const days = RANGES.has(asked) ? asked : 7;
  // « Actualiser » demande une lecture neuve (?frais=1) ; sinon Supabase est lu par le cache de cinq minutes
  const fresh = new URL(req.url).searchParams.get("frais") === "1";
  const erreurs = [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);

  try {
    const [supabase, posthog, resend, vercel, google, seo] = await Promise.all([
      guarded("supabase", () => (fresh ? readSupabase(admin, days) : readSupabaseCached(days)), erreurs),
      process.env.POSTHOG_PERSONAL_API_KEY
        ? guarded("posthog", () => readPostHog(days, { signal: controller.signal }), erreurs)
        : { disponible: false, raison: "POSTHOG_PERSONAL_API_KEY manquante" },
      guarded("resend", () => readResend(days, { signal: controller.signal }), erreurs),
      guarded("vercel", () => readVercel(days, { signal: controller.signal }), erreurs),
      guarded("google", () => readSearchConsole(days, { signal: controller.signal }), erreurs),
      guarded("seo", () => readSeoHealth({ signal: controller.signal }), erreurs),
    ]);
    if (posthog?.erreurs?.length) erreurs.push(...posthog.erreurs);
    return Response.json(
      { ok: true, jours: days, genere: new Date().toISOString(), supabase, posthog, resend, vercel, google, seo, erreurs },
      { headers: { "cache-control": "private, no-store" } },
    );
  } finally {
    clearTimeout(timer);
  }
}

// Collecte des six sources du pilotage (Supabase, PostHog, Resend, Vercel, Search Console, santé du site), partagée
// entre la page (/api/interne/pilotage) et le mail quotidien de 8 h (/api/interne/quotidien). Chaque source peut
// manquer ou échouer sans priver les autres : ses erreurs sont rendues dans `erreurs`.

import { readSearchConsole } from "./google";
import { readSeoHealth } from "./seo";
import { readPostHog } from "./posthog";
import { readResend } from "./resend";
import { readSupabase, readSupabaseCached } from "./supabase";
import { readVercel } from "./vercel";

async function guarded(name, fn, erreurs) {
  try {
    return await fn();
  } catch (e) {
    erreurs.push({ source: name, message: String(e?.message || e).slice(0, 300) });
    return null;
  }
}

// `fresh` : lire Supabase sans le cache de cinq minutes (bouton « Actualiser », mail du matin)
export async function collectPilotage({ admin, days, fresh = false }) {
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
    return { supabase, posthog, resend, vercel, google, seo, erreurs };
  } finally {
    clearTimeout(timer);
  }
}

// Collecte des sources du pilotage (Supabase, PostHog, Resend, Vercel, Search Console, santé du site, registre des coûts), partagée
// entre la page (/api/interne/pilotage) et le mail quotidien de 8 h (/api/interne/quotidien). Chaque source peut
// manquer ou échouer sans priver les autres : ses erreurs sont rendues dans `erreurs`.

import { readCouts } from "./couts";
import { readDemandes } from "./demandes";
import { readReseau } from "./reseau";
import { readSearchConsole } from "./google";
import { readSeoHealth } from "./seo";
import { readPostHog, readPostHogSessions } from "./posthog";
import { readEnvoisAuto, readResend } from "./resend";
import { readCampagnes } from "./campagnes";
import { readSupabase, readSupabaseCached, readSupabaseHeures } from "./supabase";
import { readDernieresSessions, readUtilisateurs, withPostHog, withSessions } from "./utilisateurs";
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
// `windowMs` : fenêtre de la section Utilisateurs ; par défaut, la période en jours
export async function collectPilotage({ admin, days, fresh = false, windowMs = days * 86400 * 1000 }) {
  const erreurs = [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const [supabase, supabaseHeures, posthog, resend, envois, campagnes, vercel, google, seo, couts, demandes, reseau, utilisateurs] = await Promise.all([
      guarded("supabase", () => (fresh ? readSupabase(admin, days) : readSupabaseCached(days)), erreurs),
      // Filtre 24 h seulement : les mêmes mesures qu'au-dessus, heure par heure (supabase/pilotage-heures.sql)
      days === 1 ? guarded("supabase.heures", () => readSupabaseHeures(admin), erreurs) : null,
      process.env.POSTHOG_PERSONAL_API_KEY
        ? guarded("posthog", () => readPostHog(days, { signal: controller.signal }), erreurs)
        : { disponible: false, raison: "POSTHOG_PERSONAL_API_KEY manquante" },
      guarded("resend", () => readResend(days, { signal: controller.signal }), erreurs),
      guarded("envois", () => readEnvoisAuto(admin, days), erreurs),
      guarded("campagnes", () => readCampagnes(admin, days), erreurs),
      guarded("vercel", () => readVercel(days, { signal: controller.signal }), erreurs),
      guarded("google", () => readSearchConsole(days, { signal: controller.signal }), erreurs),
      guarded("seo", () => readSeoHealth({ signal: controller.signal }), erreurs),
      guarded("couts", () => readCouts(admin), erreurs),
      guarded("demandes", () => readDemandes(admin), erreurs),
      guarded("reseau", () => readReseau(admin), erreurs),
      guarded("utilisateurs", () => readUtilisateurs(admin, windowMs), erreurs),
    ]);
    if (posthog?.erreurs?.length) erreurs.push(...posthog.erreurs);
    // Dernière visite réelle de chaque compte : sa dernière session Supabase, vue même sans cookies, et ses sessions
    // PostHog (dernier replay, « jamais de consentement »)
    if (utilisateurs?.utilisateurs) {
      const [ouvertures, sessions] = await Promise.all([
        guarded("supabase.sessions", () => readDernieresSessions(admin), erreurs),
        process.env.POSTHOG_PERSONAL_API_KEY ? guarded("posthog.sessions", () => readPostHogSessions({ signal: controller.signal }), erreurs) : null,
      ]);
      if (ouvertures) withSessions(utilisateurs, ouvertures);
      if (sessions) withPostHog(utilisateurs, sessions);
    }
    return { supabase, supabaseHeures, posthog, resend, envois, campagnes, vercel, google, seo, couts, demandes, reseau, utilisateurs, erreurs };
  } finally {
    clearTimeout(timer);
  }
}

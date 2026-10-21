import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Supabase appelle désormais cette clé « publishable » ; l'ancien nom « anon » reste accepté.
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Le client n'est créé que si les variables existent : en local sans .env.local,
// le flow fonctionne quand même et la création de compte est simulée.
export const supabase = url && key ? createClient(url, key) : null;

/**
 * Crée le compte (Supabase Auth) puis enregistre le brief rattaché à ce compte.
 * Retourne { ok, simulated, needsEmailConfirmation, error }.
 */
export async function createAccountAndBrief({ email, password, brief }) {
  if (!supabase) {
    console.warn("[merry] Supabase non configuré, compte et brief simulés :", { email, brief });
    return { ok: true, simulated: true };
  }

  const { data: auth, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { first_name: brief.first_name, partner_first_name: brief.partner_first_name },
    },
  });
  if (authError) {
    console.error("[merry] Erreur création de compte :", authError);
    return { ok: false, error: authError, stage: "auth" };
  }

  const userId = auth.user?.id;
  // Si la confirmation d'email est activée dans Supabase, il n'y a pas encore de
  // session : le brief ne peut pas être inséré sous RLS tant que l'email n'est pas
  // confirmé. On garde le brouillon local et on l'enverra à la première connexion.
  if (!auth.session) {
    return { ok: true, needsEmailConfirmation: true, userId };
  }

  const { error: briefError } = await supabase.from("briefs").insert({ ...brief, user_id: userId });
  if (briefError) {
    console.error("[merry] Erreur enregistrement du brief :", briefError);
    return { ok: false, error: briefError, stage: "brief" };
  }
  return { ok: true };
}

/** Envoie un brouillon resté local après une confirmation d'email. */
export async function flushPendingBrief(brief) {
  if (!supabase) return { ok: false };
  const { data } = await supabase.auth.getUser();
  if (!data?.user) return { ok: false };
  const { error } = await supabase.from("briefs").insert({ ...brief, user_id: data.user.id });
  return { ok: !error, error };
}

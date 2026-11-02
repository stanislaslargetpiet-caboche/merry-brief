// Limites d'appels (supabase/quotas.sql). Deux usages :
//   allowUser(sb, kind, max, seconds)  : pour la personne connectée, avec son client Supabase (merry_rate)
//   allowKey(admin, key, max, seconds) : côté serveur avec la clé service_role, clé libre (merry_throttle)
// Tant que quotas.sql n'est pas collé dans Supabase, la fonction n'existe pas : on laisse passer, en le
// disant dans les journaux, pour ne pas casser une route qui marchait.

const missing = (error) => /PGRST202|Could not find the function|does not exist/i.test(String(error?.message || error?.code || ""));

export async function allowUser(sb, kind, max, seconds) {
  const { data, error } = await sb.rpc("merry_rate", { kind, max_n: max, window_seconds: seconds });
  if (error) {
    if (missing(error)) {
      console.warn("[merry] quotas.sql absent : pas de limite pour", kind);
      return true;
    }
    console.error("[merry] merry_rate", error.message);
    return false;
  }
  return data === true;
}

export async function allowKey(admin, key, max, seconds) {
  const { data, error } = await admin.rpc("merry_throttle", { k: key, max_n: max, window_seconds: seconds });
  if (error) {
    if (missing(error)) {
      console.warn("[merry] quotas.sql absent : pas de limite pour", key.split(":")[0]);
      return true;
    }
    console.error("[merry] merry_throttle", error.message);
    return false;
  }
  return data === true;
}

// Limites d'appels (supabase/quotas.sql). Deux usages :
//   allowUser(sb, kind, max, seconds)  : pour la personne connectée, avec son client Supabase (merry_rate)
//   allowKey(admin, key, max, seconds) : côté serveur avec la clé service_role, clé libre (merry_throttle)
// Fonction absente (quotas.sql pas collé) : on laisse passer en développement, en le disant dans les
// journaux ; en production on refuse, car une limite absente ne protège plus rien (les deux fonctions
// existent en production depuis le 6 nov. 2026).

const missing = (error) => /PGRST202|Could not find the function|does not exist/i.test(String(error?.message || error?.code || ""));
const open = () => process.env.NODE_ENV !== "production";

export async function allowUser(sb, kind, max, seconds) {
  const { data, error } = await sb.rpc("merry_rate", { kind, max_n: max, window_seconds: seconds });
  if (error) {
    if (missing(error)) {
      console.warn("[merry] quotas.sql absent : pas de limite pour", kind);
      return open();
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
      return open();
    }
    console.error("[merry] merry_throttle", error.message);
    return false;
  }
  return data === true;
}

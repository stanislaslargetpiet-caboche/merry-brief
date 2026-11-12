// Effacer un mariage pour de bon (D-130) : ses fichiers stockés (photo d'en-tête, documents), les lignes de mail_sent
// qui le nomment, puis le mariage, dont la suppression emporte toutes ses tables (cascade). Servi par Réglages :
// « Effacer mes données » (le compte reste) et « Supprimer mon compte » (le mariage part avec le compte quand
// personne d'autre n'y a de compte). Le Funnel du pilotage (D-293) s'en sert aussi, dans son ordre à lui.

export const BUCKETS = ["merry-covers", "merry-documents"];

async function select(query, what) {
  const { data, error } = await query;
  if (error) throw new Error(`${what} : ${error.message}`);
  return data || [];
}

export const nomCouple = (w) => [w?.partner1, w?.partner2].filter(Boolean).join(" et ") || "Sans nom";

// Clés de mail_sent à retirer : celles qui nomment le mariage, et celles qui finissent par l'adresse d'un compte supprimé
export function clesMails(keys, weddingId, emails) {
  const fins = emails.map((e) => `:${String(e).toLowerCase()}`);
  return keys.filter((k) => (weddingId && k.includes(weddingId)) || fins.some((f) => k.toLowerCase().endsWith(f)));
}

// Fichiers rangés sous le dossier du mariage, sous-dossiers compris (documents : mariage/dossier/fichier)
async function fichiers(admin, bucket, prefix, profondeur = 0) {
  const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) throw new Error(`${bucket} : ${error.message}`);
  const out = [];
  for (const f of data || []) {
    const chemin = `${prefix}/${f.name}`;
    if (f.id) out.push(chemin);
    else if (profondeur < 3) out.push(...(await fichiers(admin, bucket, chemin, profondeur + 1)));
  }
  return out;
}

export async function fichiersDuMariage(admin, weddingId) {
  const stockes = [];
  for (const bucket of BUCKETS) for (const chemin of await fichiers(admin, bucket, weddingId)) stockes.push({ bucket, chemin });
  return stockes;
}

export async function retirerFichiers(admin, stockes) {
  for (const bucket of BUCKETS) {
    const chemins = stockes.filter((f) => f.bucket === bucket).map((f) => f.chemin);
    if (!chemins.length) continue;
    const { error } = await admin.storage.from(bucket).remove(chemins);
    if (error) throw new Error(`${bucket} : ${error.message}`);
  }
}

// Lignes de mail_sent du mariage (weddingId, peut être null) et des adresses données ; renvoie le nombre retiré
export async function retirerMails(admin, weddingId, emails = []) {
  const adresses = emails.filter((e) => String(e || "").includes("@"));
  // `_` et `%` d'une adresse élargissent la recherche ; clesMails ne garde ensuite que les fins exactes
  const candidates = weddingId ? await select(admin.from("mail_sent").select("key").like("key", `%${weddingId}%`), "mail_sent") : [];
  for (const e of adresses) candidates.push(...(await select(admin.from("mail_sent").select("key").ilike("key", `%:${e}`), "mail_sent")));
  const cles = [...new Set(clesMails(candidates.map((r) => r.key), weddingId, adresses))];
  if (cles.length) {
    const { error } = await admin.from("mail_sent").delete().in("key", cles);
    if (error) throw new Error(`mail_sent : ${error.message}`);
  }
  return cles.length;
}

export async function effacerMariage(admin, weddingId) {
  const stockes = await fichiersDuMariage(admin, weddingId);
  await retirerFichiers(admin, stockes);
  const mails = await retirerMails(admin, weddingId);
  const { error } = await admin.from("weddings").delete().eq("id", weddingId);
  if (error) throw new Error(`weddings : ${error.message}`);
  return { fichiers: stockes.length, mails };
}

// Mariages d'un compte (comme organisateur ou comme créateur), chacun avec les prénoms des autres organisateurs
// qui y ont un compte : sans eux, le mariage part avec le compte
export async function mariagesDuCompte(admin, userId) {
  const places = await select(admin.from("wedding_members").select("wedding_id").eq("user_id", userId), "wedding_members");
  const crees = await select(admin.from("weddings").select("id").eq("created_by", userId), "weddings");
  const ids = [...new Set([...places.map((p) => p.wedding_id), ...crees.map((w) => w.id)])];
  if (!ids.length) return [];
  const weddings = await select(admin.from("weddings").select("id, partner1, partner2").in("id", ids), "weddings");
  const membres = await select(admin.from("wedding_members").select("wedding_id, user_id, display_name").in("wedding_id", ids).not("user_id", "is", null), "wedding_members");
  return weddings.map((w) => ({
    id: w.id,
    couple: nomCouple(w),
    autres: membres.filter((m) => m.wedding_id === w.id && m.user_id !== userId).map((m) => m.display_name || "un autre organisateur"),
  }));
}

// Le compte est-il organisateur de ce mariage ? (seul un organisateur peut l'effacer)
export async function estOrganisateur(admin, userId, weddingId) {
  const lignes = await select(admin.from("wedding_members").select("id").eq("wedding_id", weddingId).eq("user_id", userId), "wedding_members");
  return lignes.length > 0;
}

// Couples › Funnel du pilotage : supprimer un couple pour de bon. Le mariage part avec toutes ses données (cascade en
// base : invités, réponses, tâches, budget, devis, site, formulaire, équipe…), ses fichiers stockés (photo d'en-tête,
// documents) et les lignes de mail_sent qui le nomment ; ses comptes partent aussi, sauf ceux qui servent encore
// ailleurs : un autre mariage, l'espace prestataire, l'accès au pilotage. Rien n'est envoyé au couple.

const BUCKETS = ["merry-covers", "merry-documents"];

async function select(query, what) {
  const { data, error } = await query;
  if (error) throw new Error(`${what} : ${error.message}`);
  return data || [];
}

const nomCouple = (w) => [w?.partner1, w?.partner2].filter(Boolean).join(" et ") || "Sans nom";

// Sort de chaque compte du mariage : supprimé (garde null) ou gardé, avec la raison. `autres` : id du compte →
// couples des autres mariages où il est ; `pros` : comptes de l'espace prestataire ; `pilotes` : adresses du pilotage.
export function sortDesComptes(comptes, { autres = new Map(), pros = new Set(), pilotes = new Set() } = {}) {
  return comptes.map((c) => {
    const ailleurs = autres.get(c.id) || [];
    const garde = pilotes.has(String(c.email || "").toLowerCase())
      ? "accès au pilotage"
      : ailleurs.length
        ? `aussi dans ${ailleurs.join(", ")}`
        : pros.has(c.id)
          ? "espace prestataire"
          : null;
    return { id: c.id, email: c.email || "sans adresse", garde };
  });
}

// Clés de mail_sent à retirer : celles qui nomment le mariage, et celles qui finissent par l'adresse d'un compte supprimé
export function clesMails(keys, weddingId, emails) {
  const fins = emails.map((e) => `:${String(e).toLowerCase()}`);
  return keys.filter((k) => k.includes(weddingId) || fins.some((f) => k.toLowerCase().endsWith(f)));
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

// Ce que la suppression emportera, relu en base au moment de l'ouvrir et de nouveau au moment de supprimer
export async function planSuppression(admin, weddingId, pilotes) {
  const [wedding] = await select(admin.from("weddings").select("id, partner1, partner2, created_by").eq("id", weddingId), "weddings");
  if (!wedding) return null;
  const membres = await select(admin.from("wedding_members").select("user_id").eq("wedding_id", weddingId).not("user_id", "is", null), "wedding_members");
  const ids = [...new Set([...membres.map((m) => m.user_id), ...(wedding.created_by ? [wedding.created_by] : [])])];

  const comptes = [];
  for (const id of ids) {
    const { data, error } = await admin.auth.admin.getUserById(id);
    if (error && error.status !== 404) throw new Error(`compte : ${error.message}`);
    if (data?.user) comptes.push({ id, email: data.user.email });
  }

  const autres = new Map();
  if (ids.length) {
    const places = await select(admin.from("wedding_members").select("user_id, wedding_id").in("user_id", ids).neq("wedding_id", weddingId), "wedding_members");
    const crees = await select(admin.from("weddings").select("id, created_by").in("created_by", ids).neq("id", weddingId), "weddings");
    const liens = [...places.map((p) => [p.user_id, p.wedding_id]), ...crees.map((w) => [w.created_by, w.id])];
    const noms = new Map();
    const autresIds = [...new Set(liens.map(([, w]) => w))];
    if (autresIds.length) for (const w of await select(admin.from("weddings").select("id, partner1, partner2").in("id", autresIds), "weddings")) noms.set(w.id, nomCouple(w));
    for (const [user, w] of liens) {
      const liste = autres.get(user) || [];
      if (noms.has(w) && !liste.includes(noms.get(w))) autres.set(user, [...liste, noms.get(w)]);
    }
  }
  const pros = new Set(ids.length ? (await select(admin.from("pro_members").select("user_id").in("user_id", ids), "pro_members")).map((p) => p.user_id) : []);

  const stockes = [];
  for (const bucket of BUCKETS) for (const chemin of await fichiers(admin, bucket, weddingId)) stockes.push({ bucket, chemin });

  return { id: weddingId, couple: nomCouple(wedding), comptes: sortDesComptes(comptes, { autres, pros, pilotes }), fichiers: stockes };
}

// Dans cet ordre : fichiers, mails, comptes, puis le mariage. Le mariage part en dernier pour que la ligne reste dans
// le Funnel, et qu'on puisse relancer, si une étape échoue en route.
export async function supprimerCouple(admin, weddingId, pilotes) {
  const plan = await planSuppression(admin, weddingId, pilotes);
  if (!plan) return null;
  const partants = plan.comptes.filter((c) => !c.garde);

  for (const bucket of BUCKETS) {
    const chemins = plan.fichiers.filter((f) => f.bucket === bucket).map((f) => f.chemin);
    if (!chemins.length) continue;
    const { error } = await admin.storage.from(bucket).remove(chemins);
    if (error) throw new Error(`${bucket} : ${error.message}`);
  }

  const emails = partants.map((c) => c.email).filter((e) => e.includes("@"));
  // `_` et `%` d'une adresse élargissent la recherche ; clesMails ne garde ensuite que les fins exactes
  const candidates = await select(admin.from("mail_sent").select("key").like("key", `%${weddingId}%`), "mail_sent");
  for (const e of emails) candidates.push(...(await select(admin.from("mail_sent").select("key").ilike("key", `%:${e}`), "mail_sent")));
  const cles = [...new Set(clesMails(candidates.map((r) => r.key), weddingId, emails))];
  if (cles.length) {
    const { error } = await admin.from("mail_sent").delete().in("key", cles);
    if (error) throw new Error(`mail_sent : ${error.message}`);
  }

  for (const c of partants) {
    const { error } = await admin.auth.admin.deleteUser(c.id);
    if (error && error.status !== 404) throw new Error(`compte ${c.email} : ${error.message}`);
  }

  const { error } = await admin.from("weddings").delete().eq("id", weddingId);
  if (error) throw new Error(`weddings : ${error.message}`);

  const gardes = plan.comptes.filter((c) => c.garde).map(({ email, garde }) => ({ email, garde }));
  return { couple: plan.couple, comptes: partants.length, gardes, fichiers: plan.fichiers.length, mails: cles.length };
}

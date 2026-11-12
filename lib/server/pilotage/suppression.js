// Couples › Funnel du pilotage : supprimer un couple pour de bon. Le mariage part avec toutes ses données (cascade en
// base : invités, réponses, tâches, budget, devis, site, formulaire, équipe…), ses fichiers stockés (photo d'en-tête,
// documents) et les lignes de mail_sent qui le nomment ; ses comptes partent aussi, sauf ceux qui servent encore
// ailleurs : un autre mariage, l'espace prestataire, l'accès au pilotage. Rien n'est envoyé au couple.

import { clesMails, fichiersDuMariage, nomCouple, retirerFichiers, retirerMails } from "@/lib/server/effacement";

export { clesMails };

async function select(query, what) {
  const { data, error } = await query;
  if (error) throw new Error(`${what} : ${error.message}`);
  return data || [];
}

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

  const stockes = await fichiersDuMariage(admin, weddingId);

  return { id: weddingId, couple: nomCouple(wedding), comptes: sortDesComptes(comptes, { autres, pros, pilotes }), fichiers: stockes };
}

// Dans cet ordre : fichiers, mails, comptes, puis le mariage. Le mariage part en dernier pour que la ligne reste dans
// le Funnel, et qu'on puisse relancer, si une étape échoue en route.
export async function supprimerCouple(admin, weddingId, pilotes) {
  const plan = await planSuppression(admin, weddingId, pilotes);
  if (!plan) return null;
  const partants = plan.comptes.filter((c) => !c.garde);

  await retirerFichiers(admin, plan.fichiers);
  const mails = await retirerMails(admin, weddingId, partants.map((c) => c.email));

  for (const c of partants) {
    const { error } = await admin.auth.admin.deleteUser(c.id);
    if (error && error.status !== 404) throw new Error(`compte ${c.email} : ${error.message}`);
  }

  const { error } = await admin.from("weddings").delete().eq("id", weddingId);
  if (error) throw new Error(`weddings : ${error.message}`);

  const gardes = plan.comptes.filter((c) => c.garde).map(({ email, garde }) => ({ email, garde }));
  return { couple: plan.couple, comptes: partants.length, gardes, fichiers: plan.fichiers.length, mails };
}

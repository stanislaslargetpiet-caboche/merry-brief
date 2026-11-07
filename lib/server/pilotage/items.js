// Liste d'actions du pilotage : lecture de supabase/pilotage-items.sql. Le fil et le rangement sont dans lib/pilotage/items.js.

import { PROJET_HISTORIQUE, RUBRIQUES } from "@/lib/pilotage/items";

const MANQUE = "la liste d'actions n'existe pas encore : colle supabase/pilotage-items.sql dans le SQL Editor";
const tableAbsente = (e) => e?.code === "42P01" || e?.code === "PGRST205" || /does not exist|schema cache/i.test(e?.message || "");

export async function readItems(admin) {
  const champs = "id, type, titre, detail, contenu, projet, priorite, echeance, recurrence, lien, statut, cle, fait_le, cree_le";
  const [ouverts, faits] = await Promise.all([
    admin.from("pilotage_items").select(champs).or("statut.eq.a_faire,type.eq.alerte").neq("projet", PROJET_HISTORIQUE).limit(3000),
    admin.from("pilotage_items").select(champs).eq("statut", "fait").neq("type", "alerte").order("fait_le", { ascending: false }).limit(20),
  ]);
  const error = ouverts.error || faits.error;
  if (tableAbsente(error)) return { disponible: false, raison: MANQUE };
  if (error) throw new Error(`pilotage_items : ${error.message}`);
  return { disponible: true, items: ouverts.data, faits: faits.data };
}

// Écrit une ligne identifiée par sa clé. Pas d'upsert : l'index unique sur `cle` est partiel et ON CONFLICT ne le reconnaît pas.
export async function ecrireParCle(admin, ligne) {
  const { data, error } = await admin.from("pilotage_items").select("id").eq("cle", ligne.cle).maybeSingle();
  if (error) return { error };
  if (data) return admin.from("pilotage_items").update(ligne).eq("id", data.id);
  return admin.from("pilotage_items").insert(ligne);
}

// Ce qu'une routine doit relire avant d'écrire : l'historique repris une fois, puis ses éditions récentes
export async function lireMemoire(admin, rubrique, depuis) {
  const [parties, editions] = await Promise.all([
    admin.from("pilotage_items").select("contenu").like("cle", `historique:${rubrique}:%`).order("cle"),
    admin.from("pilotage_items").select("echeance, titre, contenu").eq("type", "lecture").eq("projet", RUBRIQUES[rubrique]).gte("echeance", depuis).order("echeance", { ascending: false }),
  ]);
  const error = parties.error || editions.error;
  if (error) return { error };
  return { historique: parties.data.map((p) => p.contenu).join("\n"), editions: editions.data.map((e) => ({ date: e.echeance, titre: e.titre, contenu: e.contenu })) };
}

// Remplace tout l'historique d'une rubrique : les parties d'un import plus long ne doivent pas survivre à un import plus court
export async function remplacerHistorique(admin, rubrique, lignes) {
  for (const ligne of lignes) {
    const { error } = await ecrireParCle(admin, ligne);
    if (error) return { error };
  }
  const { data, error } = await admin.from("pilotage_items").select("id, cle").like("cle", `historique:${rubrique}:%`);
  if (error) return { error };
  const gardees = new Set(lignes.map((l) => l.cle));
  const anciennes = data.filter((l) => !gardees.has(l.cle)).map((l) => l.id);
  if (!anciennes.length) return {};
  return admin.from("pilotage_items").delete().in("id", anciennes);
}

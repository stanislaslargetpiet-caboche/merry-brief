// Liste d'actions du pilotage : lecture de supabase/pilotage-items.sql. Le fil et le rangement sont dans lib/pilotage/items.js.

const MANQUE = "la liste d'actions n'existe pas encore : colle supabase/pilotage-items.sql dans le SQL Editor";
const tableAbsente = (e) => e?.code === "42P01" || e?.code === "PGRST205" || /does not exist|schema cache/i.test(e?.message || "");

export async function readItems(admin) {
  const champs = "id, type, titre, detail, projet, priorite, echeance, recurrence, lien, statut, cle, fait_le, cree_le";
  const [ouverts, faits] = await Promise.all([
    admin.from("pilotage_items").select(champs).or("statut.eq.a_faire,type.eq.alerte").limit(3000),
    admin.from("pilotage_items").select(champs).eq("statut", "fait").neq("type", "alerte").order("fait_le", { ascending: false }).limit(20),
  ]);
  const error = ouverts.error || faits.error;
  if (tableAbsente(error)) return { disponible: false, raison: MANQUE };
  if (error) throw new Error(`pilotage_items : ${error.message}`);
  return { disponible: true, items: ouverts.data, faits: faits.data };
}

// Demandes d'accès à une fiche prestataire pour la section « Demandes » du pilotage : celles qui attendent
// une vérification à la main, et les dix dernières décidées. La table vient de supabase/pro-demande-acces.sql.

export async function readDemandes(admin) {
  const { data, error } = await admin.from("pro_claims").select("*").order("created_at", { ascending: false }).limit(80);
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205" || /does not exist|schema cache/i.test(error.message || "")) {
      return { disponible: false, raison: "la table pro_claims n'existe pas encore : colle supabase/pro-demande-acces.sql dans le SQL Editor" };
    }
    throw new Error(`pro_claims : ${error.message}`);
  }
  const rows = data || [];
  const ids = [...new Set(rows.map((r) => r.vendor_id))];
  const { data: vendors } = ids.length ? await admin.schema("catalog").from("vendors").select("id, name, city, primary_category").in("id", ids) : { data: [] };
  const { data: cats } = await admin.schema("catalog").from("categories").select("slug, label");
  const label = new Map((cats || []).map((c) => [c.slug, c.label]));
  const byId = new Map((vendors || []).map((v) => [v.id, v]));
  const shape = (r) => {
    const v = byId.get(r.vendor_id);
    return {
      id: r.id,
      cree_le: r.created_at,
      decidee_le: r.decided_at,
      statut: r.status,
      fiche: { nom: v?.name || "Fiche supprimée", ville: v?.city || "", metier: label.get(v?.primary_category) || v?.primary_category || "" },
      fiche_email: r.fiche_email,
      fiche_phone: r.fiche_phone,
      email_choice: r.email_choice,
      email_given: r.email_given,
      phone_choice: r.phone_choice,
      phone_given: r.phone_given,
      account_email: r.account_email,
      account_phone: r.account_phone,
    };
  };
  const all = rows.map(shape);
  return {
    disponible: true,
    en_attente: all.filter((r) => r.statut === "en_attente").reverse(),
    recentes: all.filter((r) => r.statut !== "en_attente").slice(0, 10),
  };
}

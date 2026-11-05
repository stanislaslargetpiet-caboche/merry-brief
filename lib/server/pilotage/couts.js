// Coûts de Merry pour la section « Coûts » du pilotage : un registre de dépenses (supabase/pilotage-couts.sql)
// totalisé par mois, par catégorie et par fournisseur. Aucune facture n'est lue
// toute seule : chaque dépense est saisie sur la page ou dans Supabase.

export const CATEGORIES = [
  { id: "tech", label: "Tech" },
  { id: "juridique", label: "Juridique" },
  { id: "acquisition", label: "Acquisition" },
  { id: "divers", label: "Divers" },
];

const IDS = new Set(CATEGORIES.map((c) => c.id));
const DAY = 86400 * 1000;

function parisDay(ts) {
  return new Date(ts).toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" }); // AAAA-MM-JJ
}

const round2 = (n) => Math.round(n * 100) / 100;

// Valide une dépense saisie ; renvoie { ok, valeur } ou { ok: false, erreur }
export function validateCout(body, now = Date.now()) {
  const fournisseur = String(body?.fournisseur ?? "").trim();
  const libelle = String(body?.libelle ?? "").trim();
  const categorie = String(body?.categorie ?? "");
  const montant = Number(String(body?.montant_eur ?? "").replace(",", "."));
  const jour = String(body?.jour || parisDay(now));
  if (!fournisseur || fournisseur.length > 80) return { ok: false, erreur: "fournisseur" };
  if (libelle.length > 200) return { ok: false, erreur: "libelle" };
  if (!IDS.has(categorie)) return { ok: false, erreur: "categorie" };
  if (!Number.isFinite(montant) || montant < 0 || montant > 1000000) return { ok: false, erreur: "montant" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jour) || Number.isNaN(Date.parse(jour))) return { ok: false, erreur: "jour" };
  return { ok: true, valeur: { jour, fournisseur, libelle, categorie, montant_eur: round2(montant) } };
}

// Totaux à partir des lignes du registre ; `now` sert aux tests
export function summarizeCouts(rows, now = Date.now()) {
  const list = (rows || []).map((r) => ({ ...r, montant_eur: Number(r.montant_eur) || 0 }));
  const today = parisDay(now);
  const month = today.slice(0, 7);
  const prevMonth = parisDay(new Date(`${month}-01T12:00:00Z`).getTime() - 15 * DAY).slice(0, 7);
  const since30 = parisDay(now - 29 * DAY);
  const sum = (xs) => round2(xs.reduce((a, r) => a + r.montant_eur, 0));

  const par_categorie = CATEGORIES.map((c) => {
    return { ...c, depense: sum(list.filter((r) => r.categorie === c.id)) };
  });
  const byProvider = new Map();
  for (const r of list) byProvider.set(r.fournisseur, (byProvider.get(r.fournisseur) || 0) + r.montant_eur);
  const par_fournisseur = [...byProvider.entries()].map(([label, n]) => ({ label, n: round2(n) })).sort((a, b) => b.n - a.n);
  const byMonth = new Map();
  for (const r of list) byMonth.set(String(r.jour).slice(0, 7), (byMonth.get(String(r.jour).slice(0, 7)) || 0) + r.montant_eur);
  const par_mois = [...byMonth.entries()].map(([mois, n]) => ({ mois, n: round2(n) })).sort((a, b) => (a.mois < b.mois ? -1 : 1));
  const total = sum(list);

  return {
    disponible: true,
    lignes: list.length,
    total,
    mois: sum(list.filter((r) => String(r.jour).slice(0, 7) === month)),
    mois_precedent: sum(list.filter((r) => String(r.jour).slice(0, 7) === prevMonth)),
    trente_jours: sum(list.filter((r) => String(r.jour) >= since30)),
    par_categorie,
    par_fournisseur,
    par_mois,
    recentes: [...list].sort((a, b) => (a.jour === b.jour ? (a.cree_le < b.cree_le ? 1 : -1) : a.jour < b.jour ? 1 : -1)).slice(0, 12),
  };
}

export async function readCouts(admin, now = Date.now()) {
  const { data, error } = await admin.from("pilotage_couts").select("id, jour, fournisseur, libelle, categorie, montant_eur, cree_le").order("jour", { ascending: false }).limit(5000);
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205" || /does not exist|schema cache/i.test(error.message || "")) {
      return { disponible: false, raison: "la table pilotage_couts n'existe pas encore : colle supabase/pilotage-couts.sql dans le SQL Editor" };
    }
    throw new Error(`pilotage_couts : ${error.message}`);
  }
  return summarizeCouts(data, now);
}

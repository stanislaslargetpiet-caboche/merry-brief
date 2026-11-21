// Google Ads dans le pilotage (D-381) : les lignes envoyées par le script du compte Google Ads
// (scripts/google-ads/merry-depense.js), validées à l'arrivée puis lues pour le bloc Google Ads de Acquisition ›
// Référencement. Table supabase/google-ads.sql.

export const NIVEAUX = ["campagne", "mot_cle", "recherche"];
const MAX_LIGNES = 5000;
const JOUR = /^\d{4}-\d{2}-\d{2}$/;

const texte = (v, max) => String(v ?? "").trim().slice(0, max);
const entier = (v) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const montant = (v) => {
  const n = Math.round(Number(v) * 100) / 100;
  return Number.isFinite(n) && n >= 0 && n < 1e7 ? n : null;
};

/** Lignes du script, validées : { ok, lignes } ou { ok: false, erreur }. Une ligne invalide refuse tout l'envoi. */
export function validerEnvoi(body) {
  const rows = body?.lignes;
  if (!Array.isArray(rows) || !rows.length) return { ok: false, erreur: "lignes" };
  if (rows.length > MAX_LIGNES) return { ok: false, erreur: "trop" };
  const lignes = [];
  for (const [i, r] of rows.entries()) {
    const ligne = {
      jour: String(r?.jour || ""),
      niveau: String(r?.niveau || ""),
      campagne_id: texte(r?.campagne_id, 40),
      campagne: texte(r?.campagne, 200),
      groupe: texte(r?.groupe, 200),
      terme: texte(r?.terme, 200),
      correspondance: texte(r?.correspondance, 20),
      impressions: entier(r?.impressions ?? 0),
      clics: entier(r?.clics ?? 0),
      cout_eur: montant(r?.cout_eur ?? 0),
      conversions: montant(r?.conversions ?? 0),
    };
    if (!JOUR.test(ligne.jour) || !NIVEAUX.includes(ligne.niveau) || !ligne.campagne_id || [ligne.impressions, ligne.clics, ligne.cout_eur, ligne.conversions].includes(null)) {
      return { ok: false, erreur: `ligne ${i + 1}` };
    }
    lignes.push(ligne);
  }
  // Une même clé deux fois dans l'envoi ferait échouer l'upsert : on additionne
  const parCle = new Map();
  for (const l of lignes) {
    const cle = [l.jour, l.niveau, l.campagne_id, l.groupe, l.terme, l.correspondance].join("\u0001");
    const deja = parCle.get(cle);
    if (!deja) parCle.set(cle, l);
    else for (const k of ["impressions", "clics", "cout_eur", "conversions"]) deja[k] = Math.round((deja[k] + l[k]) * 100) / 100;
  }
  return { ok: true, lignes: [...parCle.values()] };
}

const absente = (error) => error.code === "42P01" || error.code === "PGRST205" || /does not exist|schema cache/i.test(error.message || "");

/** Les 62 derniers jours de lignes, pour couvrir la période affichée et la précédente (mois en cours compris). */
export async function readGoogleAds(admin, now = Date.now()) {
  const depuis = new Date(now - 62 * 86400 * 1000).toISOString().slice(0, 10);
  const { data, error } = await admin
    .from("google_ads_jours")
    .select("jour, niveau, campagne_id, campagne, groupe, terme, correspondance, impressions, clics, cout_eur, conversions, maj")
    .gte("jour", depuis)
    .order("jour", { ascending: true })
    .limit(20000);
  if (error) {
    if (absente(error)) return { disponible: false, raison: "la table google_ads_jours n'existe pas encore : colle supabase/google-ads.sql dans le SQL Editor" };
    throw new Error(`google_ads_jours : ${error.message}`);
  }
  const lignes = (data || []).map((r) => ({ ...r, cout_eur: Number(r.cout_eur) || 0, conversions: Number(r.conversions) || 0 }));
  const maj = lignes.reduce((m, r) => (r.maj > m ? r.maj : m), "");
  return { disponible: true, lignes, maj: maj || null };
}

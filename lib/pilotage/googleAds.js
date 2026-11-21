// Chiffres du bloc « Google Ads » (Acquisition › Référencement), D-364 puis D-381 :
// - dépense, impressions et clics viennent du script du compte Google Ads (table google_ads_jours) ;
// - les visites, du compteur anonyme (arrivées sur le site par un clic d'annonce, cookies acceptés ou non) ;
// - les inscriptions et les couples qui ont envoyé une demande, des comptes dont le brief porte une source Google
//   (google-ads quand l'annonce ne dit rien de plus, gads-<id de campagne> avec le suffixe d'URL de la campagne).
import { avecInscriptions, isGoogleAds } from "@/lib/compteur";
import { pctOf } from "@/lib/server/pilotage/shape";

const somme = (rows, key) => rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
const arrondi = (n) => Math.round(n * 100) / 100;
const jourParis = (iso) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });

/** Coût par unité (inscription, clic…) ; null quand il n'y a rien à diviser */
export const coutPar = (cout, n) => (n > 0 ? arrondi(cout / n) : null);

// Bloc d'origine (D-364) : visites, inscriptions et taux sur la période, sans la dépense
export function chiffresGoogleAds(entonnoir, sources) {
  const lignes = avecInscriptions(entonnoir || [], sources).filter((r) => isGoogleAds(r.source));
  const site = somme(lignes, "site");
  const inscriptions = somme(lignes, "inscriptions");
  return { site, inscriptions, taux: pctOf(inscriptions, site) };
}

/** Campagne nommée par la source d'un compte (gads-123 → 123), ou null */
export const campagneDeSource = (source) => /^gads-(\d{1,20})$/i.exec(source || "")?.[1] || null;

function regrouper(lignes, cle, champs) {
  const out = new Map();
  for (const l of lignes) {
    const k = cle(l);
    const row = out.get(k) || { ...champs(l), impressions: 0, clics: 0, cout: 0, conversions: 0 };
    row.impressions += l.impressions || 0;
    row.clics += l.clics || 0;
    row.cout = arrondi(row.cout + (l.cout_eur || 0));
    row.conversions = arrondi(row.conversions + (l.conversions || 0));
    out.set(k, row);
  }
  return [...out.values()].map((r) => ({ ...r, cpc: coutPar(r.cout, r.clics) })).sort((a, b) => b.cout - a.cout || b.clics - a.clics);
}

/**
 * Tout le bloc, sur l'axe des jours de la page (`joursList`, 2 × `jours` jours : la période précédente puis la
 * courante). `lignes` : google_ads_jours ; `utilisateurs` : comptes du pilotage (source, cree, devis).
 */
export function resumeGoogleAds({ lignes, joursList, jours, entonnoir, sources, utilisateurs }) {
  const axe = joursList || [];
  const courant = new Set(axe.slice(-jours));
  const precedent = new Set(axe.slice(Math.max(0, axe.length - 2 * jours), Math.max(0, axe.length - jours)));
  const campagnes = (lignes || []).filter((l) => l.niveau === "campagne");
  const comptes = (utilisateurs || []).filter((u) => isGoogleAds(u.source) && u.cree).map((u) => ({ ...u, jour: jourParis(u.cree) }));

  const parJour = new Map(axe.map((j) => [j, { jour: j, cout: 0, clics: 0, impressions: 0, inscriptions: 0 }]));
  for (const l of campagnes) {
    const d = parJour.get(String(l.jour).slice(0, 10));
    if (!d) continue;
    d.cout = arrondi(d.cout + (l.cout_eur || 0));
    d.clics += l.clics || 0;
    d.impressions += l.impressions || 0;
  }
  for (const u of comptes) {
    const d = parJour.get(u.jour);
    if (d) d.inscriptions += 1;
  }
  const series = [...parJour.values()];
  const total = (set, key) => somme(series.filter((d) => set.has(d.jour)), key);
  const periode = (set) => {
    const cout = arrondi(total(set, "cout"));
    const inscriptions = comptes.filter((u) => set.has(u.jour));
    const actifs = inscriptions.filter((u) => (u.devis || 0) > 0).length;
    return { cout, clics: total(set, "clics"), impressions: total(set, "impressions"), inscriptions: inscriptions.length, actifs, cout_inscription: coutPar(cout, inscriptions.length), cout_actif: coutPar(cout, actifs) };
  };

  const dansPeriode = (l) => courant.has(String(l.jour).slice(0, 10));
  const inscritsPar = new Map();
  for (const u of comptes.filter((x) => courant.has(x.jour))) {
    const id = campagneDeSource(u.source);
    if (id) inscritsPar.set(id, (inscritsPar.get(id) || 0) + 1);
  }
  const parCampagne = regrouper(campagnes.filter(dansPeriode), (l) => l.campagne_id, (l) => ({ id: l.campagne_id, campagne: l.campagne || l.campagne_id })).map((r) => {
    const inscriptions = inscritsPar.get(r.id) || 0;
    return { ...r, inscriptions, cout_inscription: coutPar(r.cout, inscriptions) };
  });
  const motsCles = regrouper(
    (lignes || []).filter((l) => l.niveau === "mot_cle" && dansPeriode(l)),
    (l) => [l.campagne_id, l.groupe, l.terme, l.correspondance].join("\u0001"),
    (l) => ({ terme: l.terme, correspondance: l.correspondance, campagne: l.campagne, groupe: l.groupe })
  );
  const recherches = regrouper(
    (lignes || []).filter((l) => l.niveau === "recherche" && dansPeriode(l)),
    (l) => l.terme.toLowerCase(),
    (l) => ({ terme: l.terme })
  );

  return {
    series,
    courant: { ...periode(courant), visites: chiffresGoogleAds(entonnoir, sources).site },
    precedent: periode(precedent),
    campagnes: parCampagne,
    motsCles,
    recherches,
    sansCampagne: comptes.filter((u) => courant.has(u.jour) && !campagneDeSource(u.source)).length,
  };
}

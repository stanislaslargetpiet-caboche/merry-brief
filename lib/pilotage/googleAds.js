// Les trois chiffres du bloc « Google Ads » (Acquisition › Référencement) : visites venues d'une annonce Google
// (lien avec gclid, ou ?source=google-…) dans l'entonnoir du compteur anonyme, inscriptions des briefs qui portent
// cette source, et taux. Les visites comptent cookies acceptés ou non ; clics, impressions et dépense restent dans
// Google Ads.
import { avecInscriptions, isGoogleAds } from "@/lib/compteur";
import { pctOf } from "@/lib/server/pilotage/shape";

const somme = (rows, key) => rows.reduce((acc, r) => acc + (r[key] || 0), 0);

export function chiffresGoogleAds(entonnoir, sources) {
  const lignes = avecInscriptions(entonnoir || [], sources).filter((r) => isGoogleAds(r.source));
  const site = somme(lignes, "site");
  const inscriptions = somme(lignes, "inscriptions");
  return { site, inscriptions, taux: pctOf(inscriptions, site) };
}

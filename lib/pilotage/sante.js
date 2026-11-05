// Section « Santé » du pilotage : ce qui demande un coup d'œil, calculé à partir des données collectées. Partagée
// entre la page (components affichent la liste) et le mail quotidien de 8 h (tests/pilotageSante.test.js).
// `jours` est la période lue : 1, 2 (mail du matin), 7 ou 30. Chaque entrée : { tone, titre, detail },
// tone = ok | warn | bad | neutral.

import { alignSeries, dayList, fmtDateTime, fmtInt, splitSeries, sumBy } from "@/lib/server/pilotage/shape";

const PERIODE = { 1: "24 h", 2: "2 jours", 7: "7 jours", 30: "30 jours" };

export function buildSante(data, jours) {
  const periode = PERIODE[jours] || `${jours} jours`;
  const sb = data.supabase;
  const ph = data.posthog?.disponible ? data.posthog : null;
  const rs = data.resend?.disponible ? data.resend : null;
  const vc = data.vercel?.disponible ? data.vercel : null;
  const gsc = data.google?.disponible ? data.google : null;
  const seo = data.seo?.disponible ? data.seo : null;

  const joursList = sb?.series?.length ? sb.series.map((r) => r.jour) : dayList(jours);
  const sbSplit = splitSeries(sb?.series || [], jours);
  const bugs = alignSeries(joursList, ph?.bugs?.series, ["exceptions", "rage", "morts"]);
  const bugsSplit = splitSeries(bugs, jours);
  const t = sb?.totaux || {};
  const exceptionsCur = sumBy(bugsSplit.current, "exceptions");
  const exceptionsPrev = sumBy(bugsSplit.previous, "exceptions");
  const rageCur = sumBy(bugsSplit.current, "rage");
  const mailProblemes = rs ? rs.problemes.length : 0;

  const sante = [];
  if (vc) {
    sante.push({
      tone: vc.erreurs_production ? "bad" : vc.erreurs ? "warn" : "ok",
      titre: vc.erreurs_production ? `${vc.erreurs_production} déploiement(s) de production en échec` : vc.erreurs ? `${vc.erreurs} déploiement(s) de prévisualisation en échec` : "Déploiements Vercel sans échec",
      detail: vc.derniere_production ? `Dernière production prête ${fmtDateTime(vc.derniere_production.quand)} · ${vc.derniere_production.message || vc.derniere_production.commit || ""}` : "Aucune production sur la période",
    });
  } else {
    sante.push({ tone: "neutral", titre: "Déploiements Vercel non lus", detail: data.vercel?.raison || "ajoute VERCEL_API_TOKEN sur Vercel (Production) pour les afficher ici" });
  }
  if (ph) {
    sante.push({
      tone: exceptionsCur > 0 ? (exceptionsCur > exceptionsPrev ? "bad" : "warn") : "ok",
      titre: exceptionsCur ? `${fmtInt(exceptionsCur)} erreur(s) JavaScript sur ${periode}` : `Aucune erreur JavaScript sur ${periode}`,
      detail: exceptionsPrev ? `${fmtInt(exceptionsPrev)} sur la période précédente` : "rien non plus sur la période précédente",
    });
    sante.push({
      tone: rageCur > 0 ? "warn" : "ok",
      titre: rageCur ? `${fmtInt(rageCur)} clic(s) de rage` : "Aucun clic de rage",
      detail: rageCur ? "une personne a cliqué plusieurs fois au même endroit sans effet : voir la section Bugs" : "personne ne s'est acharné sur un bouton muet",
    });
  } else {
    sante.push({ tone: "neutral", titre: "PostHog non lu", detail: data.posthog?.raison || "clé manquante" });
  }
  if (rs) {
    sante.push({
      tone: mailProblemes ? "bad" : "ok",
      titre: mailProblemes ? `${mailProblemes} mail(s) en difficulté` : `${fmtInt(rs.envoyes)} mail(s) envoyés, aucun rebond`,
      detail: mailProblemes ? rs.problemes.map((m) => `${m.etat} · ${m.a}`).slice(0, 3).join(" ; ") : Object.entries(rs.par_etat).map(([k, n]) => `${n} ${k}`).join(", ") || "rien sur la période",
    });
  }
  if (t.comptes_jamais_connectes > 0) sante.push({ tone: "warn", titre: `${t.comptes_jamais_connectes} compte(s) jamais connecté(s)`, detail: "créés sans jamais ouvrir le tableau de bord" });
  if (t.organisateurs_invites_en_attente > 0) sante.push({ tone: "neutral", titre: `${t.organisateurs_invites_en_attente} invitation(s) d'organisateur en attente`, detail: "mail envoyé, compte pas encore créé" });
  if (t.catalogue_sans_photo > 0) sante.push({ tone: "neutral", titre: `${fmtInt(t.catalogue_sans_photo)} prestataire(s) actifs sans photo`, detail: "ils passent derrière les autres dans les propositions" });
  if (sb?.repli) sante.push({ tone: "warn", titre: "Supabase en mode réduit", detail: "pilotage_stats n'existe pas encore : colle supabase/pilotage.sql dans le SQL Editor pour le catalogue par métier, les fiches pro, les RSVP et les demandes détaillées" });
  if (sb && sbSplit.current.length === 0) sante.push({ tone: "warn", titre: "Série Supabase vide", detail: "pilotage_stats n'a rien renvoyé pour la période" });
  if (seo) {
    if (seo.sitemap.statut !== 200 || !seo.sitemap.urls) sante.push({ tone: "bad", titre: "Sitemap illisible", detail: `réponse ${seo.sitemap.statut}, ${fmtInt(seo.sitemap.urls)} adresse(s) : Google ne peut pas découvrir les pages` });
    if (seo.robots.statut !== 200 || seo.robots.bloque_tout) sante.push({ tone: "bad", titre: "robots.txt en défaut", detail: seo.robots.bloque_tout ? "il interdit tout le site aux moteurs" : `réponse ${seo.robots.statut}` });
    if (seo.pages_en_defaut) sante.push({ tone: "warn", titre: `${seo.pages_en_defaut} page(s) du site avec un défaut de référencement`, detail: "sur l'échantillon du jour : voir la section Référencement" });
  }
  if (!gsc && data.google) sante.push({ tone: "neutral", titre: "Search Console non lue", detail: data.google.raison || "à configurer" });
  for (const e of data.erreurs || []) sante.push({ tone: "bad", titre: `Source en échec : ${e.source}`, detail: e.message });
  return sante;
}

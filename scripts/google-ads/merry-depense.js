/* global AdsApp, UrlFetchApp, Logger, Utilities */
// Script Google Ads de Merry (D-381) : envoie au pilotage, chaque heure, la dépense, les impressions, les clics et les
// conversions des 10 derniers jours, par campagne, par mot-clé et par recherche tapée. Le pilotage les range dans la
// table google_ads_jours (supabase/google-ads.sql) et les montre dans Acquisition › Référencement › Google Ads.
// Depuis D-398 (persona), aussi par sexe, tranche d'âge, région et appareil, lus dans Acquisition › Persona
// (supabase/google-ads-persona.sql). Ces quatre rapports sont lus à part : si l'un échoue, le reste part quand même.
//
// Installation, une fois, dans le compte Google Ads :
//   Outils › Actions groupées › Scripts › bouton + › Nouveau script, coller ce fichier, remplacer JETON par la valeur
//   de GOOGLE_ADS_SCRIPT_SECRET (donnée par Stan, jamais écrite dans ce dépôt public), Autoriser, Exécuter une fois,
//   puis Fréquence : toutes les heures.
//
// Le script ne modifie rien dans le compte : il lit les rapports et les envoie.

var ADRESSE = "https://app.withmerry.com/api/interne/google-ads";
var JETON = "COLLER_ICI_GOOGLE_ADS_SCRIPT_SECRET";
var JOURS = 10;

function main() {
  var fuseau = AdsApp.currentAccount().getTimeZone();
  var fin = new Date();
  var debut = new Date(fin.getTime() - (JOURS - 1) * 86400000);
  var periode = "segments.date BETWEEN '" + jour(debut, fuseau) + "' AND '" + jour(fin, fuseau) + "'";
  var mesures = "metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions";
  var lignes = [];

  lire("SELECT segments.date, campaign.id, campaign.name, " + mesures + " FROM campaign WHERE " + periode, function (r) {
    return ligne(r, "campagne", "", "", "");
  }, lignes);

  lire(
    "SELECT segments.date, campaign.id, campaign.name, ad_group.name, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, " +
      mesures + " FROM keyword_view WHERE " + periode + " AND metrics.impressions > 0",
    function (r) {
      return ligne(r, "mot_cle", r.adGroup.name, r.adGroupCriterion.keyword.text, r.adGroupCriterion.keyword.matchType);
    },
    lignes
  );

  lire(
    "SELECT segments.date, campaign.id, campaign.name, ad_group.name, search_term_view.search_term, " + mesures +
      " FROM search_term_view WHERE " + periode + " AND metrics.impressions > 0",
    function (r) {
      return ligne(r, "recherche", r.adGroup.name, r.searchTermView.searchTerm, "");
    },
    lignes
  );

  // Persona (D-398) : une ligne par jour, campagne et valeur ; les groupes d'annonces sont additionnés à l'arrivée
  essayer("sexe", function () {
    lire("SELECT segments.date, campaign.id, campaign.name, ad_group_criterion.gender.type, " + mesures + " FROM gender_view WHERE " + periode + " AND metrics.impressions > 0", function (r) {
      return ligne(r, "sexe", "", r.adGroupCriterion.gender.type, "");
    }, lignes);
  });
  essayer("age", function () {
    lire("SELECT segments.date, campaign.id, campaign.name, ad_group_criterion.age_range.type, " + mesures + " FROM age_range_view WHERE " + periode + " AND metrics.impressions > 0", function (r) {
      return ligne(r, "age", "", r.adGroupCriterion.ageRange.type, "");
    }, lignes);
  });
  essayer("appareil", function () {
    lire("SELECT segments.date, segments.device, campaign.id, campaign.name, " + mesures + " FROM campaign WHERE " + periode + " AND metrics.impressions > 0", function (r) {
      return ligne(r, "appareil", "", r.segments.device, "");
    }, lignes);
  });
  essayer("region", function () {
    var parRegion = [];
    lire("SELECT segments.date, segments.geo_target_region, campaign.id, campaign.name, " + mesures + " FROM geographic_view WHERE " + periode + " AND metrics.impressions > 0", function (r) {
      return { r: r, cible: r.segments.geoTargetRegion || "" };
    }, parRegion);
    var noms = nomsDeLieux(parRegion.map(function (x) { return x.cible; }));
    parRegion.forEach(function (x) {
      lignes.push(ligne(x.r, "region", "", noms[x.cible] || "Inconnue", ""));
    });
  });

  if (!lignes.length) {
    Logger.log("Aucune ligne sur la période : rien à envoyer.");
    return;
  }
  var reponse = UrlFetchApp.fetch(ADRESSE, {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + JETON },
    payload: JSON.stringify({ lignes: lignes }),
    muteHttpExceptions: true,
  });
  Logger.log("Merry a répondu " + reponse.getResponseCode() + " : " + reponse.getContentText());
  if (reponse.getResponseCode() !== 200) throw new Error("Envoi refusé par Merry");
}

function essayer(nom, f) {
  try {
    f();
  } catch (e) {
    Logger.log("Rapport « " + nom + " » non lu : " + e);
  }
}

// geoTargetConstants/20321 → « Île-de-France »
function nomsDeLieux(cibles) {
  var uniques = cibles.filter(function (c, i) { return c && cibles.indexOf(c) === i; });
  var noms = {};
  for (var i = 0; i < uniques.length; i += 100) {
    var lot = uniques.slice(i, i + 100).map(function (c) { return "'" + c + "'"; }).join(", ");
    var rows = AdsApp.search("SELECT geo_target_constant.resource_name, geo_target_constant.name FROM geo_target_constant WHERE geo_target_constant.resource_name IN (" + lot + ")");
    while (rows.hasNext()) {
      var g = rows.next().geoTargetConstant;
      noms[g.resourceName] = g.name;
    }
  }
  return noms;
}

function lire(requete, vers, lignes) {
  var rows = AdsApp.search(requete);
  while (rows.hasNext()) lignes.push(vers(rows.next()));
}

function ligne(r, niveau, groupe, terme, correspondance) {
  return {
    jour: r.segments.date,
    niveau: niveau,
    campagne_id: String(r.campaign.id),
    campagne: r.campaign.name || "",
    groupe: groupe || "",
    terme: terme || "",
    correspondance: correspondance || "",
    impressions: Number(r.metrics.impressions) || 0,
    clics: Number(r.metrics.clicks) || 0,
    cout_eur: Math.round((Number(r.metrics.costMicros) || 0) / 10000) / 100,
    conversions: Number(r.metrics.conversions) || 0,
  };
}

function jour(d, fuseau) {
  return Utilities.formatDate(d, fuseau, "yyyy-MM-dd");
}

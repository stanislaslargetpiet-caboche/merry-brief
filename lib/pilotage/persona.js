// Page Acquisition › Persona (D-398) : qui clique sur les annonces Google et qui s'inscrit, par sexe, âge, région et
// appareil. Clics : lignes « sexe », « age », « region », « appareil » de google_ads_jours (script du compte Google
// Ads). Inscriptions : mariages créés sur la période, couples de test écartés ; région lue dans le lieu tapé à
// l'onboarding, sexe estimé d'après le prénom (lib/pilotage/prenoms.js). L'âge et l'appareil ne sont pas demandés à
// l'inscription. Fonctions pures, testées (tests/pilotagePersona.test.js).
import { isGoogleAds } from "@/lib/compteur";
import { regionDe } from "@/lib/pilotage/lieux";
import { sexeDuPrenom } from "@/lib/pilotage/prenoms";

export const INCONNU = "Inconnu";

const LIBELLES = {
  sexe: { FEMALE: "Femme", MALE: "Homme" },
  age: { AGE_RANGE_18_24: "18-24 ans", AGE_RANGE_25_34: "25-34 ans", AGE_RANGE_35_44: "35-44 ans", AGE_RANGE_45_54: "45-54 ans", AGE_RANGE_55_64: "55-64 ans", AGE_RANGE_65_UP: "65 ans et plus" },
  appareil: { MOBILE: "Téléphone", DESKTOP: "Ordinateur", TABLET: "Tablette", CONNECTED_TV: "Télévision" },
};
// Ordre d'affichage quand il y en a un naturel ; sinon, du plus grand au plus petit
const ORDRE = { sexe: ["Femme", "Homme"], age: Object.values(LIBELLES.age) };

/** Libellé lisible d'une valeur envoyée par Google Ads (« AGE_RANGE_25_34 » → « 25-34 ans ») */
export function libelleAds(dimension, terme) {
  if (dimension === "region") return regionDe(terme) || (terme && !/^inconnue$/i.test(terme) ? terme : INCONNU);
  const t = String(terme || "").toUpperCase();
  if (!t || /UNDETERMINED|UNKNOWN|UNSPECIFIED/.test(t)) return INCONNU;
  return LIBELLES[dimension]?.[t] || (dimension === "appareil" ? "Autre" : INCONNU);
}

const jourParis = (iso) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
const pct = (n, total) => (total > 0 ? Math.round((n / total) * 100) : null);

// Une ligne par libellé, parts calculées sur les valeurs connues : « Inconnu » garde son nombre, sans part, en bas
function tableau(dimension, clicsPar, inscritsPar) {
  const labels = new Set([...clicsPar.keys(), ...inscritsPar.keys()]);
  const connus = (m) => [...m].filter(([k]) => k !== INCONNU).reduce((a, [, v]) => a + v, 0);
  const totalClics = connus(clicsPar);
  const totalInscrits = connus(inscritsPar);
  const ordre = ORDRE[dimension];
  return [...labels]
    .map((label) => {
      const clics = clicsPar.get(label) || 0;
      const inscriptions = inscritsPar.get(label) || 0;
      const inconnu = label === INCONNU;
      return { label, clics, part_clics: inconnu ? null : pct(clics, totalClics), inscriptions, part_inscriptions: inconnu ? null : pct(inscriptions, totalInscrits), inconnu };
    })
    .sort((a, b) => {
      if (a.inconnu !== b.inconnu) return a.inconnu ? 1 : -1;
      if (ordre) return (ordre.indexOf(a.label) + 1 || 99) - (ordre.indexOf(b.label) + 1 || 99);
      return b.clics + b.inscriptions - (a.clics + a.inscriptions) || a.label.localeCompare(b.label, "fr");
    });
}

const ajouter = (m, k, n = 1) => m.set(k, (m.get(k) || 0) + n);

/**
 * `lignes` : google_ads_jours ; `mariages` : mariages du pilotage (cree, test, source, prenom, region) ;
 * `jours` : jours de la période affichée (AAAA-MM-JJ, heure de Paris).
 */
export function resumePersona({ lignes, mariages, jours }) {
  const periode = new Set(jours || []);
  const ads = (lignes || []).filter((l) => periode.has(String(l.jour).slice(0, 10)));
  const inscrits = (mariages || []).filter((m) => !m.test && m.cree && periode.has(jourParis(m.cree)));

  const clics = { sexe: new Map(), age: new Map(), region: new Map(), appareil: new Map() };
  for (const l of ads) if (clics[l.niveau]) ajouter(clics[l.niveau], libelleAds(l.niveau, l.terme), l.clics || 0);
  for (const m of Object.values(clics)) for (const [k, v] of m) if (!v) m.delete(k);

  const parSexe = new Map();
  const parRegion = new Map();
  for (const m of inscrits) {
    ajouter(parSexe, sexeDuPrenom(m.prenom) || INCONNU);
    ajouter(parRegion, regionDe(m.region) || INCONNU);
  }

  const clicsCampagne = ads.filter((l) => l.niveau === "campagne").reduce((a, l) => a + (l.clics || 0), 0);
  const femmes = (m) => {
    const f = m.get("Femme") || 0;
    const h = m.get("Homme") || 0;
    return pct(f, f + h);
  };
  return {
    clics: clicsCampagne,
    inscriptions: inscrits.length,
    inscriptions_google: inscrits.filter((m) => isGoogleAds(m.source)).length,
    femmes_clics: femmes(clics.sexe),
    femmes_inscrits: femmes(parSexe),
    persona_recue: ads.some((l) => clics[l.niveau]),
    sexe: tableau("sexe", clics.sexe, parSexe),
    age: tableau("age", clics.age, new Map()),
    region: tableau("region", clics.region, parRegion),
    appareil: tableau("appareil", clics.appareil, new Map()),
  };
}

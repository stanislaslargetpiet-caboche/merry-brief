import { describe, expect, it } from "vitest";
import { regionDe } from "@/lib/pilotage/lieux";
import { sexeDuPrenom } from "@/lib/pilotage/prenoms";
import { libelleAds, resumePersona } from "@/lib/pilotage/persona";
import { validerEnvoi } from "@/lib/server/pilotage/googleAds";

describe("lieux de la persona (D-398)", () => {
  it("ramène le lieu tapé à l'onboarding à une région", () => {
    expect(regionDe("Brest, 29200, Finistère")).toBe("Bretagne");
    expect(regionDe("Vic-sur-Aisne, 02290, Aisne")).toBe("Hauts-de-France");
    expect(regionDe("Saint Georges sur Loire (49)")).toBe("Pays de la Loire");
    expect(regionDe("Lyon, Métropole de Lyon")).toBe("Auvergne-Rhône-Alpes");
    expect(regionDe("Strasbourg, Bas-Rhin")).toBe("Grand Est");
    expect(regionDe("Picardie")).toBe("Hauts-de-France");
    expect(regionDe("Pays Basque")).toBe("Nouvelle-Aquitaine");
    expect(regionDe("mimizan")).toBe("Nouvelle-Aquitaine");
    expect(regionDe("Évian-les-Bains")).toBe("Auvergne-Rhône-Alpes");
    expect(regionDe("Corse")).toBe("Corse");
    expect(regionDe("Paris")).toBe("Île-de-France");
    expect(regionDe("Annecy, 74000, Haute-Savoie")).toBe("Auvergne-Rhône-Alpes");
    expect(regionDe("Ajaccio, 20000, Corse-du-Sud")).toBe("Corse");
    expect(regionDe("Saint-Pierre, 97410, La Réunion")).toBe("Outre-mer");
  });

  it("lit les régions de Google Ads, en anglais ou en français", () => {
    expect(regionDe("Ile-de-France")).toBe("Île-de-France");
    expect(regionDe("Brittany")).toBe("Bretagne");
    expect(regionDe("Provence-Alpes-Cote d'Azur")).toBe("Provence-Alpes-Côte d'Azur");
    expect(regionDe("Bourgogne-Franche-Comte")).toBe("Bourgogne-Franche-Comté");
    expect(regionDe("Normandy")).toBe("Normandie");
  });

  it("ne devine rien sans indice", () => {
    expect(regionDe("")).toBeNull();
    expect(regionDe(null)).toBeNull();
    expect(regionDe("quelque part")).toBeNull();
    expect(regionDe("Centre-ville")).toBeNull();
  });
});

describe("sexe estimé d'après le prénom", () => {
  it("reconnaît les prénoms courants et composés", () => {
    expect(sexeDuPrenom("Juliette")).toBe("Femme");
    expect(sexeDuPrenom("Clémence")).toBe("Femme");
    expect(sexeDuPrenom("Marie-Charlotte")).toBe("Femme");
    expect(sexeDuPrenom("Stanislas")).toBe("Homme");
    expect(sexeDuPrenom("Jean-Eudes")).toBe("Homme");
    expect(sexeDuPrenom("Côme")).toBe("Homme");
  });
  it("laisse inconnus les prénoms mixtes, absents ou vides", () => {
    expect(sexeDuPrenom("Camille")).toBeNull();
    expect(sexeDuPrenom("Moi")).toBeNull();
    expect(sexeDuPrenom("")).toBeNull();
    expect(sexeDuPrenom(undefined)).toBeNull();
  });
});

describe("page Persona", () => {
  const jours = ["2026-11-20", "2026-11-21"];
  const l = (jour, niveau, terme, clics) => ({ jour, niveau, campagne_id: "1", terme, clics, impressions: clics * 10, cout_eur: clics * 0.4 });
  const lignes = [
    l("2026-11-20", "campagne", "", 30),
    l("2026-11-19", "campagne", "", 99),
    l("2026-11-20", "sexe", "FEMALE", 15),
    l("2026-11-21", "sexe", "FEMALE", 3),
    l("2026-11-20", "sexe", "MALE", 6),
    l("2026-11-20", "sexe", "UNDETERMINED", 6),
    l("2026-11-19", "sexe", "MALE", 50),
    l("2026-11-20", "age", "AGE_RANGE_35_44", 4),
    l("2026-11-20", "age", "AGE_RANGE_25_34", 12),
    l("2026-11-20", "region", "Brittany", 5),
    l("2026-11-20", "region", "Ile-de-France", 9),
    l("2026-11-20", "appareil", "MOBILE", 20),
    l("2026-11-20", "appareil", "DESKTOP", 10),
  ];
  const mariages = [
    { cree: "2026-11-20T10:00:00Z", prenom: "Juliette", region: "Brest, 29200, Finistère", source: "google-ads" },
    { cree: "2026-11-21T10:00:00Z", prenom: "Thomas", region: "Paris", source: null },
    { cree: "2026-11-21T12:00:00Z", prenom: "Camille", region: null, source: "gads-24474826298" },
    { cree: "2026-11-21T13:00:00Z", prenom: "Léa", region: "Paris", test: true },
    { cree: "2026-11-18T10:00:00Z", prenom: "Léa", region: "Paris" },
  ];
  const r = resumePersona({ lignes, mariages, jours });

  it("compte les clics et les inscriptions de la période seulement, sans les couples de test", () => {
    expect(r.clics).toBe(30);
    expect(r.inscriptions).toBe(3);
    expect(r.inscriptions_google).toBe(2);
    expect(r.persona_recue).toBe(true);
  });

  it("donne la part de femmes sur les sexes connus", () => {
    expect(r.femmes_clics).toBe(75);
    expect(r.femmes_inscrits).toBe(50);
    expect(r.sexe).toEqual([
      { label: "Femme", clics: 18, part_clics: 75, inscriptions: 1, part_inscriptions: 50, inconnu: false },
      { label: "Homme", clics: 6, part_clics: 25, inscriptions: 1, part_inscriptions: 50, inconnu: false },
      { label: "Inconnu", clics: 6, part_clics: null, inscriptions: 1, part_inscriptions: null, inconnu: true },
    ]);
  });

  it("range les âges dans l'ordre et les régions par taille", () => {
    expect(r.age.map((x) => x.label)).toEqual(["25-34 ans", "35-44 ans"]);
    expect(r.region.map((x) => [x.label, x.clics, x.inscriptions])).toEqual([
      ["Île-de-France", 9, 1],
      ["Bretagne", 5, 1],
      ["Inconnu", 0, 1],
    ]);
    expect(r.appareil.map((x) => [x.label, x.part_clics])).toEqual([["Téléphone", 67], ["Ordinateur", 33]]);
  });

  it("dit quand le script n'a encore rien envoyé de la persona", () => {
    const vide = resumePersona({ lignes: [l("2026-11-20", "campagne", "", 3)], mariages: [], jours });
    expect(vide.persona_recue).toBe(false);
    expect(vide.femmes_clics).toBeNull();
    expect(vide.sexe).toEqual([]);
  });

  it("traduit les valeurs de Google Ads", () => {
    expect(libelleAds("age", "AGE_RANGE_65_UP")).toBe("65 ans et plus");
    expect(libelleAds("age", "AGE_RANGE_UNDETERMINED")).toBe("Inconnu");
    expect(libelleAds("appareil", "OTHER")).toBe("Autre");
    expect(libelleAds("region", "Inconnue")).toBe("Inconnu");
  });

  it("accepte les nouvelles lignes du script et additionne les groupes d'annonces", () => {
    const v = validerEnvoi({ lignes: [
      { jour: "2026-11-20", niveau: "sexe", campagne_id: "1", terme: "FEMALE", clics: 2 },
      { jour: "2026-11-20", niveau: "sexe", campagne_id: "1", terme: "FEMALE", clics: 3 },
      { jour: "2026-11-20", niveau: "region", campagne_id: "1", terme: "Brittany", clics: 1 },
    ] });
    expect(v.ok).toBe(true);
    expect(v.lignes.find((x) => x.niveau === "sexe").clics).toBe(5);
    expect(validerEnvoi({ lignes: [{ jour: "2026-11-20", niveau: "pays", campagne_id: "1" }] }).ok).toBe(false);
  });
});

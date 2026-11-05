import { describe, expect, it } from "vitest";
import { CATEGORIES, summarizeCouts, validateCout } from "@/lib/server/pilotage/couts";

const NOW = Date.parse("2026-11-05T12:00:00Z");
const row = (jour, fournisseur, categorie, montant_eur) => ({ id: `${jour}-${fournisseur}`, jour, fournisseur, libelle: "", categorie, montant_eur, cree_le: `${jour}T08:00:00Z` });

describe("summarizeCouts", () => {
  const rows = [row("2026-11-02", "Vercel", "tech", 20), row("2026-11-04", "Google Cloud", "acquisition", 31.4), row("2026-10-28", "Vercel", "tech", 20), row("2026-09-01", "Greffe", "juridique", 190)];
  const s = summarizeCouts(rows, NOW);
  it("totalise le mois, le mois précédent et les 30 derniers jours", () => {
    expect(s.mois).toBe(51.4);
    expect(s.mois_precedent).toBe(20);
    expect(s.trente_jours).toBe(71.4);
    expect(s.total).toBe(261.4);
  });
  it("donne l'équivalent par jour, sur les jours écoulés du mois et sur 30 jours", () => {
    expect(s.jours_mois).toBe(5);
    expect(s.mois_par_jour).toBe(10.28);
    expect(s.trente_par_jour).toBe(2.38);
  });
  it("totalise chaque catégorie", () => {
    expect(s.par_categorie.find((c) => c.id === "tech")).toMatchObject({ depense: 40 });
    expect(s.par_categorie.find((c) => c.id === "juridique")).toMatchObject({ depense: 190 });
    expect(s.par_categorie.find((c) => c.id === "divers")).toMatchObject({ depense: 0 });
  });
  it("classe les fournisseurs par montant et les dépenses par date", () => {
    expect(s.par_fournisseur.map((f) => f.label)).toEqual(["Greffe", "Vercel", "Google Cloud"].sort((a, b) => ({ Greffe: 190, Vercel: 40, "Google Cloud": 31.4 }[b] - { Greffe: 190, Vercel: 40, "Google Cloud": 31.4 }[a])));
    expect(s.recentes[0].jour).toBe("2026-11-04");
  });
  it("tient sans aucune ligne", () => {
    expect(summarizeCouts([], NOW)).toMatchObject({ total: 0, mois: 0, lignes: 0, recentes: [] });
    expect(summarizeCouts(null, NOW).par_categorie).toHaveLength(CATEGORIES.length);
  });
  it("lit janvier comme suivant décembre", () => {
    const j = summarizeCouts([row("2026-12-20", "X", "divers", 5)], Date.parse("2027-01-10T12:00:00Z"));
    expect(j.mois_precedent).toBe(5);
  });
});

describe("validateCout", () => {
  it("accepte une saisie complète et arrondit au centime", () => {
    expect(validateCout({ jour: "2026-11-05", fournisseur: " Google Cloud ", libelle: "Places", categorie: "acquisition", montant_eur: "31,456" }, NOW)).toEqual({
      ok: true,
      valeur: { jour: "2026-11-05", fournisseur: "Google Cloud", libelle: "Places", categorie: "acquisition", montant_eur: 31.46 },
    });
  });
  it("prend le jour d'aujourd'hui par défaut", () => {
    expect(validateCout({ fournisseur: "X", categorie: "tech", montant_eur: 1 }, NOW).valeur.jour).toBe("2026-11-05");
  });
  it("refuse ce qui est faux", () => {
    expect(validateCout({ fournisseur: "", categorie: "tech", montant_eur: 1 }, NOW)).toEqual({ ok: false, erreur: "fournisseur" });
    expect(validateCout({ fournisseur: "X", categorie: "autre", montant_eur: 1 }, NOW)).toEqual({ ok: false, erreur: "categorie" });
    expect(validateCout({ fournisseur: "X", categorie: "tech", montant_eur: -3 }, NOW)).toEqual({ ok: false, erreur: "montant" });
    expect(validateCout({ fournisseur: "X", categorie: "tech", montant_eur: "abc" }, NOW)).toEqual({ ok: false, erreur: "montant" });
    expect(validateCout({ jour: "05/11/2026", fournisseur: "X", categorie: "tech", montant_eur: 1 }, NOW)).toEqual({ ok: false, erreur: "jour" });
  });
});

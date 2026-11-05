import { describe, expect, it } from "vitest";
import { buildStats } from "@/lib/seo/data";

describe("buildStats", () => {
  const groups = [
    { primary_category: "traiteur", department: "34", price_unit: "par_personne", n: 6, prices: [80, 90, 100, 110, 120] },
    { primary_category: "traiteur", department: "34", price_unit: "forfait", n: 2, prices: [3000] },
    { primary_category: "traiteur", department: "30", price_unit: null, n: 4, prices: [] },
    { primary_category: "photographe", department: "34", price_unit: "forfait", n: 3, prices: [1500] },
    { primary_category: "videaste", department: "34", price_unit: "forfait", n: 2, prices: [1800] },
    { primary_category: "inconnu", department: "34", price_unit: null, n: 9, prices: [] },
    { primary_category: "traiteur", department: "zz", price_unit: null, n: 9, prices: [] },
  ];
  const stats = buildStats(groups);
  it("compte par département, région et France", () => {
    expect(stats.traiteurs["d:34"].n).toBe(8);
    expect(stats.traiteurs["d:30"].n).toBe(4);
    expect(stats.traiteurs["r:Occitanie"].n).toBe(12);
    expect(stats.traiteurs.france.n).toBe(12);
  });
  it("ne garde que les prix dans l'unité du métier, médiane à partir de cinq prix", () => {
    expect(stats.traiteurs["d:34"]).toEqual({ n: 8, priced: 5, median: 100 });
    expect(stats.traiteurs["d:30"]).toEqual({ n: 4, priced: 0, median: null });
  });
  it("réunit les catégories d'un même métier et ignore le reste", () => {
    expect(stats.photographes["d:34"]).toEqual({ n: 5, priced: 2, median: null });
    expect(Object.keys(stats).sort()).toEqual(["photographes", "traiteurs"]);
  });
  it("supporte une liste vide", () => {
    expect(buildStats([])).toEqual({});
    expect(buildStats(null)).toEqual({});
  });
});

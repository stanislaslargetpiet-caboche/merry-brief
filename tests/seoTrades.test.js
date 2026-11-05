import { describe, expect, it } from "vitest";
import { buildStats, allPages } from "@/lib/seo/data";
import { pageDescription, pageModel, pageTitle } from "@/lib/seo/model";
import { TRADES, tradeOf, tradeOfCategory } from "@/lib/seo/trades";
import { regionZone, zoneOf } from "@/lib/seo/geo";

// Un catalogue réduit : des wedding planners et des lieux en Bretagne
const stats = {
  at: "2026-11-05T10:00:00Z",
  stats: buildStats([
    { primary_category: "wedding_planner", department: "29", price_unit: null, n: 12, prices: [] },
    { primary_category: "wedding_planner", department: "35", price_unit: null, n: 9, prices: [] },
    { primary_category: "beaute", department: "29", price_unit: null, n: 3, prices: [] },
    { primary_category: "lieu", department: "29", price_unit: "location", n: 20, prices: [3000, 3500, 4000, 4500, 5000] },
  ]),
};

describe("métiers des pages SEO", () => {
  it("neuf métiers, chacun avec son adresse et ses catégories du catalogue, sans doublon", () => {
    expect(TRADES.map((t) => t.slug)).toEqual(["lieux", "traiteurs", "dj", "fleuristes", "photographes", "wedding-planners", "coiffure-maquillage", "decoration", "robes-costumes"]);
    const cats = TRADES.flatMap((t) => t.catalog);
    expect(new Set(cats).size).toBe(cats.length);
    expect(tradeOfCategory("beaute").slug).toBe("coiffure-maquillage");
    expect(tradeOfCategory("robe").slug).toBe("robes-costumes");
  });

  it("une page n'existe qu'à partir de huit prestataires", () => {
    const hrefs = allPages(stats).map((p) => p.href);
    expect(hrefs).toContain("/mariage/wedding-planners");
    expect(hrefs).toContain("/mariage/wedding-planners/bretagne");
    expect(hrefs).toContain("/mariage/wedding-planners/finistere");
    expect(hrefs).toContain("/mariage/wedding-planners/ille-et-vilaine");
    expect(hrefs.some((h) => h.startsWith("/mariage/coiffure-maquillage"))).toBe(false);
  });

  it("un métier sans prix : le nombre de prestataires, pas de chiffre de prix ni de question sur le coût", () => {
    const trade = tradeOf("wedding-planners");
    const zone = regionZone("Bretagne");
    const model = pageModel(trade, zone, stats);
    expect(pageTitle(trade, zone)).toBe("Wedding planners en Bretagne");
    expect(model.figures[0]).toEqual({ value: "21", label: "wedding planners" });
    expect(model.figures.some((f) => /prix|€/.test(`${f.value} ${f.label}`))).toBe(false);
    expect(model.faq.some((f) => /Combien coûte/.test(f.q))).toBe(false);
    expect(model.faq.at(-1).a).toContain("Les wedding planners paient en crédits");
    expect(model.source).toBe("Source : catalogue Merry, novembre 2026");
    expect(pageDescription(trade, zone, model.stat)).toBe("21 wedding planners en Bretagne. Compare-les et demande tes devis sur Merry, gratuitement.");
    // Les onglets proposent les autres métiers présents dans la zone
    expect(model.tabs.map((t) => t.label)).toEqual(["Lieux", "Wedding planners"]);
  });

  it("un métier avec prix garde son chiffre et sa question", () => {
    const trade = tradeOf("lieux");
    const model = pageModel(trade, zoneOf("finistere"), stats);
    expect(model.figures[1].label).toContain("prix de départ médian");
    expect(model.faq[0].q).toBe("Combien coûte un lieu de mariage dans le Finistère ?");
  });
});

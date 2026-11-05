import { describe, expect, it } from "vitest";
import { TITLE_MAX, seoTitle } from "@/lib/seo/title";
import { TRADES } from "@/lib/seo/trades";
import { DEPARTMENTS, FRANCE, REGIONS, regionZone, zoneOf } from "@/lib/seo/geo";

describe("seoTitle", () => {
  it("garde le suffixe complet quand il tient", () => {
    expect(seoTitle("Lieux de mariage en Bretagne")).toBe("Lieux de mariage en Bretagne : tarifs et sélection | Merry");
  });
  it("raccourcit le suffixe, puis ne garde que la marque", () => {
    expect(seoTitle("Fleuristes de mariage dans la Côte-d'Or")).toBe("Fleuristes de mariage dans la Côte-d'Or : tarifs | Merry");
    expect(seoTitle("Traiteurs de mariage dans les Alpes-de-Haute-Provence")).toBe("Traiteurs de mariage dans les Alpes-de-Haute-Provence | Merry");
  });
  it("ne promet pas de tarifs pour un métier sans prix, et lâche la marque en dernier recours", () => {
    expect(seoTitle("Wedding planners en Bretagne", { priced: false })).toBe("Wedding planners en Bretagne : sélection et devis | Merry");
    expect(seoTitle("Robes de mariée et costumes dans les Alpes-de-Haute-Provence", { priced: false })).toBe("Robes de mariée et costumes dans les Alpes-de-Haute-Provence");
    expect(seoTitle("Robes de mariée et costumes à Paris", { priced: false, quote: false })).toBe("Robes de mariée et costumes à Paris : sélection | Merry");
    expect(seoTitle("Officiants de cérémonie en France", { priced: false })).toBe("Officiants de cérémonie en France : sélection et devis | Merry");
  });
  it("tient dans la limite pour tous les métiers et toutes les zones", () => {
    const zones = [FRANCE, ...REGIONS.map((r) => regionZone(r.name)), ...DEPARTMENTS.map((d) => zoneOf(d.slug))];
    const trop = [];
    for (const trade of TRADES) for (const zone of zones) {
      const t = seoTitle(`${trade.title} ${zone.in}`, { priced: trade.priced !== false });
      if (t.length > TITLE_MAX) trop.push(`${t.length} ${t}`);
    }
    expect(trop).toEqual([]);
  });
});

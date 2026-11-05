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
  it("tient dans la limite pour tous les métiers et toutes les zones", () => {
    const zones = [FRANCE, ...REGIONS.map((r) => regionZone(r.name)), ...DEPARTMENTS.map((d) => zoneOf(d.slug))];
    const trop = [];
    for (const trade of TRADES) for (const zone of zones) {
      const t = seoTitle(`${trade.title} ${zone.in}`);
      if (t.length > TITLE_MAX) trop.push(`${t.length} ${t}`);
    }
    expect(trop).toEqual([]);
  });
});

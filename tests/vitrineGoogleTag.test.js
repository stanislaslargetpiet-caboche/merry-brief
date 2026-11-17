import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GOOGLE_TAG_ID, GOOGLE_TAG_SRC } from "../lib/vitrine/googleTag.js";

// Balise Google (campagne Google Ads, 17 nov. 2026) : sur toutes les pages du site withmerry.com, pas sur l'appli.
describe("balise Google du site", () => {
  it("charge le conteneur transmis par Eugénie", () => {
    expect(GOOGLE_TAG_ID).toBe("GTM-NNL3ZQSH");
    expect(GOOGLE_TAG_SRC).toBe("https://www.googletagmanager.com/gtm.js?id=GTM-NNL3ZQSH");
  });

  it("est posée par les layouts du site vitrine et des pages SEO, pas par celui de l'appli", () => {
    for (const p of ["app/vitrine/layout.js", "app/mariage/layout.js"]) expect(readFileSync(p, "utf8"), p).toContain("<GoogleTag />");
    expect(readFileSync("app/layout.js", "utf8")).not.toContain("GoogleTag");
  });

  it("relaie le choix du bandeau cookies au mode consentement", () => {
    expect(readFileSync("lib/analytics.js", "utf8")).toContain('"consent", "update"');
  });
});

import { describe, expect, it } from "vitest";
import { displayName } from "../lib/server/names.js";

describe("displayName", () => {
  it("met une majuscule aux noms saisis tout en minuscules", () => {
    expect(displayName(" emma ")).toBe("Emma");
    expect(displayName("jean-pierre")).toBe("Jean-Pierre");
    expect(displayName("élodie")).toBe("Élodie");
  });

  it("laisse intact un nom qui a déjà des majuscules", () => {
    expect(displayName("de La Tour")).toBe("de La Tour");
    expect(displayName("LE CERCLE DU GOÛT")).toBe("LE CERCLE DU GOÛT");
  });

  it("accepte un nom absent", () => {
    expect(displayName(null)).toBe("");
  });
});

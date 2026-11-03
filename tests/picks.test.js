import { describe, expect, it } from "vitest";
import { inPlace } from "@/lib/dash/picks";

describe("demande de devis : où se marie-t-on", () => {
  it("met la bonne préposition devant une ville, un département ou une région", () => {
    expect(inPlace("Hyères")).toBe("à Hyères");
    expect(inPlace("Var")).toBe("dans le Var");
    expect(inPlace("Bretagne")).toBe("en Bretagne");
    expect(inPlace("Hauts-de-France")).toBe("dans les Hauts-de-France");
    expect(inPlace("provence")).toBe("en Provence");
    expect(inPlace("Côte d'Azur")).toBe("sur la Côte d'Azur");
    expect(inPlace("")).toBe("");
  });
});

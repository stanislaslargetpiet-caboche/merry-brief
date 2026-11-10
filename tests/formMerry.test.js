import { describe, expect, it } from "vitest";
import { merryProof } from "@/lib/dash/form";

describe("formulaire invités : carte Merry après l'envoi", () => {
  it("cite les deux mariés", () => {
    expect(merryProof({ partner1: "Côme", partner2: "Astrid" })).toBe("Côme & Astrid préparent leur mariage avec Merry.");
  });
  it("accorde au singulier quand un seul prénom est connu", () => {
    expect(merryProof({ partner1: " Léa ", partner2: "" })).toBe("Léa prépare son mariage avec Merry.");
    expect(merryProof({ partner2: "Léo" })).toBe("Léo prépare son mariage avec Merry.");
  });
  it("parle des mariés sans prénom", () => {
    expect(merryProof({})).toBe("Les mariés préparent leur mariage avec Merry.");
    expect(merryProof(null)).toBe("Les mariés préparent leur mariage avec Merry.");
  });
});

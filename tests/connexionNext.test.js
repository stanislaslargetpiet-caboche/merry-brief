import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/connexionNext";

describe("safeNext", () => {
  it("garde les chemins internes", () => {
    expect(safeNext("/dashboard/invites")).toBe("/dashboard/invites");
    expect(safeNext("/pro?onglet=demandes")).toBe("/pro?onglet=demandes");
    expect(safeNext("/pilotage")).toBe("/pilotage");
    expect(safeNext("/pilotage/croissance/samedi")).toBe("/pilotage/croissance/samedi");
  });
  it("refuse le reste", () => {
    expect(safeNext(null)).toBe("/dashboard");
    expect(safeNext("https://exemple.com/pilotage")).toBe("/dashboard");
    expect(safeNext("//exemple.com")).toBe("/dashboard");
    expect(safeNext("/pilotagefaux")).toBe("/dashboard");
  });
});

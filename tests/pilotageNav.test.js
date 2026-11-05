import { describe, expect, it } from "vitest";
import { activeSection } from "@/lib/pilotage/nav";

const tops = (...v) => v.map((top, i) => ({ id: `s${i}`, top }));

describe("activeSection", () => {
  it("prend la dernière section dont le haut a franchi le bas du menu", () => {
    expect(activeSection(tops(-900, -300, 40, 700), 136, false)).toBe("s2");
    expect(activeSection(tops(200, 800, 1400), 136, false)).toBe("s0");
  });
  it("en bas de page, c'est la dernière section", () => {
    expect(activeSection(tops(-900, -300, 500), 136, true)).toBe("s2");
  });
  it("sans section, rien", () => {
    expect(activeSection([], 136, false)).toBe(null);
  });
});

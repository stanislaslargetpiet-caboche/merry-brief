import { describe, expect, it } from "vitest";
import { barPath, courbePath, cumulSerie, echelle, indicesAxe, mesureDepuis, pasAxe } from "@/lib/pilotage/graphes";

describe("echelle", () => {
  it("donne trois graduations rondes au-dessus de la valeur", () => {
    expect(echelle(64)).toEqual({ max: 80, ticks: [0, 40, 80] });
    expect(echelle(100)).toEqual({ max: 100, ticks: [0, 50, 100] });
    expect(echelle(3)).toEqual({ max: 4, ticks: [0, 2, 4] });
  });

  it("garde un axe lisible quand il n'y a presque rien", () => {
    expect(echelle(0).ticks).toEqual([0, 1, 2]);
    expect(echelle(1).ticks).toEqual([0, 1, 2]);
  });
});

describe("barPath", () => {
  it("ne dessine rien sans hauteur", () => {
    expect(barPath(0, 10, 20, 0, 10)).toBe("");
  });

  it("n'arrondit pas plus que la hauteur", () => {
    expect(barPath(0, 9, 20, 1, 10)).toContain("Q0,9 1,9");
  });
});

describe("courbePath", () => {
  it("passe par chaque point sans dépasser le maximum", () => {
    const path = courbePath([{ x: 0, y: 10 }, { x: 10, y: 0 }, { x: 20, y: 10 }]);
    const nombres = path.match(/-?\d+(\.\d+)?/g).map(Number);
    expect(path.startsWith("M0,10")).toBe(true);
    expect(path).toContain(" 10,0C");
    expect(Math.min(...nombres)).toBeGreaterThanOrEqual(0);
  });

  it("tient avec un seul point ou aucun", () => {
    expect(courbePath([])).toBe("");
    expect(courbePath([{ x: 1, y: 2 }])).toBe("M1,2");
  });
});

describe("indicesAxe", () => {
  it("montre tous les jours quand ils ont la place", () => {
    expect(indicesAxe(3, 60, 1)).toEqual([0, 1, 2]);
  });

  it("garde le début, la coupure et la fin sinon", () => {
    expect(indicesAxe(14, 20, 7)).toEqual([0, 7, 13]);
    expect(indicesAxe(14, 20, 0)).toEqual([0, 13]);
  });
});

describe("pasAxe", () => {
  it("garde la première et la dernière date sans les serrer", () => {
    expect(pasAxe(7, 1000)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(pasAxe(30, 300)).toEqual([0, 7, 15, 22, 29]);
    expect(pasAxe(30, 60)).toEqual([0, 29]);
  });
});

describe("cumulSerie", () => {
  it("finit sur le total", () => {
    const rows = cumulSerie([{ n: 1 }, { n: 0 }, { n: 2 }], "n", 10);
    expect(rows.map((r) => r.cumul)).toEqual([8, 8, 10]);
  });

  it("ne descend jamais sous zéro", () => {
    expect(cumulSerie([{ n: 5 }], "n", 2)[0].cumul).toBe(2);
    expect(cumulSerie([{ n: 5 }, { n: 1 }], "n", 2)[0].cumul).toBe(1);
  });
});

describe("mesureDepuis", () => {
  const rows = [{ jour: "2026-11-02", n: 0 }, { jour: "2026-11-03", n: 112 }, { jour: "2026-11-04", n: 0 }];

  it("efface les jours d'avant la mesure, garde les zéros d'après", () => {
    expect(mesureDepuis(rows, "n", "2026-11-03").map((r) => r.n)).toEqual([null, 112, 0]);
  });

  it("ne touche pas les autres clés ni la série d'origine", () => {
    const out = mesureDepuis([{ jour: "2026-11-01", n: 3, m: 2 }], "n", "2026-11-03");
    expect(out[0]).toEqual({ jour: "2026-11-01", n: null, m: 2 });
    expect(mesureDepuis(undefined, "n", "2026-11-03")).toEqual([]);
  });
});

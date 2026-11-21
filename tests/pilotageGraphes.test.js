import { describe, expect, it } from "vitest";
import { visitesHumaines } from "@/lib/server/pilotage/shape";
import { courbePath, cumulSerie, echelle, mesureDepuis, moisSuivis, pasAxe } from "@/lib/pilotage/graphes";

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

describe("visitesHumaines (D-374)", () => {
  it("retire les visites qui n'ont pas l'allure d'un navigateur", () => {
    expect(visitesHumaines({ visites: 80, mesurees: 80, douteuses: 65 })).toBe(15);
  });
  it("laisse sans mesure un jour en partie non relevé", () => {
    expect(visitesHumaines({ visites: 80, mesurees: 30, douteuses: 20 })).toBe(null);
    expect(visitesHumaines({ visites: 80, mesurees: 0, douteuses: 0 })).toBe(null);
  });
  it("compte zéro un jour sans visite", () => {
    expect(visitesHumaines({ visites: 0, mesurees: 0, douteuses: 0 })).toBe(0);
  });
});

describe("moisSuivis", () => {
  it("comble les mois sans dépense jusqu'au mois en cours", () => {
    const rows = moisSuivis([{ mois: "2026-09", n: 40 }, { mois: "2026-11", n: 12.5 }], "2026-12");
    expect(rows).toEqual([
      { jour: "2026-09", n: 40 },
      { jour: "2026-10", n: 0 },
      { jour: "2026-11", n: 12.5 },
      { jour: "2026-12", n: 0 },
    ]);
  });

  it("donne deux points à un seul mois saisi, et passe l'année", () => {
    expect(moisSuivis([{ mois: "2027-01", n: 9 }], "2027-01")).toEqual([
      { jour: "2026-12", n: 0 },
      { jour: "2027-01", n: 9 },
    ]);
  });

  it("s'arrête à douze mois et ne rend rien sans dépense", () => {
    const rows = moisSuivis([{ mois: "2024-01", n: 1 }, { mois: "2026-11", n: 2 }], "2026-11");
    expect(rows).toHaveLength(12);
    expect(rows[0].jour).toBe("2025-12");
    expect(moisSuivis([], "2026-11")).toEqual([]);
  });
});

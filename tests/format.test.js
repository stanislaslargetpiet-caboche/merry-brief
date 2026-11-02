import { describe, expect, it } from "vitest";
import { addDays, daysBetween, euros, fullName, isoDate, normalize, parseAmount, pct, toDate } from "@/lib/dash/format";

describe("format : montants", () => {
  it("écrit les euros à la française", () => {
    expect(euros(1234.6)).toBe("1 235 €");
    expect(euros(-50)).toBe("−50 €");
    expect(euros(50, { signed: true })).toBe("+50 €");
    expect(euros(null)).toBe("–");
    expect(euros("abc")).toBe("–");
  });
  it("lit un montant tapé", () => {
    expect(parseAmount("1 200,50 €")).toBe(1200.5);
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("douze")).toBeNull();
  });
  it("calcule un pourcentage sans diviser par zéro", () => {
    expect(pct(1, 4)).toBe(25);
    expect(pct(1, 0)).toBe(0);
  });
});

describe("format : dates en heure locale", () => {
  it("lit AAAA-MM-JJ sans décalage de fuseau", () => {
    const d = toDate("2027-06-12");
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2027, 5, 12]);
    expect(isoDate(d)).toBe("2027-06-12");
  });
  it("accepte un horodatage et une Date", () => {
    expect(isoDate(toDate("2027-06-12T23:30:00+02:00"))).toBe("2027-06-12");
    expect(isoDate(new Date(2027, 0, 1))).toBe("2027-01-01");
  });
  it("ajoute des jours à travers un changement d'heure", () => {
    expect(isoDate(addDays("2027-03-27", 2))).toBe("2027-03-29");
    expect(daysBetween("2027-03-27", "2027-03-29")).toBe(2);
  });
});

describe("format : noms", () => {
  it("normalise accents, casse et ponctuation", () => {
    expect(normalize("  Élodie  DUPONT-Martin ")).toBe("elodie dupont martin");
    expect(normalize(null)).toBe("");
  });
  it("assemble un nom complet", () => {
    expect(fullName({ first_name: "Léa", last_name: "" })).toBe("Léa");
    expect(fullName({ first_name: "", last_name: "" })).toBe("");
  });
});

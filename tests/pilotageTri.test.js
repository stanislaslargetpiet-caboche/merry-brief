import { describe, expect, it } from "vitest";
import { sensInitial, trier, triSuivant } from "@/lib/pilotage/tri";

const lignes = [
  { id: "a", couple: "Élise et Paul", invites: 7, budget: false, visite: 0, test: false },
  { id: "b", couple: "Côme et Astrid", invites: 146, budget: true, visite: 300, test: false },
  { id: "t", couple: "Arthur et Test", invites: 500, budget: true, visite: 900, test: true },
  { id: "c", couple: "ella et Yann", invites: 7, budget: false, visite: 200, test: false },
  { id: "d", couple: "Bruno et Zoé", invites: null, budget: false, visite: 100, test: false },
];
const ids = (rows) => rows.map((r) => r.id);
const test = (r) => r.test;

describe("trier", () => {
  it("classe les nombres, à égalité dans l'ordre reçu, sans valeur en bas dans les deux sens", () => {
    expect(ids(trier(lignes, (r) => r.invites, -1))).toEqual(["t", "b", "a", "c", "d"]);
    expect(ids(trier(lignes, (r) => r.invites, 1))).toEqual(["a", "c", "b", "t", "d"]);
  });
  it("garde les couples de test sous tous les autres", () => {
    expect(ids(trier(lignes, (r) => r.invites, -1, test))).toEqual(["b", "a", "c", "d", "t"]);
    expect(ids(trier(lignes, (r) => r.visite, 1, test))).toEqual(["a", "d", "c", "b", "t"]);
  });
  it("classe les noms en français, sans tenir compte des accents ni des majuscules", () => {
    expect(ids(trier(lignes, (r) => r.couple, 1, test))).toEqual(["d", "b", "a", "c", "t"]);
  });
  it("classe les oui avant les non en décroissant", () => {
    expect(ids(trier(lignes, (r) => r.budget, -1, test))).toEqual(["b", "a", "c", "d", "t"]);
  });
  it("ne touche pas au tableau reçu", () => {
    const avant = ids(lignes);
    trier(lignes, (r) => r.invites, 1, test);
    expect(ids(lignes)).toEqual(avant);
  });
});

describe("sensInitial et triSuivant", () => {
  it("commence de A à Z pour un texte, du plus grand au plus petit pour un nombre ou un booléen", () => {
    expect(sensInitial(lignes, (r) => r.couple)).toBe(1);
    expect(sensInitial(lignes, (r) => r.invites)).toBe(-1);
    expect(sensInitial([{ invites: null }, { invites: 3 }], (r) => r.invites)).toBe(-1);
    expect(sensInitial(lignes, (r) => r.budget)).toBe(-1);
  });
  it("passe au premier sens, puis à l'autre, puis revient à l'ordre reçu", () => {
    const un = triSuivant(null, "invites", -1);
    expect(un).toEqual({ key: "invites", sens: -1 });
    const deux = triSuivant(un, "invites", -1);
    expect(deux).toEqual({ key: "invites", sens: 1 });
    expect(triSuivant(deux, "invites", -1)).toBeNull();
    expect(triSuivant(deux, "couple", 1)).toEqual({ key: "couple", sens: 1 });
  });
});

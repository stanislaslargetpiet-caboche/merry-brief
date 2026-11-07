import { describe, expect, it } from "vitest";
import { PILOTAGE_NAV, pathFromHash, pilotagePath, resolvePage } from "@/lib/pilotage/nav";

describe("resolvePage", () => {
  it("lit le bouton et la sous-page dans le chemin", () => {
    const { group, page } = resolvePage("/pilotage/croissance/referencement");
    expect(group.id).toBe("croissance");
    expect(page.id).toBe("referencement");
  });
  it("/pilotage ouvre Aujourd'hui", () => {
    const { group, page } = resolvePage("/pilotage");
    expect(group.id).toBe("aujourdhui");
    expect(page.id).toBe("jour");
  });
  it("les anciens chemins de Santé et Demandes mènent à Coulisses", () => {
    expect(resolvePage("/pilotage/aujourdhui/sante").group.id).toBe("coulisses");
    expect(resolvePage("/pilotage/aujourdhui/demandes").page.id).toBe("demandes");
  });
  it("une sous-page inconnue retombe sur la première du bouton", () => {
    expect(resolvePage("/pilotage/coulisses/rien").page.id).toBe("sante");
    expect(resolvePage("/pilotage/rien/site").group.id).toBe("aujourdhui");
  });
});

describe("pathFromHash", () => {
  it("reprend les treize anciennes ancres", () => {
    const anciens = ["sante", "utilisateurs", "demandes", "reseau", "nouveautes", "couts", "site", "referencement", "appli", "produit", "prestataires", "mails", "bugs"];
    for (const id of anciens) expect(pathFromHash(`#${id}`)).toMatch(/^\/pilotage\/[a-z]+\/[a-z]+$/);
    expect(pathFromHash("#demandes")).toBe(pilotagePath("coulisses", "demandes"));
    expect(pathFromHash("#nouveautes")).toBe(pilotagePath("croissance", "campagnes"));
    expect(resolvePage("/pilotage/croissance/samedi").page.id).toBe("campagnes");
  });
  it("sans ancre connue, rien", () => {
    expect(pathFromHash("")).toBe(null);
    expect(pathFromHash("#autre")).toBe(null);
  });
});

describe("PILOTAGE_NAV", () => {
  it("six boutons au plus, identifiants de page uniques", () => {
    expect(PILOTAGE_NAV.length).toBeLessThanOrEqual(6);
    const ids = PILOTAGE_NAV.flatMap((g) => g.pages.map((p) => p.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

import { describe, expect, it } from "vitest";
import { PILOTAGE_NAV, pathFromHash, pilotagePath, resolvePage } from "@/lib/pilotage/nav";

describe("resolvePage", () => {
  it("lit le bouton et la sous-page dans le chemin", () => {
    const { group, page } = resolvePage("/pilotage/acquisition/referencement");
    expect(group.id).toBe("acquisition");
    expect(page.id).toBe("referencement");
  });
  it("/pilotage ouvre Aujourd'hui", () => {
    const { group, page } = resolvePage("/pilotage");
    expect(group.id).toBe("aujourdhui");
    expect(page.id).toBe("jour");
  });
  it("les anciens chemins de Santé et Demandes mènent à leur nouvelle place", () => {
    expect(resolvePage("/pilotage/aujourdhui/sante").group.id).toBe("coulisses");
    expect(resolvePage("/pilotage/aujourdhui/demandes").group.id).toBe("prestataires");
    expect(resolvePage("/pilotage/coulisses/demandes").page.id).toBe("demandes");
  });
  it("les anciens boutons Croissance et Utilisateurs mènent à Acquisition, Couples et Prestataires", () => {
    const vers = (chemin) => {
      const { group, page } = resolvePage(chemin);
      return `${group.id}/${page.id}`;
    };
    expect(vers("/pilotage/croissance/site")).toBe("acquisition/site");
    expect(vers("/pilotage/croissance/agents")).toBe("acquisition/referencement");
    expect(vers("/pilotage/croissance/samedi")).toBe("acquisition/campagnes");
    expect(vers("/pilotage/croissance")).toBe("acquisition/site");
    expect(vers("/pilotage/utilisateurs/comptes")).toBe("couples/comptes");
    expect(vers("/pilotage/utilisateurs/appli")).toBe("couples/activite");
    expect(vers("/pilotage/utilisateurs/couples")).toBe("couples/activite");
    expect(vers("/pilotage/utilisateurs/prestataires")).toBe("prestataires/catalogue");
    expect(vers("/pilotage/coulisses/bugs")).toBe("coulisses/sante");
  });
  it("une sous-page inconnue retombe sur la première du bouton", () => {
    expect(resolvePage("/pilotage/coulisses/rien").page.id).toBe("sante");
    expect(resolvePage("/pilotage/rien/rien").group.id).toBe("aujourdhui");
  });
});

describe("pathFromHash", () => {
  it("reprend les treize anciennes ancres", () => {
    const anciens = ["sante", "utilisateurs", "demandes", "reseau", "nouveautes", "couts", "site", "referencement", "appli", "produit", "prestataires", "mails", "bugs"];
    for (const id of anciens) expect(pathFromHash(`#${id}`)).toMatch(/^\/pilotage\/[a-z]+\/[a-z]+$/);
    expect(pathFromHash("#demandes")).toBe(pilotagePath("prestataires", "demandes"));
    expect(pathFromHash("#nouveautes")).toBe(pilotagePath("acquisition", "campagnes"));
    expect(pathFromHash("#bugs")).toBe(pilotagePath("coulisses", "sante"));
  });
  it("sans ancre connue, rien", () => {
    expect(pathFromHash("")).toBe(null);
    expect(pathFromHash("#autre")).toBe(null);
  });
});

describe("PILOTAGE_NAV", () => {
  it("huit boutons, quatre sous-pages au plus, identifiants de page uniques", () => {
    expect(PILOTAGE_NAV.map((g) => g.id)).toEqual(["aujourdhui", "taches", "reseau", "couples", "prestataires", "acquisition", "mails", "coulisses"]);
    for (const g of PILOTAGE_NAV) expect(g.pages.length).toBeLessThanOrEqual(4);
    const ids = PILOTAGE_NAV.flatMap((g) => g.pages.map((p) => p.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

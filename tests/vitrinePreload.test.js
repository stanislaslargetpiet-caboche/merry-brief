import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ACCUEIL_PRELOAD } from "../lib/vitrine/preload.js";
import { FACES } from "../lib/i18n/vitrine-carrousel.js";

// Les portraits du carrousel de l'accueil sont préchargés avec la page (signalement du 14 nov. 2026 : ronds gris au
// 1er clic sur le 3e onglet, réseau lent).
describe("préchargement de l'accueil", () => {
  it("garde la première image de la carte du haut", () => {
    expect(ACCUEIL_PRELOAD[0]).toBe("/vitrine/blocks/proposition-1.webp");
  });

  it("précharge chaque portrait du carrousel", () => {
    for (const src of Object.values(FACES)) expect(ACCUEIL_PRELOAD).toContain(src);
  });

  it("ne cite que des fichiers présents, sans doublon", () => {
    expect(new Set(ACCUEIL_PRELOAD).size).toBe(ACCUEIL_PRELOAD.length);
    for (const src of ACCUEIL_PRELOAD) expect(existsSync(`public${src}`), src).toBe(true);
  });
});

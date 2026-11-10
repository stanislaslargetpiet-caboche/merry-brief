import { describe, expect, it } from "vitest";
import carrousel, { en as carrouselEn } from "../lib/vitrine/blocks/carrousel.js";
import proposition, { en as propositionEn } from "../lib/vitrine/blocks/proposition.js";
import proAvantApres, { en as proAvantApresEn } from "../lib/vitrine/blocks/pro-avant-apres.js";
import proCredits, { en as proCreditsEn } from "../lib/vitrine/blocks/pro-credits.js";
import proCriteres, { en as proCriteresEn } from "../lib/vitrine/blocks/pro-criteres.js";
import proFiche, { en as proFicheEn } from "../lib/vitrine/blocks/pro-fiche.js";

// Garde-fous des blocs animés du site vitrine (audit du 10 nov. 2026).
const BLOCKS = {
  carrousel,
  carrouselEn,
  proposition,
  propositionEn,
  proAvantApres,
  proAvantApresEn,
  proCredits,
  proCreditsEn,
  proCriteres,
  proCriteresEn,
  proFiche,
  proFicheEn,
};

describe("blocs animés du site vitrine", () => {
  it.each(Object.entries(BLOCKS))("%s : une seule graisse par élément", (_, html) => {
    // Une deuxième graisse dans le même style l'emporte sur la première (titres restés en 400).
    expect(html).not.toMatch(/font-weight:\s*\d+;\s*font-weight:/);
  });

  it.each(Object.entries(BLOCKS))("%s : aucun conseiller (D-125)", (_, html) => {
    expect(html).not.toMatch(/conseill|advisor/i);
  });

  it.each([
    ["français", carrousel, ["Brief.", "Lieux.", "Demande.", "Devis."]],
    ["anglais", carrouselEn, ["Brief.", "Venues.", "Request.", "Quotes."]],
  ])("onglet Prestataires en %s : la demande part avant les devis", (_, html, order) => {
    const slide = html.slice(html.indexOf("mrcar-slide mrcar-s1"), html.indexOf("mrcar-slide mrcar-s2"));
    const mobile = [...slide.matchAll(/class="mrcm-t">([^<]*)</g)].map((m) => m[1]);
    expect(mobile).toEqual(order);
  });
});

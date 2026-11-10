import { describe, expect, it } from "vitest";
import proposition, { en as propositionEn } from "../lib/vitrine/blocks/proposition.js";
import proAvantApres, { en as proAvantApresEn } from "../lib/vitrine/blocks/pro-avant-apres.js";
import proCredits, { en as proCreditsEn } from "../lib/vitrine/blocks/pro-credits.js";
import proCriteres, { en as proCriteresEn } from "../lib/vitrine/blocks/pro-criteres.js";
import proFiche, { en as proFicheEn } from "../lib/vitrine/blocks/pro-fiche.js";
import { CARROUSEL } from "../lib/i18n/vitrine-carrousel.js";

// Garde-fous des blocs animés du site vitrine (audit du 10 nov. 2026).
const BLOCKS = {
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
});

// Toutes les chaînes d'un objet de textes, avec leur chemin (pour les messages d'échec)
function strings(node, path = []) {
  if (typeof node === "string") return [[path.join("."), node]];
  if (Array.isArray(node)) return node.flatMap((v, i) => strings(v, [...path, i]));
  if (node && typeof node === "object") return Object.entries(node).flatMap(([k, v]) => strings(v, [...path, k]));
  return [];
}
// La forme des textes (clés et longueurs de listes), sans les valeurs
function shape(node) {
  if (Array.isArray(node)) return node.map(shape);
  if (node && typeof node === "object") return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, shape(v)]));
  return typeof node;
}

describe("textes du carrousel de l'accueil", () => {
  it("l'anglais a exactement la même forme que le français", () => {
    expect(shape(CARROUSEL.en)).toEqual(shape(CARROUSEL.fr));
  });

  it("tutoie partout (D-076), sauf dans le message écrit par le couple au lieu", () => {
    const own = strings(CARROUSEL.fr).filter(([path]) => !path.startsWith("quotes.lines"));
    expect(own.filter(([, text]) => /\b(vous|votre|vos)\b/i.test(text))).toEqual([]);
  });

  it("ne parle d'aucun conseiller (D-125)", () => {
    const all = [...strings(CARROUSEL.fr), ...strings(CARROUSEL.en)];
    expect(all.filter(([, text]) => /conseill|advisor/i.test(text))).toEqual([]);
  });

  it("aucun montant ne se coupe en bout de ligne (espaces insécables)", () => {
    const all = [...strings(CARROUSEL.fr), ...strings(CARROUSEL.en)];
    expect(all.filter(([, text]) => /\d (\d{3}\b|[€%])/.test(text))).toEqual([]);
  });

  it("trois étapes (D-228) en six scènes (D-244), chaque phrase d'étape et chaque titre de scène finit par un point", () => {
    for (const lang of ["fr", "en"]) {
      const t = CARROUSEL[lang];
      expect(t.steps).toHaveLength(3);
      expect(t.steps.every((step) => step.title.endsWith(".") && step.text.endsWith("."))).toBe(true);
      const titles = ["briefScene", "plan", "matches", "quotes", "guests", "team"].map((k) => t[k].title);
      expect(titles.every((title) => title.endsWith("."))).toBe(true);
    }
  });
});

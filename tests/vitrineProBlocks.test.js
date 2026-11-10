import { describe, expect, it } from "vitest";
import proAvantApres from "../lib/vitrine/blocks/pro-avant-apres.js";
import proCredits from "../lib/vitrine/blocks/pro-credits.js";
import proCriteres from "../lib/vitrine/blocks/pro-criteres.js";
import proFiche from "../lib/vitrine/blocks/pro-fiche.js";

// Garde-fous des quatre blocs animés de la page Prestataires, en français (D-124 : tutoiement partout).
const BLOCKS = { proAvantApres, proCredits, proCriteres, proFiche };

// Phrases écrites par un couple au prestataire, ou par le prestataire au couple : elles gardent leur registre.
const AUTRES_VOIX = [
  "C'est pour un mariage, vos prix ?",
  "Vous êtes libres cet été ?",
  "Vous pouvez nous faire un devis ?",
  "Le domaine est libre le 14 juin 2027. Voulez-vous le visiter ?",
];

// Les textes affichés d'un bloc (ordinateur et téléphone), sans les styles, espaces et apostrophes normalisés
function texts(html) {
  return [...html.replace(/<style[\s\S]*?<\/style>/g, "").matchAll(/>([^<>]+)</g)]
    .map((m) => m[1].replace(/&nbsp;| /g, " ").replace(/’/g, "'").trim())
    .filter(Boolean);
}

describe("blocs animés de la page Prestataires", () => {
  it.each(Object.entries(BLOCKS))("%s : Merry tutoie le prestataire (D-124)", (_, html) => {
    const merry = texts(html).filter((t) => !AUTRES_VOIX.includes(t));
    expect(merry.filter((t) => /\b(vous|votre|vos)\b/i.test(t) || /\p{L}+ez\b/u.test(t))).toEqual([]);
  });

  it("chaque phrase des autres voix existe encore dans un bloc", () => {
    // Une phrase retirée des blocs doit sortir de la liste, pour qu'elle ne laisse rien passer.
    const all = Object.values(BLOCKS).flatMap(texts);
    expect(AUTRES_VOIX.filter((t) => !all.includes(t))).toEqual([]);
  });

  it.each(Object.entries(BLOCKS))("%s : une réponse se paie en crédits, pas en euros", (_, html) => {
    for (const t of texts(html).filter((t) => /^Répondre\b/.test(t))) expect(t).toMatch(/^Répondre · \d+ crédits$/);
    expect(texts(html).filter((t) => /crédit/i.test(t) && /€/.test(t))).toEqual([]);
  });
});

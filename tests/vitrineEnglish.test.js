import { describe, expect, it } from "vitest";
import * as proAvantApres from "../lib/vitrine/blocks/pro-avant-apres.js";
import * as proCredits from "../lib/vitrine/blocks/pro-credits.js";
import * as proCriteres from "../lib/vitrine/blocks/pro-criteres.js";
import * as proFiche from "../lib/vitrine/blocks/pro-fiche.js";
import * as proposition from "../lib/vitrine/blocks/proposition.js";

// Garde-fous de la version anglaise des blocs animés (lot 3) : aucun reste de français, pourcentages
// et numéros à l'américaine.
const BLOCKS = { proAvantApres, proCredits, proCriteres, proFiche, proposition };

function texts(html) {
  return [...html.replace(/<style[\s\S]*?<\/style>/g, "").matchAll(/>([^<>]+)</g)]
    .map((m) => m[1].replace(/&nbsp;| | /g, " ").trim())
    .filter(Boolean);
}

describe("blocs animés en anglais", () => {
  it.each(Object.entries(BLOCKS))("%s : pas de français, pas d'espace avant %", (_, mod) => {
    const shown = texts(mod.en);
    expect(shown.filter((t) => /\b(offerts?|crédits?|invités|demande|devis|et|le|la|les)\b/i.test(t))).toEqual([]);
    expect(shown.filter((t) => /\d %/.test(t))).toEqual([]);
    expect(shown.filter((t) => /\b0\d( \d\d){4}\b/.test(t))).toEqual([]);
  });
});

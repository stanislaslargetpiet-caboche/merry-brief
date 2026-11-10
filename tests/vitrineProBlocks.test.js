import { describe, expect, it } from "vitest";
import { PARTENAIRES_COMPARATIF, PARTENAIRES_FAQ, PARTENAIRES_TEXT } from "../lib/i18n/vitrine-partenaires.js";
import { PRO_SCENES } from "../lib/i18n/vitrine-pro-scenes.js";

// Garde-fous de la page Prestataires : textes de la page et scènes animées (D-124 : tutoiement partout).
const PAGE = [
  ...Object.values(PARTENAIRES_TEXT.fr),
  ...PARTENAIRES_COMPARATIF.flatMap((row) => row.slice(0, 3)),
  ...PARTENAIRES_FAQ.flatMap((row) => row.slice(0, 2)),
];

// Phrases d'un couple au prestataire, du prestataire au couple ou à Merry : elles gardent leur registre.
const AUTRES_VOIX_SCENES = [
  "avant.vague.0",
  "avant.vague.1",
  "avant.vague.2",
  "answer.message",
];
const AUTRES_VOIX_PAGE = ["« Vous êtes libres cet été ? Vos prix ? »", "Prenez-vous une commission ?"];

const vouvoie = (t) => /\b(vous|votre|vos)\b/i.test(t) || /\p{L}+ez\b/u.test(t);

// Toutes les chaînes d'un objet de textes, avec leur chemin (les fonctions sont appelées avec 25)
function strings(node, path = []) {
  if (typeof node === "string") return [[path.join("."), node]];
  if (typeof node === "function") return [[path.join("."), String(node(25))]];
  if (Array.isArray(node)) return node.flatMap((v, i) => strings(v, [...path, i]));
  if (node && typeof node === "object") return Object.entries(node).flatMap(([k, v]) => strings(v, [...path, k]));
  return [];
}
function shape(node) {
  if (Array.isArray(node)) return node.map(shape);
  if (node && typeof node === "object") return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, shape(v)]));
  return typeof node;
}

describe("page Prestataires en français", () => {
  it("scènes animées : Merry tutoie le prestataire (D-124)", () => {
    const merry = strings(PRO_SCENES.fr).filter(([path]) => !AUTRES_VOIX_SCENES.includes(path));
    expect(merry.filter(([, t]) => vouvoie(t))).toEqual([]);
  });

  it("textes de la page : Merry tutoie le prestataire (D-124)", () => {
    expect(PAGE.filter((t) => !AUTRES_VOIX_PAGE.includes(t) && vouvoie(t))).toEqual([]);
  });

  it("chaque phrase des autres voix existe encore", () => {
    // Une phrase retirée de la page doit sortir de la liste, pour qu'elle ne laisse rien passer.
    const paths = strings(PRO_SCENES.fr).map(([path]) => path);
    expect(AUTRES_VOIX_SCENES.filter((p) => !paths.includes(p))).toEqual([]);
    expect(AUTRES_VOIX_PAGE.filter((t) => !PAGE.includes(t))).toEqual([]);
  });

  it("une réponse se paie en crédits, pas en euros", () => {
    expect(PRO_SCENES.fr.reply).toMatch(/^Répondre · 25 crédits$/);
    expect(strings(PRO_SCENES.fr).filter(([, t]) => /crédit/i.test(t) && /€/.test(t))).toEqual([]);
    expect(strings(PRO_SCENES.en).filter(([, t]) => /credit/i.test(t) && /€/.test(t))).toEqual([]);
  });

  it("ne parle d'aucun conseiller (D-125)", () => {
    const all = [...strings(PRO_SCENES.fr), ...strings(PRO_SCENES.en)];
    expect(all.filter(([, t]) => /conseill|advisor/i.test(t))).toEqual([]);
  });

  it("les montants et pourcentages ne se coupent pas en bout de ligne", () => {
    const all = strings(PRO_SCENES.fr);
    expect(all.filter(([, t]) => /\d (\d{3}\b|[€%])/.test(t))).toEqual([]);
  });

  it("chaque titre de scène finit par un point", () => {
    for (const lang of ["fr", "en"]) {
      const titles = ["avant", "match", "offered", "trades", "guarantee", "inbox", "read", "answer", "find", "complete", "live"].map((k) => PRO_SCENES[lang][k].title);
      expect(titles.every((title) => title.endsWith("."))).toBe(true);
    }
  });
});

describe("scènes de la page Prestataires en anglais", () => {
  it("l'anglais a exactement la même forme que le français", () => {
    expect(shape(PRO_SCENES.en)).toEqual(shape(PRO_SCENES.fr));
  });

  it("aucun reste de français, pourcentages à l'américaine", () => {
    const shown = strings(PRO_SCENES.en).filter(([path]) => !path.startsWith("trades.list") && !path.startsWith("answer.stats"));
    expect(shown.filter(([, t]) => /\b(offerts?|crédits?|invités|demande|devis|et|le|la|les|réponse)\b/i.test(t))).toEqual([]);
    expect(shown.filter(([, t]) => /\d\s?%/.test(t) && /\d[\s ]%/.test(t))).toEqual([]);
  });
});

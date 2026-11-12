import { describe, expect, it } from "vitest";
import { buildStats, allPages, cleanName, hasPage, isIndexable } from "@/lib/seo/data";
import { pageDescription, pageModel, pageTitle } from "@/lib/seo/model";
import { TRADES, tradeOf, tradeOfCategory } from "@/lib/seo/trades";
import { FRANCE, regionZone, zoneOf } from "@/lib/seo/geo";

// Un catalogue réduit : des wedding planners et des lieux en Bretagne
const stats = {
  at: "2026-11-05T10:00:00Z",
  stats: buildStats([
    { primary_category: "wedding_planner", department: "29", price_unit: null, n: 12, prices: [] },
    { primary_category: "wedding_planner", department: "35", price_unit: null, n: 9, prices: [] },
    { primary_category: "beaute", department: "29", price_unit: null, n: 3, prices: [] },
    { primary_category: "lieu", department: "29", price_unit: "location", n: 20, prices: [3000, 3500, 4000, 4500, 5000] },
  ]),
};

describe("métiers des pages SEO", () => {
  it("dix métiers, chacun avec son adresse et ses catégories du catalogue, sans doublon", () => {
    expect(TRADES.map((t) => t.slug)).toEqual(["lieux", "traiteurs", "dj", "fleuristes", "photographes", "wedding-planners", "coiffure-maquillage", "decoration", "robes-costumes", "officiants"]);
    const cats = TRADES.flatMap((t) => t.catalog);
    expect(new Set(cats).size).toBe(cats.length);
    expect(tradeOfCategory("beaute").slug).toBe("coiffure-maquillage");
    expect(tradeOfCategory("robe").slug).toBe("robes-costumes");
  });

  it("une page n'existe qu'à partir de huit prestataires", () => {
    const hrefs = allPages(stats).map((p) => p.href);
    expect(hrefs).toContain("/mariage/wedding-planners");
    expect(hrefs).toContain("/mariage/wedding-planners/bretagne");
    expect(hasPage(stats, tradeOf("wedding-planners"), zoneOf("finistere"))).toBe(true);
    expect(hrefs.some((h) => h.startsWith("/mariage/coiffure-maquillage"))).toBe(false);
  });

  it("un petit département reste ouvert mais hors sitemap et en noindex, la région et la France restent indexées", () => {
    const wp = tradeOf("wedding-planners");
    expect(isIndexable(stats, wp, zoneOf("finistere"))).toBe(false);
    expect(allPages(stats).map((p) => p.href)).not.toContain("/mariage/wedding-planners/finistere");
    expect(isIndexable(stats, wp, regionZone("Bretagne"))).toBe(true);
    expect(isIndexable(stats, wp, FRANCE)).toBe(true);
    // Les métiers plus anciens gardent leurs pages départementales dès huit fiches
    expect(isIndexable(stats, tradeOf("lieux"), zoneOf("finistere"))).toBe(true);
    const big = { at: stats.at, stats: buildStats([{ primary_category: "wedding_planner", department: "35", price_unit: null, n: 25, prices: [] }]) };
    expect(isIndexable(big, wp, zoneOf("ille-et-vilaine"))).toBe(true);
  });

  it("chaque page a un paragraphe construit sur ses comptes, différent d'une zone à l'autre", () => {
    const wp = tradeOf("wedding-planners");
    expect(pageModel(wp, FRANCE, stats).intro).toBe("Merry référence 21 wedding planners en France. Les régions les mieux fournies : Bretagne (21).");
    expect(pageModel(wp, regionZone("Bretagne"), stats).intro).toBe("21 wedding planners en Bretagne, soit 100 % des 21 de France, répartis dans 2 départements. Les plus fournis : Finistère (12), Ille-et-Vilaine (9).");
    const dep = pageModel(wp, zoneOf("finistere"), stats).intro;
    expect(dep).toBe("12 wedding planners dans le Finistère, soit 57 % des 21 de France. Dans la même région : Ille-et-Vilaine (9).");
    expect(dep).not.toBe(pageModel(wp, zoneOf("ille-et-vilaine"), stats).intro);
  });

  it("un métier sans prix : le nombre de prestataires, pas de chiffre de prix ni de question sur le coût", () => {
    const trade = tradeOf("wedding-planners");
    const zone = regionZone("Bretagne");
    const model = pageModel(trade, zone, stats);
    expect(pageTitle(trade, zone)).toBe("Wedding planners en Bretagne");
    expect(model.figures[0]).toEqual({ value: "21", label: "wedding planners" });
    expect(model.figures.some((f) => /prix|€/.test(`${f.value} ${f.label}`))).toBe(false);
    expect(model.faq.some((f) => /Combien coûte/.test(f.q))).toBe(false);
    expect(model.faq.at(-1).a).toContain("Les wedding planners paient en crédits");
    expect(model.source).toBe("Source : catalogue Merry, novembre 2026");
    expect(pageDescription(trade, zone, model.stat)).toBe("21 wedding planners en Bretagne. Compare-les et demande tes devis sur Merry, gratuitement.");
    // Les onglets proposent les autres métiers présents dans la zone
    expect(model.tabs.map((t) => t.label)).toEqual(["Lieux", "Wedding planners"]);
  });

  it("les officiants n'ont qu'une page nationale tant qu'aucune zone n'atteint huit fiches", () => {
    const few = { at: stats.at, stats: buildStats(["12", "15", "21", "22", "36", "38", "41", "49", "67"].map((department) => ({ primary_category: "officiant", department, price_unit: null, n: 1, prices: [] }))) };
    expect(allPages(few).map((p) => p.href)).toEqual(["/mariage/officiants"]);
    const trade = tradeOf("officiants");
    const model = pageModel(trade, FRANCE, few);
    expect(pageTitle(trade, FRANCE)).toBe("Officiants de cérémonie en France");
    expect(model.figures[0]).toEqual({ value: "9", label: "officiants de cérémonie" });
    expect(model.pills).toEqual([]);
  });

  it("les noms d'officiants perdent leur descriptif", () => {
    expect(cleanName("Emy Cérémonies - Officiante de cérémonie en Isère/Rhône Alpes")).toBe("Emy Cérémonies");
    expect(cleanName("Les Bulles de Bonheur - Laetitia GOUX - Officiante de Cérémonie laïque")).toBe("Les Bulles de Bonheur");
    expect(cleanName("Un vent d'amour")).toBe("Un vent d'amour");
  });

  it("les boutiques de robes : on les contacte, on ne leur demande pas de devis", () => {
    const trade = tradeOf("robes-costumes");
    expect(pageDescription(trade, FRANCE, { n: 612, median: null })).toBe("612 boutiques de robes et de costumes en France. Compare-les et contacte-les sur Merry, gratuitement.");
  });

  describe("bloc « En chiffres » et FAQ locale (D-287)", () => {
    const local = (o) => ({ heberg: 0, cap150: 0, ceremonie: 0, gare30: 0, notes: 0, notes_somme: 0, avis: 0, tres_bien_notes: 0, avis100: 0, ...o });
    const breizh = {
      at: "2026-11-12T10:00:00Z",
      stats: buildStats([
        { primary_category: "lieu", department: "29", price_unit: null, n: 150, prices: [], ...local({ heberg: 60, cap150: 40, ceremonie: 20, gare30: 50, notes: 70, notes_somme: 329, avis: 9000 }) },
        { primary_category: "lieu", department: "56", price_unit: null, n: 121, prices: [], ...local({ heberg: 50, cap150: 30, ceremonie: 30, gare30: 40, notes: 60, notes_somme: 282, avis: 8000 }) },
        { primary_category: "photographe", department: "56", price_unit: null, n: 38, prices: [], ...local({ notes: 38, notes_somme: 188.1, avis: 3000, tres_bien_notes: 30, avis100: 8 }) },
        { primary_category: "photographe", department: "29", price_unit: null, n: 28, prices: [], ...local({ notes: 28, notes_somme: 138.6, avis: 1500, tres_bien_notes: 20, avis100: 3 }) },
        { primary_category: "videaste", department: "35", price_unit: null, n: 5, prices: [], ...local({ notes: 5, notes_somme: 25, avis: 100, tres_bien_notes: 4 }) },
      ]),
    };
    const fiche = (id, name, area, o = {}) => ({ id, name, area, beds: null, seats: null, station: { minutes: null, name: null }, rating: null, reviews: null, ...o });
    const lieux = {
      heberg: [fiche("a", "Domaine Le Mezo", "Morbihan", { beds: 250 }), fiche("b", "Le Manoir d'Alexandre", "Morbihan", { beds: 119 }), fiche("c", "Château de Kersaliou", "Finistère", { beds: 113 })],
      cap150: [fiche("d", "Château du Plessis Josso", "Morbihan", { seats: 220 })],
      gare30: [fiche("e", "Domaine du Plessis-Kaër", "Morbihan", { station: { minutes: 8, name: "Auray" } }), fiche("f", "Domaine de Keranvéo", "Finistère", { station: { minutes: 6, name: "Rosporden" } })],
    };

    it("les lieux : hébergement, 150 places, cérémonie et note, sources citées", () => {
      const model = pageModel(tradeOf("lieux"), regionZone("Bretagne"), breizh, lieux);
      expect(model.numbers).toEqual([
        { value: "110", label: "avec hébergement" },
        { value: "70", label: "pour 150 invités assis et plus" },
        { value: "50", label: "avec cérémonie sur place" },
        { value: "4,7", label: "note Google, 17\u202f000 avis" },
      ]);
      expect(model.source).toBe("Sources : catalogue Merry et notes Google, novembre 2026 ; Mariages.net, rapport 2025");
    });

    it("les lieux : trois questions locales avant le prix et la gratuité, les fiches en liens", () => {
      const model = pageModel(tradeOf("lieux"), regionZone("Bretagne"), breizh, lieux);
      expect(model.faq.map((f) => f.q)).toEqual([
        "Quels lieux de mariage avec hébergement en Bretagne ?",
        "Un lieu pour 150 invités en Bretagne ?",
        "Un lieu de mariage près d'une gare en Bretagne ?",
        "Combien coûte un lieu de mariage ?",
        "Merry, c'est vraiment gratuit ?",
      ]);
      const [heberg, cap, gare] = model.faq;
      expect(heberg.a).toBe("110 lieux en Bretagne ont des couchages sur place. Les plus grands : Domaine Le Mezo (250 couchages, Morbihan), Le Manoir d'Alexandre (119, Morbihan) et Château de Kersaliou (113, Finistère).");
      expect(heberg.parts.filter((p) => typeof p !== "string")).toEqual([
        { label: "Domaine Le Mezo", href: "/mariage/prestataire/a" },
        { label: "Le Manoir d'Alexandre", href: "/mariage/prestataire/b" },
        { label: "Château de Kersaliou", href: "/mariage/prestataire/c" },
      ]);
      expect(cap.a).toBe("70 lieux en Bretagne reçoivent 150 invités assis ou plus. Par exemple Château du Plessis Josso (220 places, Morbihan).");
      expect(gare.a).toBe("90 lieux en Bretagne sont à moins de 30 minutes d'une gare TGV. Les plus proches : Domaine du Plessis-Kaër (8 min d'Auray, Morbihan) et Domaine de Keranvéo (6 min de Rosporden, Finistère).");
      // Les questions génériques d'avant (délai de réservation, budget moyen) ont disparu
      expect(model.faq.some((f) => /combien de temps avant|Quel budget/.test(f.q))).toBe(false);
    });

    it("une page départementale ne répète pas le département de chaque fiche", () => {
      const model = pageModel(tradeOf("lieux"), zoneOf("morbihan"), breizh, { heberg: lieux.heberg.slice(0, 2) });
      expect(model.faq[0].a).toBe("50 lieux dans le Morbihan ont des couchages sur place. Les plus grands : Domaine Le Mezo (250 couchages) et Le Manoir d'Alexandre (119).");
      // Pas d'exemple, pas de question
      expect(model.faq.map((f) => f.q)).toEqual(["Quels lieux de mariage avec hébergement dans le Morbihan ?", "Combien coûte un lieu de mariage ?", "Merry, c'est vraiment gratuit ?"]);
    });

    it("les autres métiers : notes et avis, les mieux notés, puis les départements en liens", () => {
      const notes = [fiche("g", "Oxana Photography", "Ille-et-Vilaine", { rating: 5, reviews: 594 }), fiche("h", "Boite à Clichés", "Morbihan", { rating: 4.96, reviews: 243 })];
      const model = pageModel(tradeOf("photographes"), regionZone("Bretagne"), breizh, { notes });
      expect(model.numbers).toEqual([
        { value: "4,95", label: "note Google moyenne" },
        { value: "4\u202f600", label: "avis Google" },
        { value: "54", label: "notés 4,8 et plus" },
        { value: "11", label: "avec 100 avis et plus" },
      ]);
      expect(model.faq[0].q).toBe("Quels photographes de mariage les mieux notés en Bretagne ?");
      expect(model.faq[0].a).toBe("54 photographes et vidéastes en Bretagne ont 4,8 ou plus sur au moins 20 avis Google. En tête : Oxana Photography (5,0 sur 594 avis, Ille-et-Vilaine) et Boite à Clichés (5,0 sur 243 avis, Morbihan).");
      expect(model.faq[1].q).toBe("Un photographe de mariage dans ton département ?");
      expect(model.faq[1].a).toBe("38 dans le Morbihan, 28 dans le Finistère et 5 en Ille-et-Vilaine.");
      // Lien vers les départements qui ont leur page (8 fiches au moins), texte simple pour les autres
      expect(model.faq[1].parts.filter((p) => typeof p !== "string")).toEqual([
        { label: "Morbihan", href: "/mariage/photographes/morbihan" },
        { label: "Finistère", href: "/mariage/photographes/finistere" },
      ]);
    });

    it("sans les comptes du SQL du 12 nov., ni bloc ni question locale", () => {
      const model = pageModel(tradeOf("lieux"), zoneOf("finistere"), stats, lieux);
      expect(model.numbers).toEqual([]);
      expect(model.faq.map((f) => f.q)).toEqual(["Combien coûte un lieu de mariage dans le Finistère ?", "Merry, c'est vraiment gratuit ?"]);
    });

    it("des comptes à zéro disparaissent, et le bloc entier sous deux chiffres", () => {
      const thin = { at: breizh.at, stats: buildStats([{ primary_category: "lieu", department: "22", price_unit: null, n: 10, prices: [], ...local({ heberg: 3 }) }]) };
      expect(pageModel(tradeOf("lieux"), zoneOf("cotes-d-armor"), thin).numbers).toEqual([]);
      const two = { at: breizh.at, stats: buildStats([{ primary_category: "lieu", department: "22", price_unit: null, n: 10, prices: [], ...local({ heberg: 3, ceremonie: 2 }) }]) };
      expect(pageModel(tradeOf("lieux"), zoneOf("cotes-d-armor"), two).numbers.map((f) => f.label)).toEqual(["avec hébergement", "avec cérémonie sur place"]);
    });
  });

  it("un métier avec prix garde son chiffre et sa question", () => {
    const trade = tradeOf("lieux");
    const model = pageModel(trade, zoneOf("finistere"), stats);
    expect(model.figures[1].label).toContain("prix de départ médian");
    expect(model.faq[0].q).toBe("Combien coûte un lieu de mariage dans le Finistère ?");
  });
});

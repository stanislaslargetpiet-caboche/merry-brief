import { describe, expect, it } from "vitest";
import { chiffresGoogleAds } from "@/lib/pilotage/googleAds";

describe("bloc Google Ads du pilotage", () => {
  it("ne compte que les visites et inscriptions venues d'une annonce Google", () => {
    const entonnoir = [
      { source: "google-ads", site: 30, appli: 10, equipe: 5, essentiel: 3, preparation: 2, compte: 2 },
      { source: "google-b", site: 10, appli: 2, equipe: 1, essentiel: 0, preparation: 0, compte: 0 },
      { source: "meta-a", site: 50, appli: 20, equipe: 10, essentiel: 8, preparation: 6, compte: 5 },
      { source: "Sans source", site: 200, appli: 40, equipe: 20, essentiel: 15, preparation: 12, compte: 10 },
    ];
    const sources = [{ label: "google-ads", n: 3 }, { label: "meta-a", n: 4 }, { label: "Sans source", n: 8 }];
    expect(chiffresGoogleAds(entonnoir, sources)).toEqual({ site: 40, inscriptions: 3, taux: 8 });
  });

  it("affiche des zéros sans annonce Google", () => {
    expect(chiffresGoogleAds([{ source: "meta-a", site: 5, appli: 1, equipe: 0, essentiel: 0, preparation: 0, compte: 0 }], [])).toEqual({ site: 0, inscriptions: 0, taux: null });
    expect(chiffresGoogleAds([], undefined)).toEqual({ site: 0, inscriptions: 0, taux: null });
  });
});

import { campagneDeSource, resumeGoogleAds } from "@/lib/pilotage/googleAds";
import { validerEnvoi } from "@/lib/server/pilotage/googleAds";
import { lienAvecSource, sourceASuivre } from "@/lib/seo/sourceLinks";
import { isClicGoogleAds } from "@/lib/compteur";

describe("dépense Google Ads (D-381)", () => {
  const joursList = ["2026-11-14", "2026-11-15", "2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19"];
  const l = (jour, niveau, extra) => ({ jour, niveau, campagne_id: "111", campagne: "Lieux", groupe: "", terme: "", correspondance: "", impressions: 100, clics: 4, cout_eur: 10, conversions: 0, ...extra });
  const lignes = [
    l("2026-11-15", "campagne"),
    l("2026-11-17", "campagne"),
    l("2026-11-18", "campagne", { cout_eur: 9.5, clics: 5 }),
    l("2026-11-19", "campagne", { campagne_id: "222", campagne: "Traiteurs", cout_eur: 10.5 }),
    l("2026-11-18", "mot_cle", { terme: "lieu mariage", correspondance: "PHRASE", cout_eur: 6 }),
    l("2026-11-19", "mot_cle", { terme: "lieu mariage", correspondance: "PHRASE", cout_eur: 3 }),
    l("2026-11-19", "recherche", { terme: "Lieu mariage Rhône", cout_eur: 2 }),
    l("2026-11-19", "recherche", { terme: "lieu mariage rhône", cout_eur: 1 }),
  ];
  const utilisateurs = [
    { source: "google-ads", cree: "2026-11-19T20:54:14Z", devis: 4 },
    { source: "gads-111", cree: "2026-11-18T09:00:00Z", devis: 0 },
    { source: "seo", cree: "2026-11-18T09:00:00Z", devis: 3 },
    { source: "gads-111", cree: "2026-11-15T09:00:00Z", devis: 0 },
  ];

  it("dépense, inscriptions et coût par inscription sur la période et la précédente", () => {
    const r = resumeGoogleAds({ lignes, joursList, jours: 3, entonnoir: [], sources: [], utilisateurs });
    expect(r.courant).toMatchObject({ cout: 30, clics: 13, inscriptions: 2, actifs: 1, cout_inscription: 15, cout_actif: 30 });
    expect(r.precedent).toMatchObject({ cout: 10, inscriptions: 1, cout_inscription: 10 });
    expect(r.series.find((d) => d.jour === "2026-11-19")).toMatchObject({ cout: 10.5, inscriptions: 1 });
  });

  it("range les inscriptions par campagne, les mots-clés et les recherches tapées", () => {
    const r = resumeGoogleAds({ lignes, joursList, jours: 3, entonnoir: [], sources: [], utilisateurs });
    expect(r.campagnes.map((c) => [c.campagne, c.cout, c.inscriptions])).toEqual([["Lieux", 19.5, 1], ["Traiteurs", 10.5, 0]]);
    expect(r.sansCampagne).toBe(1);
    expect(r.motsCles).toEqual([expect.objectContaining({ terme: "lieu mariage", cout: 9, clics: 8, cpc: 1.13 })]);
    expect(r.recherches).toHaveLength(1);
    expect(r.recherches[0]).toMatchObject({ cout: 3, clics: 8 });
  });

  it("lit la campagne d'une source gads-<id>", () => {
    expect(campagneDeSource("gads-123")).toBe("123");
    expect(campagneDeSource("google-ads")).toBeNull();
  });

  it("valide l'envoi du script et additionne les doublons", () => {
    const v = validerEnvoi({ lignes: [l("2026-11-19", "campagne"), l("2026-11-19", "campagne", { cout_eur: "0.5" })] });
    expect(v.ok).toBe(true);
    expect(v.lignes).toHaveLength(1);
    expect(v.lignes[0]).toMatchObject({ cout_eur: 10.5, clics: 8 });
    expect(validerEnvoi({ lignes: [l("19/11", "campagne")] })).toEqual({ ok: false, erreur: "ligne 1" });
    expect(validerEnvoi({ lignes: [l("2026-11-19", "autre")] }).ok).toBe(false);
    expect(validerEnvoi({ lignes: [l("2026-11-19", "campagne", { cout_eur: -1 })] }).ok).toBe(false);
    expect(validerEnvoi({}).ok).toBe(false);
  });
});

describe("source d'une annonce sur les pages SEO (D-381)", () => {
  const origin = "https://www.withmerry.com";
  it("reconnaît le clic d'annonce et la source à faire suivre", () => {
    expect(isClicGoogleAds("?gclid=abc")).toBe(true);
    expect(isClicGoogleAds("?source=seo")).toBe(false);
    expect(sourceASuivre("?gclid=abc")).toBe("google-ads");
    expect(sourceASuivre("?source=gads-123&gclid=abc")).toBe("gads-123");
    expect(sourceASuivre("?source=seo")).toBeNull();
    expect(sourceASuivre("")).toBeNull();
  });
  it("remplace « seo » sur l'inscription et fait suivre la source sur les pages du site", () => {
    expect(lienAvecSource("https://app.withmerry.com/?source=seo", "google-ads", origin)).toBe("https://app.withmerry.com/?source=google-ads");
    expect(lienAvecSource("/mariage/lieux/rhone", "gads-1", origin)).toBe("/mariage/lieux/rhone?source=gads-1");
    expect(lienAvecSource("https://app.withmerry.com/pro/fiche", "google-ads", origin)).toBe("https://app.withmerry.com/pro/fiche");
    expect(lienAvecSource("https://calendly.com/x", "google-ads", origin)).toBe("https://calendly.com/x");
    expect(lienAvecSource("#faq", "google-ads", origin)).toBe("#faq");
  });
});

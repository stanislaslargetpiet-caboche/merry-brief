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

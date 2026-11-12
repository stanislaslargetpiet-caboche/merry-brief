import { describe, expect, it } from "vitest";
import { avecInscriptions, interneDemande, isInterne, isPageVisit, isPub, isRobot, qualiteEntetes, sourceOf } from "@/lib/compteur";
import { entonnoir } from "@/lib/server/pilotage/posthog";

const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 [FBAN/FBIOS]";

describe("compteur anonyme", () => {
  it("lit la source de l'adresse d'arrivée", () => {
    expect(sourceOf("?source=meta-c&fbclid=abc")).toBe("meta-c");
    expect(sourceOf("?fbclid=abc")).toBe(null);
    expect(sourceOf("?source=<script>")).toBe(null);
  });

  it("compte une page ouverte par un navigateur, pas un robot ni un préchargement", () => {
    expect(isPageVisit(new Headers({ "user-agent": UA, "sec-fetch-dest": "document" }))).toBe(true);
    expect(isPageVisit(new Headers({ "user-agent": UA }))).toBe(true);
    expect(isPageVisit(new Headers({ "user-agent": UA, rsc: "1" }))).toBe(false);
    expect(isPageVisit(new Headers({ "user-agent": UA, "next-router-prefetch": "1" }))).toBe(false);
    expect(isPageVisit(new Headers({ "user-agent": UA, "sec-fetch-dest": "empty" }))).toBe(false);
    expect(isPageVisit(new Headers({ "user-agent": UA }), "HEAD")).toBe(false);
    expect(isRobot("facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)")).toBe(true);
    expect(isRobot("")).toBe(true);
    expect(isRobot(UA)).toBe(false);
  });

  it("range les passages par source et par étape", () => {
    const rows = entonnoir([["meta-a", "site", "3"], ["meta-a", "equipe", "1"], ["", "site", "10"], ["meta-a", "inconnue", "5"]]);
    expect(rows[0]).toMatchObject({ source: "Sans source", site: 10, equipe: 0 });
    expect(rows[1]).toMatchObject({ source: "meta-a", site: 3, equipe: 1, compte: 0 });
    expect(rows[1].inconnue).toBeUndefined();
  });

  it("distingue les sources publicitaires", () => {
    expect(isPub("meta-a")).toBe(true);
    expect(isPub("google-b")).toBe(true);
    expect(isPub("seo")).toBe(false);
    expect(isPub("Sans source")).toBe(false);
    expect(isPub("test-claude")).toBe(false);
  });

  it("ajoute les inscriptions, même pour une source sans passage compté", () => {
    const rows = avecInscriptions([{ source: "meta-a", site: 5 }], [{ label: "meta-a", n: 1 }, { label: "meta-b", n: 2 }, { label: "seo", n: 0 }]);
    expect(rows.find((r) => r.source === "meta-a").inscriptions).toBe(1);
    expect(rows.find((r) => r.source === "meta-b")).toMatchObject({ site: 0, inscriptions: 2 });
    expect(rows.some((r) => r.source === "seo")).toBe(false);
  });
  it("lit la demande ?interne=1 ou ?interne=0 et le repère déjà posé", () => {
    expect(interneDemande("?interne=1")).toBe("pose");
    expect(interneDemande("?source=meta-a&interne=0")).toBe("retire");
    expect(interneDemande("?interne=oui")).toBe(null);
    expect(interneDemande("")).toBe(null);
    expect(isInterne(new Headers({ cookie: "a=b; merry_interne=1; c=d" }))).toBe(true);
    expect(isInterne(new Headers({ cookie: "merry_interne=1" }))).toBe(true);
    expect(isInterne(new Headers({ cookie: "merry_interne=0" }))).toBe(false);
    expect(isInterne(new Headers({ cookie: "xmerry_interne=1" }))).toBe(false);
    expect(isInterne(new Headers())).toBe(false);
  });

  it("relève si la requête a l'allure d'un navigateur qui ouvre une page", () => {
    const navigateur = { "sec-fetch-dest": "document", "sec-fetch-mode": "navigate", "accept-language": "fr-FR,fr;q=0.9" };
    expect(qualiteEntetes(new Headers(navigateur))).toBe("complet");
    expect(qualiteEntetes(new Headers({ "user-agent": UA }))).toBe("sans_sec_fetch");
    expect(qualiteEntetes(new Headers({ ...navigateur, "accept-language": "" }))).toBe("sans_langue");
    expect(qualiteEntetes(new Headers({ ...navigateur, "sec-fetch-mode": "cors" }))).toBe("autre");
  });
});

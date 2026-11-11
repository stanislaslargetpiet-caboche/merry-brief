import { describe, expect, it } from "vitest";
import { classifyRobot } from "@/lib/robots";

describe("classifyRobot", () => {
  it("range les robots par famille et par type", () => {
    expect(classifyRobot("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")).toEqual({ famille: "Googlebot", categorie: "Moteur de recherche" });
    expect(classifyRobot("facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)").categorie).toBe("Aperçu de lien");
    expect(classifyRobot("WhatsApp/2.23.20 A")).toEqual({ famille: "WhatsApp", categorie: "Aperçu de lien" });
    expect(classifyRobot("curl/8.4.0")).toEqual({ famille: "Scripts", categorie: "Script" });
    expect(classifyRobot("Mozilla/5.0 HeadlessChrome/120").famille).toBe("Navigateur sans écran");
  });
  it("nomme les requêtes sans User-Agent et les robots inconnus", () => {
    expect(classifyRobot("")).toEqual({ famille: "Sans User-Agent", categorie: "Autre" });
    expect(classifyRobot(undefined).categorie).toBe("Autre");
    expect(classifyRobot("MaisonCrawler/1.0").famille).toBe("Autres robots");
  });
});

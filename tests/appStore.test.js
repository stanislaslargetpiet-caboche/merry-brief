import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { APP_STORE_BANNER, APP_STORE_URL, showAppCard } from "../lib/appStore.js";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Mobile/15E148 Safari/604.1";

describe("Merry sur l'App Store", () => {
  it("pointe vers la fiche de Merry App", () => {
    expect(APP_STORE_URL).toBe("https://apps.apple.com/app/merry-app/id6835056425");
    expect(APP_STORE_BANNER).toEqual({ appId: "6835056425" });
  });

  it("montre la carte sur iPhone, jamais dans l'appli ni une fois fermée", () => {
    expect(showAppCard(IPHONE, false, false)).toBe(true);
    expect(showAppCard(IPHONE, true, false)).toBe(false);
    expect(showAppCard(IPHONE, false, true)).toBe(false);
    expect(showAppCard("Mozilla/5.0 (Linux; Android 15; Pixel 9)", false, false)).toBe(false);
    expect(showAppCard("Mozilla/5.0 (Macintosh; Intel Mac OS X 15_1)", false, false)).toBe(false);
  });

  it("garde les badges officiels d'Apple, sans script", () => {
    for (const lang of ["fr", "en"]) {
      const svg = readFileSync(`public/vitrine/app-store-${lang}.svg`, "utf8");
      expect(svg).toMatch(/^<svg id="livetype"/);
      expect(svg).not.toMatch(/<script|onload=|href=/i);
    }
    expect(existsSync("public/vitrine/app-store-qr.svg")).toBe(true);
    expect(existsSync("public/vitrine/app-invites.webp")).toBe(true);
  });
});

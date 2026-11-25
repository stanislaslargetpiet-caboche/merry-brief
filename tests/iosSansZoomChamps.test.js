import { describe, expect, it } from "vitest";
import { isIos, withMaxScale } from "@/components/IosSansZoomChamps";

describe("zoom automatique d'iOS sur les champs", () => {
  it("reconnaît iPhone, iPad (même en mode bureau) et l'appli iOS, pas Android ni un Mac", () => {
    expect(isIos({ platform: "iPhone", userAgent: "", maxTouchPoints: 5 })).toBe(true);
    expect(isIos({ platform: "MacIntel", userAgent: "", maxTouchPoints: 5 })).toBe(true);
    expect(isIos({ platform: "MacIntel", userAgent: "", maxTouchPoints: 0 })).toBe(false);
    expect(isIos({ platform: "Linux armv8l", userAgent: "Mozilla/5.0 (Linux; Android 14)", maxTouchPoints: 5 })).toBe(false);
    expect(isIos(undefined)).toBe(false);
  });

  it("ajoute maximum-scale=1 une seule fois", () => {
    const base = "width=device-width, initial-scale=1, viewport-fit=cover";
    expect(withMaxScale(base)).toBe(`${base}, maximum-scale=1`);
    expect(withMaxScale(withMaxScale(base))).toBe(`${base}, maximum-scale=1`);
  });
});

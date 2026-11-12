import { afterEach, describe, expect, it, vi } from "vitest";
import { AWAY_MS, NAV_FRESH_MS, canReloadNow, claimReload, isStale, shouldReload } from "../lib/version.js";

const doc = ({ active = { tagName: "BODY" }, modal = false } = {}) => ({
  activeElement: active,
  querySelector: () => (modal ? {} : null),
});

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
}

describe("onglet en retard sur la version en ligne", () => {
  it("compare les deux commits, et seulement quand les deux sont connus", () => {
    expect(isStale("aaa", "bbb")).toBe(true);
    expect(isStale("aaa", "aaa")).toBe(false);
    expect(isStale("", "bbb")).toBe(false);
    expect(isStale("aaa", "")).toBe(false);
  });

  it("ne recharge pas pendant une saisie ni avec une fenêtre ouverte", () => {
    expect(canReloadNow(doc())).toBe(true);
    expect(canReloadNow(doc({ active: { tagName: "INPUT" } }))).toBe(false);
    expect(canReloadNow(doc({ active: { tagName: "TEXTAREA" } }))).toBe(false);
    expect(canReloadNow(doc({ active: { tagName: "DIV", isContentEditable: true } }))).toBe(false);
    expect(canReloadNow(doc({ modal: true }))).toBe(false);
  });

  it("recharge au retour après une vraie absence, pas après un aller-retour rapide", () => {
    expect(shouldReload({ stale: true, awayMs: AWAY_MS, safe: true })).toBe(true);
    expect(shouldReload({ stale: true, awayMs: 24 * 3600 * 1000, safe: true })).toBe(true);
    expect(shouldReload({ stale: true, awayMs: 30 * 1000, safe: true })).toBe(false);
  });

  it("recharge juste après une navigation interne, pas longtemps après", () => {
    expect(shouldReload({ stale: true, sinceNavMs: 500, safe: true })).toBe(true);
    expect(shouldReload({ stale: true, sinceNavMs: NAV_FRESH_MS + 1, safe: true })).toBe(false);
  });

  it("ne recharge jamais un onglet à jour, ni quand ce n'est pas sûr", () => {
    expect(shouldReload({ stale: false, awayMs: AWAY_MS * 10, safe: true })).toBe(false);
    expect(shouldReload({ stale: true, awayMs: AWAY_MS * 10, safe: false })).toBe(false);
  });

  it("ne recharge qu'une fois par version en ligne, et pas sans stockage", () => {
    const storage = memoryStorage();
    expect(claimReload("bbb", storage)).toBe(true);
    expect(claimReload("bbb", storage)).toBe(false);
    expect(claimReload("ccc", storage)).toBe(true);
    expect(claimReload("bbb", null)).toBe(false);
    const broken = {
      getItem: () => {
        throw new Error("bloqué");
      },
      setItem: () => {},
    };
    expect(claimReload("bbb", broken)).toBe(false);
  });
});

describe("/api/version", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("renvoie le commit déployé, sans cache", async () => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "0fc2477ac3cf");
    const { GET } = await import("../app/api/version/route.js");
    const res = GET();
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ version: "0fc2477ac3cf" });
  });

  it("renvoie une version vide en local", async () => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "");
    const { GET } = await import("../app/api/version/route.js");
    expect(await GET().json()).toEqual({ version: "" });
  });
});

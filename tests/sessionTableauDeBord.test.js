import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isLive } from "../lib/dash/session.js";

// Journaux Supabase du 15 novembre 2026 : après chaque « Invalid Refresh Token: Refresh Token Not Found », le
// tableau de bord appelait encore merry_imports_cleanup sans jeton (8 réponses 401 dans la journée). Le fournisseur
// des imports ne regardait que le mode (« live ») et pas l'état de la session : « signedout » passait pour en ligne.

describe("isLive", () => {
  it("n'est vrai qu'une fois la session confirmée et les données chargées", () => {
    expect(isLive({ status: "ready", mode: "live" })).toBe(true);
  });

  it("est faux tant que le compte n'est pas reconnu, même en mode live", () => {
    for (const status of ["loading", "signedout", "mustreset", "error"]) {
      expect(isLive({ status, mode: "live" })).toBe(false);
    }
  });

  it("est faux en démo et sans état", () => {
    expect(isLive({ status: "ready", mode: "demo" })).toBe(false);
    expect(isLive({ status: "loading", mode: null })).toBe(false);
    expect(isLive(null)).toBe(false);
    expect(isLive(undefined)).toBe(false);
  });
});

describe("fournisseur des imports", () => {
  const src = readFileSync("lib/dash/imports.js", "utf8");

  it("attend la session confirmée avant d'appeler la base (pas seulement le mode live)", () => {
    expect(src).toMatch(/const live = isLive\(dash\)/);
    expect(src).not.toMatch(/dash\.mode === "live" && !!supabase/);
  });

  it("partage le même critère que la coquille du tableau de bord", () => {
    const shell = readFileSync("components/dash/Shell.js", "utf8");
    expect(shell).toMatch(/const live = isLive\(dash\)/);
  });
});

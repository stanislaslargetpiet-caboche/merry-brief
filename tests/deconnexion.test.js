import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { signOutHere } from "../lib/supabase.js";

// Constat du 15 novembre 2026 (journaux Supabase Auth) : chaque « Se déconnecter » sur un appareil était suivi,
// sur les autres appareils du même compte, d'un « Invalid Refresh Token: Refresh Token Not Found » et d'un retour
// forcé sur /connexion. Cause : supabase.auth.signOut() révoque par défaut toutes les sessions du compte
// (scope « global »). La déconnexion ne doit fermer que la session de l'appareil où l'on clique.

function sources(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sources(p, out);
    else if (/\.jsx?$/.test(name)) out.push(p);
  }
  return out;
}

describe("signOutHere", () => {
  it("ne ferme que la session de cet appareil", async () => {
    const client = { auth: { signOut: vi.fn(async () => ({ error: null })) } };
    await signOutHere(client);
    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("ne fait rien sans client Supabase", async () => {
    await expect(signOutHere(null)).resolves.toBeUndefined();
  });

  it("aucun écran n'appelle supabase.auth.signOut() directement (il révoquerait tous les appareils)", () => {
    const direct = ["app", "components", "lib"]
      .flatMap((d) => sources(d))
      .filter((p) => p !== join("lib", "supabase.js"))
      .filter((p) => /\.auth\.signOut\(/.test(readFileSync(p, "utf8")));
    expect(direct).toEqual([]);
  });
});

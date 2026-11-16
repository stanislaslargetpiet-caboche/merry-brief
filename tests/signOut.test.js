import { beforeEach, describe, expect, it, vi } from "vitest";

// « Se déconnecter » ne doit fermer que la session de l'appareil où l'on clique. Par défaut, supabase-js
// envoie /logout?scope=global, qui révoque les jetons de tous les appareils du compte : les autres
// téléphones et ordinateurs perdent alors leur session au prochain renouvellement (« Refresh Token Not
// Found », journaux Supabase Auth du 15 novembre 2026) et retombent sur /connexion sans explication.

const signOut = vi.fn(async () => ({ error: null }));

vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ auth: { signOut } }) }));

beforeEach(() => {
  signOut.mockClear();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://exemple.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "cle-test";
  vi.resetModules();
});

describe("signOutHere", () => {
  it("ne ferme que la session de cet appareil (scope local)", async () => {
    const { signOutHere } = await import("@/lib/supabase");
    await signOutHere();
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("ne fait rien sans client Supabase (local sans .env.local)", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const { signOutHere } = await import("@/lib/supabase");
    await expect(signOutHere()).resolves.toEqual({ error: null });
    expect(signOut).not.toHaveBeenCalled();
  });
});

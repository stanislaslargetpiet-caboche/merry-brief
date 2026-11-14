import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deciderAcces, demanderAcces, pilotEmails, readAcces, statutAcces } from "@/lib/server/pilotage/acces";

// Une table pilotage_acces en mémoire, avec juste ce que lib/server/pilotage/acces.js appelle
function fakeAdmin(rows = [], { absente = false } = {}) {
  const err = absente ? { code: "42P01", message: "relation does not exist" } : null;
  const from = () => {
    const q = { filters: [], patch: null };
    const match = () => rows.filter((r) => q.filters.every(([k, v]) => r[k] === v));
    const api = {
      select: () => api,
      order: () => api,
      limit: () => api,
      eq: (k, v) => (q.filters.push([k, v]), api),
      maybeSingle: async () => {
        if (err) return { data: null, error: err };
        const hit = match()[0];
        if (hit && q.patch) Object.assign(hit, q.patch);
        return { data: hit || null, error: null };
      },
      update: (patch) => ((q.patch = patch), api),
      insert: async (row) => {
        if (err) return { error: err };
        if (rows.some((r) => r.email === row.email)) return { error: { code: "23505", message: "duplicate" } };
        rows.push({ statut: "en_attente", demande_le: new Date().toISOString(), ...row });
        return { error: null };
      },
      then: (ok) => ok(err ? { data: null, error: err } : { data: match(), error: null }),
    };
    return api;
  };
  return { from, rows };
}

describe("accès au pilotage", () => {
  const avant = process.env.PILOTAGE_EMAILS;
  beforeEach(() => {
    process.env.PILOTAGE_EMAILS = "stan@merry.test";
  });
  afterEach(() => {
    if (avant === undefined) delete process.env.PILOTAGE_EMAILS;
    else process.env.PILOTAGE_EMAILS = avant;
  });

  it("donne un accès permanent aux adresses de PILOTAGE_EMAILS", async () => {
    expect(await statutAcces(fakeAdmin(), "stan@merry.test")).toBe("permanent");
  });

  it("enregistre une seule demande par adresse", async () => {
    const admin = fakeAdmin();
    expect(await demanderAcces(admin, "a@b.fr")).toEqual({ statut: "en_attente", nouvelle: true });
    expect(await demanderAcces(admin, "a@b.fr")).toEqual({ statut: "en_attente", nouvelle: false });
    expect(admin.rows).toHaveLength(1);
  });

  it("ne redemande pas pour une adresse refusée", async () => {
    const admin = fakeAdmin([{ email: "a@b.fr", statut: "refuse" }]);
    expect(await demanderAcces(admin, "a@b.fr")).toEqual({ statut: "refuse", nouvelle: false });
  });

  it("approuve puis retire un accès", async () => {
    const admin = fakeAdmin([{ email: "a@b.fr", statut: "en_attente" }]);
    expect(await deciderAcces(admin, "a@b.fr", "approuver", "stan@merry.test")).toEqual({ ok: true, statut: "approuve" });
    expect(await statutAcces(admin, "a@b.fr")).toBe("approuve");
    expect([...(await pilotEmails(admin))]).toEqual(["stan@merry.test", "a@b.fr"]);
    await deciderAcces(admin, "a@b.fr", "retirer", "stan@merry.test");
    expect(await statutAcces(admin, "a@b.fr")).toBe("refuse");
  });

  it("refuse de toucher à un accès permanent ou à une adresse inconnue", async () => {
    const admin = fakeAdmin();
    expect(await deciderAcces(admin, "stan@merry.test", "retirer", "x")).toEqual({ error: "permanent" });
    expect(await deciderAcces(admin, "x@y.fr", "approuver", "x")).toEqual({ error: "introuvable" });
    expect(await deciderAcces(admin, "x@y.fr", "n'importe", "x")).toEqual({ error: "invalide" });
  });

  it("tant que la table manque, garde les accès permanents seuls", async () => {
    const admin = fakeAdmin([], { absente: true });
    expect(await statutAcces(admin, "a@b.fr")).toBe(null);
    expect(await statutAcces(admin, "stan@merry.test")).toBe("permanent");
    expect(await demanderAcces(admin, "a@b.fr")).toEqual({ error: "indisponible" });
    expect((await readAcces(admin)).disponible).toBe(false);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

let sent;
let rowsByTable;
let mailSentKeys;

function chainFor(table) {
  if (table === "mail_sent") {
    return {
      insert: async ({ key }) => {
        if (mailSentKeys.has(key)) return { error: { code: "23505" } };
        mailSentKeys.add(key);
        return {};
      },
      delete: () => ({ eq: async () => {} }),
    };
  }
  const row = rowsByTable[table];
  const chain = {
    select: (sel, opts) => (opts?.count === "exact" ? { eq: async () => ({ count: row?.count ?? 0 }) } : chain),
    eq: () => chain,
    order: () => chain,
    limit: async () => ({ data: row || [] }),
    maybeSingle: async () => ({ data: row }),
  };
  return chain;
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1", email: "leo@gmail.com" } } }) },
    from: chainFor,
    schema: () => ({ from: chainFor }),
    rpc: async () => ({ data: true }),
  }),
}));

beforeEach(() => {
  Object.assign(process.env, { RESEND_API_KEY: "k", NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "a", SUPABASE_SERVICE_ROLE_KEY: "s" });
  sent = [];
  mailSentKeys = new Set();
  rowsByTable = {};
  vi.stubGlobal("fetch", async (_url, init) => {
    sent.push(JSON.parse(init.body));
    return new Response("{}", { status: 200 });
  });
});

const call = (path, body) => (mod) => mod.POST(new Request(`https://app.withmerry.com${path}`, { method: "POST", headers: { authorization: "Bearer t" }, body: JSON.stringify(body) }));

describe("notifier-couple-demandes (V55)", () => {
  it("confirme au compte qui vient d'envoyer, pour chaque prestataire", async () => {
    const mod = await import("../app/api/prestataires/notifier-couple-demandes/route.js");
    await call("/api/prestataires/notifier-couple-demandes", { names: ["Le Mas", "Les Oliviers"] })(mod);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toEqual(["leo@gmail.com"]);
    expect(sent[0].subject).toBe("Tes 2 demandes sont parties");
  });
});

describe("formulaire/partage (V60)", () => {
  it("confirme que le formulaire est en ligne", async () => {
    const mod = await import("../app/api/formulaire/partage/route.js");
    await call("/api/formulaire/partage", {})(mod);
    expect(sent[0].to).toEqual(["leo@gmail.com"]);
    expect(sent[0].subject).toBe("Ton formulaire est en ligne");
  });
});

describe("formulaire/apres-import (V59)", () => {
  it("part quand le formulaire n'a jamais été partagé", async () => {
    rowsByTable.guest_forms = { shared_at: null };
    rowsByTable.guests = { count: 42 };
    const mod = await import("../app/api/formulaire/apres-import/route.js");
    await call("/api/formulaire/apres-import", { weddingId: "w1", duplicates: 3 })(mod);
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toBe("42 invités dans ta liste");
  });

  it("ne part pas une deuxième fois pour le même mariage", async () => {
    rowsByTable.guest_forms = { shared_at: null };
    rowsByTable.guests = { count: 10 };
    const mod = await import("../app/api/formulaire/apres-import/route.js");
    await call("/api/formulaire/apres-import", { weddingId: "w1", duplicates: 0 })(mod);
    await call("/api/formulaire/apres-import", { weddingId: "w1", duplicates: 0 })(mod);
    expect(sent).toHaveLength(1);
  });

  it("ne part plus une fois le formulaire partagé", async () => {
    rowsByTable.guest_forms = { shared_at: "2026-11-12T10:00:00Z" };
    rowsByTable.guests = { count: 42 };
    const mod = await import("../app/api/formulaire/apres-import/route.js");
    const res = await call("/api/formulaire/apres-import", { weddingId: "w1", duplicates: 0 })(mod);
    expect(await res.json()).toEqual({ ok: true, skipped: "deja_partage" });
    expect(sent).toEqual([]);
  });
});

describe("mariage/lieu-signe (V64)", () => {
  it("suggère des traiteurs de la même région", async () => {
    rowsByTable.weddings = { region: "Luberon" };
    rowsByTable.vendors = [{ name: "Maison Ravel", city: "Apt" }];
    const mod = await import("../app/api/mariage/lieu-signe/route.js");
    await call("/api/mariage/lieu-signe", { weddingId: "w1", lieuName: "Le Mas de la Source" })(mod);
    expect(sent[0].subject).toBe("Le lieu est réservé");
    expect(sent[0].html).toContain("Maison Ravel");
  });
});

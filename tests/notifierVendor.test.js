import { beforeEach, describe, expect, it, vi } from "vitest";

const catalogId = "11111111-1111-4111-8111-111111111111";
const rows = {
  vendors: { id: "v1", name: "Le Mas", email: "contact@lemas.fr", wedding_id: "w1" },
  weddings: { partner1: "Léo", partner2: "Léa" },
  vendor_picks: { catalog_ref: `catalog:${catalogId}` },
};
let members;
let optouts = [];

function table(name) {
  const chain = { select: () => chain, eq: () => chain, in: async () => ({ data: optouts }), maybeSingle: async () => ({ data: rows[name] }) };
  return chain;
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: table,
    rpc: async (name) => (name === "merry_rate" ? { data: true } : members),
  }),
}));

const { POST } = await import("../app/api/prestataires/notifier-vendor/route.js");
const { readUnsubLink } = await import("../lib/server/mailOptouts.js");

function call(body) {
  return POST(new Request("https://app.withmerry.com/api/prestataires/notifier-vendor", { method: "POST", headers: { authorization: "Bearer t" }, body: JSON.stringify({ vendorId: "v1", ...body }) }));
}

describe("notifier-vendor", () => {
  let sent;

  beforeEach(() => {
    Object.assign(process.env, { RESEND_API_KEY: "k", NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "a", SUPABASE_SERVICE_ROLE_KEY: "s" });
    sent = [];
    optouts = [];
    vi.stubGlobal("fetch", async (_url, init) => {
      sent.push(JSON.parse(init.body));
      return new Response("{}", { status: 200 });
    });
  });

  it("prévient l'adresse de la fiche et chaque compte, une seule fois par adresse", async () => {
    members = { data: [{ to_email: "CONTACT@lemas.fr" }, { to_email: "camille@lemas.fr" }] };
    const res = await call({ message: "Bonjour" });
    expect(await res.json()).toEqual({ ok: true, sent: 2 });
    expect(sent.map((m) => m.to[0]).sort()).toEqual(["camille@lemas.fr", "contact@lemas.fr"]);
    for (const m of sent) expect(m.text).toContain(`/pro?fiche=${catalogId}&connexion=1`);
  });

  it("n'écrit pas aux adresses désinscrites, et le lien du mail désinscrit la bonne adresse", async () => {
    members = { data: [{ to_email: "camille@lemas.fr" }] };
    optouts = [{ email: "contact@lemas.fr" }];
    const res = await call({ message: "Bonjour" });
    expect(await res.json()).toEqual({ ok: true, sent: 1 });
    expect(sent[0].to).toEqual(["camille@lemas.fr"]);
    const href = /href="([^"]*desinscription[^"]*)"/.exec(sent[0].html)[1].replace(/&amp;/g, "&");
    const link = new URL(href);
    expect(readUnsubLink(link.searchParams.get("e"), link.searchParams.get("t"))).toBe("camille@lemas.fr");
  });

  it("ne dit pas d'erreur quand toutes les adresses sont désinscrites", async () => {
    members = { data: [] };
    optouts = [{ email: "contact@lemas.fr" }];
    expect(await (await call({ message: "Bonjour" })).json()).toEqual({ ok: true, sent: 0 });
    expect(sent).toEqual([]);
  });

  it("donne à chaque envoi un identifiant unique, pour que Gmail ne replie pas le bouton", async () => {
    members = { data: [{ to_email: "camille@lemas.fr" }] };
    await call({ message: "Bonjour" });
    const ids = sent.map((m) => m.headers["X-Entity-Ref-ID"]);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(sent.length);
  });

  it("retombe sur l'adresse de la fiche sans la fonction SQL", async () => {
    members = { data: null, error: { message: "absente" } };
    await call({ message: "Bonjour" });
    expect(sent.map((m) => m.to[0])).toEqual(["contact@lemas.fr"]);
    expect(sent[0].text).toContain(`/pro?fiche=${catalogId}`);
    expect(sent[0].text).not.toContain("connexion=1");
  });

  it("garde les dates alternatives et le caractère flexible", async () => {
    members = { data: [] };
    await call({ message: "Bonjour", dates: ["14 juin 2027", "21 juin 2027", "28 juin 2027"] });
    expect(sent[0].text).toContain("Autres dates possibles : 21 juin 2027, 28 juin 2027");
    expect(sent[0].html).toContain("Autres dates possibles : 21 juin 2027, 28 juin 2027");
    sent.length = 0;
    await call({ message: "Bonjour", dates: ["Dates flexibles : juin ou juillet 2027"] });
    expect(sent[0].html).toContain(">Dates flexibles</div>");
    expect(sent[0].html).toContain(">juin ou juillet 2027</div>");
  });
});

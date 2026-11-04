import { beforeEach, describe, expect, it, vi } from "vitest";

let details;
let recipients;

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: () => {
      const chain = { select: () => chain, eq: () => chain, in: async () => ({ data: [] }), maybeSingle: async () => ({ data: { id: "c1", vendor_id: "v1" } }) };
      return chain;
    },
    rpc: async (name) => {
      if (name === "pro_notify_couple_payload") return { data: recipients };
      if (name === "pro_notify_couple_details") return details;
      return { data: true };
    },
  }),
}));

const { POST } = await import("../app/api/prestataires/notifier-couple/route.js");

const call = () => POST(new Request("https://app.withmerry.com/api/prestataires/notifier-couple", { method: "POST", headers: { authorization: "Bearer t" }, body: JSON.stringify({ clientId: "c1" }) }));

describe("notifier-couple", () => {
  let sent;

  beforeEach(() => {
    Object.assign(process.env, { RESEND_API_KEY: "k", NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "a", SUPABASE_SERVICE_ROLE_KEY: "s" });
    recipients = [{ to_email: "leo@gmail.com", vendor_name: "Le Mas" }];
    sent = [];
    vi.stubGlobal("fetch", async (_url, init) => {
      sent.push(JSON.parse(init.body));
      return new Response("{}", { status: 200 });
    });
  });

  it("montre l'aperçu, la catégorie et la zone, en échappant le message", async () => {
    details = { data: [{ last_message: "Le 14 juin <b>est</b> libre", category: "Lieu de réception", area: "Luberon" }] };
    await call();
    expect(sent[0].html).toContain("Le 14 juin &lt;b&gt;est&lt;/b&gt; libre");
    expect(sent[0].html).toContain("Lieu de réception");
    expect(sent[0].html).toContain("Luberon");
    expect(sent[0].text).toContain("« Le 14 juin <b>est</b> libre »");
  });

  it("coupe un long message", async () => {
    details = { data: [{ last_message: "a".repeat(400) }] };
    await call();
    expect(sent[0].text).toContain(`${"a".repeat(280)}…`);
    expect(sent[0].text).not.toContain("a".repeat(281));
  });

  it("part quand même sans la fonction SQL", async () => {
    details = { data: null, error: { message: "absente" } };
    expect(await (await call()).json()).toEqual({ ok: true, sent: 1 });
    expect(sent[0].html).toContain("Le Mas t'a répondu.");
  });
});

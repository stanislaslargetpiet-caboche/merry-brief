import { beforeEach, describe, expect, it, vi } from "vitest";
import { quickReplyLink } from "../lib/server/reponseRapide.js";

let inserted;

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table) => {
      if (table === "pro_clients") return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { pick_id: "p1", vendor_id: "v1" } }) }) }) };
      if (table === "vendor_picks") return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { wedding_id: "w1" } }) }) }) };
      if (table === "vendor_messages") return { insert: async (row) => (inserted.push(row), {}) };
      return {};
    },
  }),
}));

const { GET } = await import("../app/api/prestataires/reponse-rapide/route.js");
const req = (qs) => GET(new Request(`https://app.withmerry.com/api/prestataires/reponse-rapide?${qs}`));

describe("GET /api/prestataires/reponse-rapide", () => {
  beforeEach(() => {
    Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "s" });
    inserted = [];
  });

  it("enregistre la réponse choisie et renvoie vers la messagerie", async () => {
    const url = new URL(quickReplyLink("https://app.withmerry.com", "c1", "interesse"));
    const res = await req(url.search.slice(1));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://app.withmerry.com/dashboard/prestataires/messagerie");
    expect(inserted).toEqual([expect.objectContaining({ wedding_id: "w1", vendor_id: "v1", from_vendor: false, body: "Ça m'intéresse, merci pour votre réponse !" })]);
  });

  it("n'enregistre rien et renvoie quand même, pour un lien signé faux", async () => {
    const res = await req("c=c1&r=interesse&t=faux");
    expect(res.status).toBe(302);
    expect(inserted).toEqual([]);
  });
});

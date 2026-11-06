import { beforeEach, describe, expect, it, vi } from "vitest";
import { readUnsubLink, unsubLink } from "../lib/server/mailOptouts.js";
import { issueState, sendIssue, sendTest } from "../lib/server/nouveautes.js";
import { latestIssue, nouveautesMail } from "../lib/server/nouveautesMail.js";

const ORIGIN = "https://app.withmerry.com";
const issue = latestIssue();

function fakeAdmin({ emails = [], optouts = [], sent = [], failOptouts = false } = {}) {
  const sentKeys = new Set(sent);
  return {
    sentKeys,
    rpc: async () => ({ data: emails }),
    from: (table) => {
      if (table === "weddings") return { select: async () => ({ data: [{ id: "w1" }] }) };
      if (table === "mail_optouts") {
        const chain = {
          select: () => chain,
          eq: () => chain,
          in: async () => (failOptouts ? { error: { message: "panne" } } : { data: optouts.map((email) => ({ email })) }),
        };
        return chain;
      }
      return {
        select: () => ({ in: async (_c, keys) => ({ data: keys.filter((k) => sentKeys.has(k)).map((key) => ({ key })) }) }),
        insert: async ({ key }) => {
          if (sentKeys.has(key)) return { error: { code: "23505", message: "doublon" } };
          sentKeys.add(key);
          return {};
        },
        delete: () => ({ eq: async (_c, key) => sentKeys.delete(key) }),
      };
    },
  };
}

describe("mail du samedi", () => {
  let sent;
  let status;

  beforeEach(() => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "s";
    process.env.RESEND_API_KEY = "k";
    sent = [];
    status = 200;
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", async (_u, init) => {
      sent.push(JSON.parse(init.body));
      return new Response("{}", { status });
    });
  });

  it("met le lien de désinscription et le texte du mail dans les deux versions", () => {
    const { subject, html, text } = nouveautesMail({ issue, origin: ORIGIN, unsub: "https://x/d?e=1&t=2" });
    expect(subject).toBe("Du nouveau sur Merry");
    expect(html).toContain("https://x/d?e=1&amp;t=2");
    expect(html).toContain(`${ORIGIN}/mail/nouveautes/${issue.image}`);
    expect(html).toContain(`${ORIGIN}${issue.lien}`);
    expect(text).toContain("https://x/d?e=1&t=2");
    expect(text).toContain(issue.promesse);
  });

  it("signe le lien pour les nouveautés seulement", () => {
    const url = new URL(unsubLink(ORIGIN, "Emma@Gmail.com", "nouveautes"));
    const [e, t] = [url.searchParams.get("e"), url.searchParams.get("t")];
    expect(url.searchParams.get("k")).toBe("nouveautes");
    expect(readUnsubLink(e, t, "nouveautes")).toBe("emma@gmail.com");
    expect(readUnsubLink(e, t)).toBeNull();
    const plain = new URL(unsubLink(ORIGIN, "emma@gmail.com"));
    expect(readUnsubLink(plain.searchParams.get("e"), plain.searchParams.get("t"), "nouveautes")).toBeNull();
  });

  it("écarte les désinscrits et les comptes de test, et compte ce qui est parti", async () => {
    const admin = fakeAdmin({
      emails: ["emma@gmail.com", "leo@gmail.com", "zoe@gmail.com", "test.mariage@gmail.com", "stan@withmerry.com"],
      optouts: ["leo@gmail.com"],
      sent: [`nouveautes:${issue.numero}:zoe@gmail.com`],
    });
    const state = await issueState(admin, issue, ORIGIN);
    expect(state.restants).toEqual(["emma@gmail.com"]);
    expect(state.exclus).toEqual(["stan@withmerry.com", "test.mariage@gmail.com"]);
    expect(state.desinscrits).toBe(1);
    expect(state.deja).toBe(1);
  });

  it("n'envoie rien si les désinscriptions sont illisibles", async () => {
    await expect(sendIssue(fakeAdmin({ emails: ["emma@gmail.com"], failOptouts: true }), issue, ORIGIN, 1)).rejects.toThrow("mail_optouts");
    expect(sent).toEqual([]);
  });

  it("n'envoie rien si la liste a changé depuis le clic", async () => {
    const res = await sendIssue(fakeAdmin({ emails: ["emma@gmail.com"] }), issue, ORIGIN, 2);
    expect(res).toEqual({ error: "liste_changee", restants: 1 });
    expect(sent).toEqual([]);
  });

  it("envoie une fois, avec le lien signé, et ne renvoie pas au second clic", async () => {
    const admin = fakeAdmin({ emails: ["emma@gmail.com"] });
    expect(await sendIssue(admin, issue, ORIGIN, 1)).toEqual({ envoyes: 1, echecs: 0 });
    expect(sent[0].to).toEqual(["emma@gmail.com"]);
    expect(sent[0].subject).toBe("Du nouveau sur Merry");
    expect(sent[0].from).toMatch(/^Merry </);
    expect(sent[0].headers["List-Unsubscribe"]).toContain("k=nouveautes");
    expect(await sendIssue(admin, issue, ORIGIN, 0)).toEqual({ envoyes: 0, echecs: 0 });
    expect(sent).toHaveLength(1);
  });

  it("rend la clé d'un envoi raté pour le reprendre au clic suivant", async () => {
    status = 422;
    const admin = fakeAdmin({ emails: ["emma@gmail.com"] });
    expect(await sendIssue(admin, issue, ORIGIN, 1)).toEqual({ envoyes: 0, echecs: 1 });
    expect(admin.sentKeys.size).toBe(0);
  });

  it("le test ne réserve aucune clé", async () => {
    expect(await sendTest(issue, ORIGIN, "stan@gmail.com")).toBe(true);
    expect(sent[0].to).toEqual(["stan@gmail.com"]);
  });
});

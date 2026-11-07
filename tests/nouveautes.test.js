import { existsSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readUnsubLink, unsubLink } from "../lib/server/mailOptouts.js";
import { departAt, INCLUS, issueState, sendIssue, sendTest } from "../lib/server/nouveautes.js";
import { latestIssue, NOUVEAUTES, nouveautesMail } from "../lib/server/nouveautesMail.js";

const ORIGIN = "https://app.withmerry.com";
const issue = NOUVEAUTES[0];

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
    expect(text).toContain(`${ORIGIN}${issue.lien}?utm_source=mail&utm_medium=email&utm_campaign=samedi-${issue.numero}`);
    expect(html).toContain(`${ORIGIN}${issue.lien}?utm_source=mail&amp;utm_medium=email&amp;utm_campaign=samedi-${issue.numero}`);
    expect(text).toContain("https://x/d?e=1&t=2");
    expect(text).toContain(issue.promesse);
  });

  it("propose le dernier numéro, avec son image, à 8 h le samedi suivant", () => {
    const dernier = latestIssue();
    expect(dernier.numero).toBe(NOUVEAUTES.length);
    expect(existsSync(`public/mail/nouveautes/${dernier.image}`)).toBe(true);
    expect(departAt(dernier, new Date("2026-11-06T20:00:00Z")).toISOString()).toBe("2026-11-14T07:00:00.000Z");
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
    expect(state.restants).toEqual(["emma@gmail.com", ...INCLUS]);
    expect(state.exclus).toEqual(["stan@withmerry.com", "test.mariage@gmail.com"]);
    expect(state.desinscrits).toBe(1);
    expect(state.deja).toBe(1);
  });

  it("n'envoie rien si les désinscriptions sont illisibles", async () => {
    await expect(sendIssue(fakeAdmin({ emails: ["emma@gmail.com"], failOptouts: true }), issue, ORIGIN, 2)).rejects.toThrow("mail_optouts");
    expect(sent).toEqual([]);
  });

  it("n'envoie rien si la liste a changé depuis le clic", async () => {
    const res = await sendIssue(fakeAdmin({ emails: ["emma@gmail.com"] }), issue, ORIGIN, 5);
    expect(res).toEqual({ error: "liste_changee", restants: 1 + INCLUS.length });
    expect(sent).toEqual([]);
  });

  it("envoie une fois, avec le lien signé, et ne renvoie pas au second clic", async () => {
    const admin = fakeAdmin({ emails: ["emma@gmail.com"] });
    const after = new Date("2026-11-08T09:00:00Z"); // l'heure d'envoi est passée : le mail part tout de suite
    expect(await sendIssue(admin, issue, ORIGIN, 1 + INCLUS.length, after)).toEqual({ envoyes: 1 + INCLUS.length, echecs: 0, depart: null });
    expect(sent[0].to).toEqual(["emma@gmail.com"]);
    expect(sent[0].scheduled_at).toBeUndefined();
    expect(sent[0].subject).toBe("Du nouveau sur Merry");
    expect(sent[0].from).toMatch(/^Merry </);
    expect(sent[0].headers["List-Unsubscribe"]).toContain("k=nouveautes");
    expect(await sendIssue(admin, issue, ORIGIN, 0, after)).toEqual({ envoyes: 0, echecs: 0, depart: null });
    expect(sent).toHaveLength(1 + INCLUS.length);
  });

  it("rend la clé d'un envoi raté pour le reprendre au clic suivant", async () => {
    status = 422;
    const admin = fakeAdmin({ emails: ["emma@gmail.com"] });
    expect(await sendIssue(admin, issue, ORIGIN, 1 + INCLUS.length, new Date("2026-11-08T09:00:00Z"))).toEqual({ envoyes: 0, echecs: 1 + INCLUS.length, depart: null });
    expect(admin.sentKeys.size).toBe(0);
  });

  it("programme à 8 h, heure de Paris, le jour du samedi (UTC+1 en novembre)", () => {
    expect(departAt(issue, new Date("2026-11-06T20:00:00Z")).toISOString()).toBe("2026-11-07T07:00:00.000Z");
    expect(departAt(issue, new Date("2026-11-07T06:59:30Z"))).toBeNull();
    expect(departAt(issue, new Date("2026-11-07T08:00:00Z"))).toBeNull();
  });

  it("programme chaque mail chez Resend et y inclut Stan malgré le filtre des comptes de test", async () => {
    const admin = fakeAdmin({ emails: ["emma@gmail.com"] });
    const res = await sendIssue(admin, issue, ORIGIN, 1 + INCLUS.length, new Date("2026-11-06T20:00:00Z"));
    expect(res).toEqual({ envoyes: 1 + INCLUS.length, echecs: 0, depart: "2026-11-07T07:00:00.000Z" });
    expect(sent.map((m) => m.scheduled_at)).toEqual(Array(1 + INCLUS.length).fill("2026-11-07T07:00:00.000Z"));
    expect(sent.map((m) => m.to[0])).toEqual(["emma@gmail.com", ...INCLUS]);
  });

  it("n'inclut pas Stan s'il s'est désinscrit", async () => {
    const state = await issueState(fakeAdmin({ emails: ["emma@gmail.com"], optouts: INCLUS }), issue, ORIGIN);
    expect(state.restants).toEqual(["emma@gmail.com"]);
  });

  it("le test ne réserve aucune clé", async () => {
    expect(await sendTest(issue, ORIGIN, "stan@gmail.com")).toBe(true);
    expect(sent[0].to).toEqual(["stan@gmail.com"]);
  });
});

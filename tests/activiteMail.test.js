import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildActivite, windowEnd, windowStart } from "../lib/server/activiteMail.js";
import { runActivite } from "../lib/server/activiteJob.js";

const ctx = { origin: "https://app.withmerry.com", unsub: "https://app.withmerry.com/desinscription?x", link: "https://app.withmerry.com/dashboard" };

describe("windowEnd", () => {
  it("vise 20 h à Paris, en hiver comme en été", () => {
    expect(windowEnd(new Date("2026-11-09T19:30:00Z")).toISOString()).toBe("2026-11-09T19:00:00.000Z");
    expect(windowEnd(new Date("2026-07-09T18:30:00Z")).toISOString()).toBe("2026-07-09T18:00:00.000Z");
  });
  it("couvre exactement 24 h", () => {
    const end = windowEnd(new Date("2026-11-09T19:30:00Z"));
    expect(end - windowStart(end)).toBe(24 * 3600 * 1000);
  });
});

describe("buildActivite", () => {
  it("ne renvoie rien sans activité", () => {
    expect(buildActivite({ activity: { reponses: [], ajouts: [], ajoutsParEquipe: [], prestataires: [], messages: [] }, ...ctx })).toBeNull();
  });

  it("construit les trois blocs et l'aperçu", () => {
    const mail = buildActivite({
      activity: {
        reponses: [{ name: "Léa Martin", comes: true }, { name: "Paul Dupuis", comes: false }],
        ajouts: [{ name: "Inès Garnier" }],
        ajoutsParEquipe: [{ count: 3 }, { count: 2 }],
        prestataires: [{ name: "Studio Aube" }],
        messages: [{ name: "Domaine des Lilas", count: 2 }],
      },
      firstName: "Camille",
      ...ctx,
    });
    expect(mail.subject).toBe("Nouvelle activité sur ton compte Merry");
    expect(mail.preheader).toBe("2 réponses d'invités, 6 invités ajoutés, 1 réponse de prestataire, 2 messages");
    for (const s of ["Bonjour Camille,", "Invités", "Prestataires", "Messages", "VIENT", "NE VIENT PAS", "AJOUTÉ", "5 invités ajoutés aujourd&#39;hui par les organisateurs", "Studio Aube", "Domaine des Lilas", "Aller sur Merry"]) expect(mail.body).toContain(s);
    expect(mail.text).toContain("5 invités ajoutés aujourd'hui par les organisateurs");
    expect(mail.body).not.toContain("Julien");
  });

  it("plafonne chaque bloc à 4 lignes", () => {
    const reponses = Array.from({ length: 7 }, (_, i) => ({ name: `Invité ${i}`, comes: true }));
    const mail = buildActivite({ activity: { reponses }, ...ctx });
    expect(mail.body).toContain("Invité 3");
    expect(mail.body).not.toContain("Invité 4");
    expect(mail.body).toContain("et 3 autres lignes, à voir sur Merry");
  });

  it("échappe les noms", () => {
    const mail = buildActivite({ activity: { prestataires: [{ name: "<b>x</b>" }] }, ...ctx });
    expect(mail.body).not.toContain("<b>x</b>");
  });
});

function fakeAdmin(tables, { optouts = [] } = {}) {
  const sentKeys = new Set();
  const from = (table) => {
    if (table === "mail_sent") {
      return {
        insert: async ({ key }) => {
          if (sentKeys.has(key)) return { error: { code: "23505", message: "doublon" } };
          sentKeys.add(key);
          return {};
        },
        delete: () => ({ eq: async (_c, key) => sentKeys.delete(key) }),
      };
    }
    const rows = table === "mail_optouts" ? optouts.map((email) => ({ email })) : tables[table] || [];
    const chain = { select: () => chain, eq: () => chain, in: () => chain, gte: () => chain, lt: () => chain, not: () => chain, order: () => chain, then: (ok) => ok({ data: rows }) };
    return chain;
  };
  return { from, sentKeys, auth: { admin: { getUserById: async () => ({ data: { user: { email: "camille@gmail.com" } } }) } } };
}

describe("runActivite", () => {
  let mails;
  beforeEach(() => {
    mails = [];
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service");
    vi.stubGlobal("fetch", async (_url, init) => {
      mails.push(JSON.parse(init.body));
      return { ok: true };
    });
  });

  const tables = {
    guest_response_log: [{ wedding_id: "w1", guest_id: "g1", status: "oui" }],
    guest_activity: [
      { wedding_id: "w1", guest_id: "g2", guest_name: "inès garnier", source: "formulaire", member_id: null },
      { wedding_id: "w1", guest_id: "g3", guest_name: "Paul", source: "organisateur", member_id: "m1" },
    ],
    vendor_messages: [],
    guests: [{ id: "g1", wedding_id: "w1", first_name: "léa", last_name: "Martin" }],
    wedding_members: [{ id: "m1", wedding_id: "w1", user_id: "u1", email: "", display_name: "Camille" }],
  };
  const now = new Date("2026-11-09T19:10:00Z");

  it("envoie un mail, une seule fois, sans compter ses propres ajouts", async () => {
    const admin = fakeAdmin(tables);
    const first = await runActivite(admin, "https://app.withmerry.com", now);
    expect(first.envoyes).toBe(1);
    expect(mails).toHaveLength(1);
    expect(mails[0].to).toEqual(["camille@gmail.com"]);
    expect(mails[0].html).toContain("Léa Martin");
    expect(mails[0].html).toContain("Inès Garnier");
    expect(mails[0].html).not.toContain("a ajouté");
    expect(mails[0].html).not.toContain("par un organisateur");
    expect((await runActivite(admin, "https://app.withmerry.com", now)).envoyes).toBe(0);
    expect(mails).toHaveLength(1);
  });

  it("n'envoie rien sans activité", async () => {
    const report = await runActivite(fakeAdmin({}), "https://app.withmerry.com", now);
    expect(report.envoyes).toBe(0);
    expect(mails).toHaveLength(0);
  });

  it("respecte la désinscription", async () => {
    const report = await runActivite(fakeAdmin(tables, { optouts: ["camille@gmail.com"] }), "https://app.withmerry.com", now);
    expect(report.envoyes).toBe(0);
    expect(report.ignores).toBe(1);
  });

  it("ne réserve rien et n'envoie rien en simulation", async () => {
    const admin = fakeAdmin(tables);
    const report = await runActivite(admin, "https://app.withmerry.com", now, { dry: true });
    expect(report.envoyes).toBe(1);
    expect(mails).toHaveLength(0);
    expect(admin.sentKeys.size).toBe(0);
  });
});

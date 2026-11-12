import { beforeEach, describe, expect, it, vi } from "vitest";
import { runMailJobs } from "../lib/server/mailJobs.js";

const inDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

function fakeAdmin(rows = {}, { optouts = [] } = {}) {
  const sentKeys = new Set();
  return {
    sentKeys,
    rpc: async (name) => {
      if (name in rows) return rows[name] instanceof Error ? { error: { message: rows[name].message } } : { data: rows[name] };
      if (name === "merry_job_release_options") return { data: 0 };
      if (name === "merry_job_wedding_emails") return { data: ["leo@gmail.com"] };
      if (name === "pro_notify_vendor_members") return { data: [] };
      return { data: [] };
    },
    from: (table) => {
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
      const chain = { select: () => chain, eq: () => chain, in: async () => ({ data: optouts.map((email) => ({ email })) }) };
      return chain;
    },
  };
}

const demande = { pick_id: "p1", catalog_id: "11111111-1111-4111-8111-111111111111", vendor_email: "contact@lemas.fr", partner1: "emma", partner2: "lucas" };

describe("runMailJobs", () => {
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

  it("relance une demande une seule fois, avec les prénoms et un lien de désinscription", async () => {
    const admin = fakeAdmin({ merry_job_demandes: [demande] });
    await runMailJobs(admin, "https://app.withmerry.com");
    await runMailJobs(admin, "https://app.withmerry.com");
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toBe("Emma et Lucas attendent ta réponse");
    expect(sent[0].html).toContain("/desinscription?");
  });

  it("n'écrit pas à une adresse désinscrite", async () => {
    await runMailJobs(fakeAdmin({ merry_job_demandes: [demande] }, { optouts: ["contact@lemas.fr"] }), "https://app.withmerry.com");
    expect(sent).toEqual([]);
  });

  it("rend la clé d'un envoi raté, pour que le mail reparte", async () => {
    status = 422;
    const admin = fakeAdmin({ merry_job_demandes: [demande] });
    await runMailJobs(admin, "https://app.withmerry.com");
    expect(admin.sentKeys.size).toBe(0);
  });

  it("annonce une option et la date en clair", async () => {
    await runMailJobs(fakeAdmin({ merry_job_options: [{ date_id: "d1", vendor_id: "v1", day: "2027-06-14", expires_on: inDays(1), names: "Emma et Lucas", emails: ["a@b.fr"] }] }), "https://x.fr");
    expect(sent[0].subject).toBe("Ton option du 14 juin expire demain");
  });

  it("parle de crédits, y compris à zéro", async () => {
    await runMailJobs(fakeAdmin({ merry_job_credits: [{ vendor_id: "v1", credits: 0, cost: 25, emails: ["a@b.fr"] }] }), "https://x.fr");
    expect(sent[0].subject).toBe("Tu n'as plus de crédits");
    expect(sent[0].text).toContain("25 crédits");
    expect(sent[0].text).not.toContain("€");
  });

  it("n'envoie plus les réponses au formulaire, le mail de 20 h les donne (D-295)", async () => {
    const report = await runMailJobs(fakeAdmin({ merry_job_formulaire: [{ wedding_id: "w1", first_name: "Camille", last_name: "Martin", comes: true }] }), "https://x.fr");
    expect(sent).toHaveLength(0);
    expect(report).not.toHaveProperty("formulaire");
  });

  it("relance une invitation au nom du couple", async () => {
    await runMailJobs(fakeAdmin({ merry_job_invitations: [{ member_id: "m1", email: "A@b.fr", invite_token: "t", partner1: "Léo", partner2: "Léa" }] }), "https://x.fr");
    expect(sent[0].to).toEqual(["a@b.fr"]);
    expect(sent[0].subject).toBe("Léo et Léa t'attendent sur Merry");
    expect(sent[0].text).toContain("/connexion?invitation=t");
  });

  it("relance le couple quand un prestataire a répondu sans suite (V57)", async () => {
    const row = { wedding_id: "w1", vendor_id: "v1", vendor_name: "Le Mas de la Source", partner1: "Léa", partner2: "Thomas", emails: ["leo@gmail.com"] };
    const admin = fakeAdmin({ merry_job_demandes_couple: [row] });
    await runMailJobs(admin, "https://app.withmerry.com");
    await runMailJobs(admin, "https://app.withmerry.com");
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toBe("Le Mas de la Source attend ta réponse");
    expect(sent[0].to).toEqual(["leo@gmail.com"]);
  });

  it("n'écrit pas au couple désinscrit des réponses prestataires (V57)", async () => {
    const row = { wedding_id: "w1", vendor_id: "v1", vendor_name: "Le Mas", emails: ["leo@gmail.com"] };
    await runMailJobs(fakeAdmin({ merry_job_demandes_couple: [row] }, { optouts: ["leo@gmail.com"] }), "https://x.fr");
    expect(sent).toEqual([]);
  });

  it("continue quand un type de mail échoue", async () => {
    const report = await runMailJobs(fakeAdmin({ merry_job_demandes: new Error("absente"), merry_job_credits: [{ vendor_id: "v1", credits: 2, cost: 8, emails: ["a@b.fr"] }] }), "https://x.fr");
    expect(report.demandes).toBe("erreur");
    expect(report.credits).toBe(1);
  });
});

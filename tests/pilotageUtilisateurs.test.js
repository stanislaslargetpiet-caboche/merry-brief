import { describe, expect, it } from "vitest";
import { buildUtilisateurs } from "@/lib/server/pilotage/utilisateurs";
import { fmtAgo } from "@/lib/server/pilotage/shape";

const NOW = Date.parse("2026-11-06T12:00:00Z");
const min = (n) => new Date(NOW - n * 60000).toISOString();

const raw = {
  users: [
    { id: "u1", email: "emma@x.fr", created_at: min(60 * 24 * 10), last_sign_in_at: min(12) },
    { id: "u2", email: "theo@x.fr", created_at: min(30), last_sign_in_at: min(30) },
    { id: "u3", email: "vieux@x.fr", created_at: min(60 * 24 * 40), last_sign_in_at: min(60 * 24 * 3) },
    { id: "u4", email: "jamais@x.fr", created_at: min(60 * 24 * 2), last_sign_in_at: null },
  ],
  weddings: [
    { id: "w1", created_at: min(60 * 24 * 10), created_by: "u1", partner1: "Emma", partner2: "Lucas" },
    { id: "w2", created_at: min(30), created_by: "u2", partner1: "Théo", partner2: null },
  ],
  members: [{ wedding_id: "w1", user_id: "u1" }, { wedding_id: "w1", user_id: null }],
  sites: [{ wedding_id: "w1", slug: "emma-lucas", published: true, created_at: min(50) }],
  forms: [],
  guests: [{ wedding_id: "w1", created_at: min(10) }, { wedding_id: "w1", created_at: min(500) }],
  tasks: [{ wedding_id: "w1", done: true }, { wedding_id: "w1", done: false }],
  budget: [],
  requests: [{ wedding_id: "w1", created_at: min(90) }],
};

describe("buildUtilisateurs", () => {
  const out = buildUtilisateurs(raw, 60 * 60000, NOW);

  it("classe les utilisateurs par dernière connexion, les jamais connectés en dernier", () => {
    expect(out.utilisateurs.map((u) => u.email)).toEqual(["emma@x.fr", "theo@x.fr", "vieux@x.fr", "jamais@x.fr"]);
  });
  it("compte sur l'heure exacte, avec la période précédente de même longueur", () => {
    expect(out.fenetre.connectes).toEqual({ n: 2, prec: 0 });
    expect(out.fenetre.comptes_crees).toEqual({ n: 1, prec: 0 });
    expect(out.fenetre.invites_ajoutes).toEqual({ n: 1, prec: 0 });
    expect(out.fenetre.devis).toEqual({ n: 0, prec: 1 });
    expect(out.fenetre.sites_crees.n).toBe(1);
  });
  it("dit qui a un site et des invités", () => {
    const emma = out.mariages.find((m) => m.id === "w1");
    expect(emma).toMatchObject({ couple: "Emma et Lucas", invites: 2, site: "publié", taches: 2, taches_faites: 1, devis: 1, emails: ["emma@x.fr"] });
    expect(out.mariages.find((m) => m.id === "w2")).toMatchObject({ invites: 0, site: null });
    expect(out.totaux).toMatchObject({ comptes: 4, mariages: 2, avec_site: 1, avec_site_publie: 1, avec_invites: 1, avec_devis: 1 });
  });
  it("rattache chaque utilisateur à son couple", () => {
    expect(out.utilisateurs[0]).toMatchObject({ couple: "Emma et Lucas", site: "publié", invites: 2 });
    expect(out.utilisateurs[3].couple).toBe(null);
  });
});

describe("fmtAgo", () => {
  it("écrit l'ancienneté en minutes, heures puis jours", () => {
    expect(fmtAgo(min(0), NOW)).toBe("à l'instant");
    expect(fmtAgo(min(12), NOW)).toBe("il y a 12 min");
    expect(fmtAgo(min(180), NOW)).toBe("il y a 3 h");
    expect(fmtAgo(min(60 * 24 * 5), NOW)).toBe("il y a 5 j");
    expect(fmtAgo(null, NOW)).toBe("jamais");
  });
});

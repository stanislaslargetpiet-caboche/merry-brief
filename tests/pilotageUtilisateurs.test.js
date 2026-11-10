import { describe, expect, it } from "vitest";
import { buildUtilisateurs, readDernieresSessions, sourceLabel, withPostHog, withSessions } from "@/lib/server/pilotage/utilisateurs";
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
    expect(out.fenetre.couples_connectes).toEqual({ n: 2, prec: 0 });
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
  it("compte les couleurs choisies et ceux qui n'ont rien choisi", () => {
    const withColors = buildUtilisateurs(
      { ...raw, users: raw.users.map((u, i) => ({ ...u, user_metadata: i === 0 ? { accent: "pistache" } : i === 1 ? { accent: "peche" } : {} })) },
      60 * 60000,
      NOW,
    );
    expect(withColors.couleurs.map((c) => [c.label, c.n])).toEqual([["Pas choisi", 2], ["Pistache", 1], ["Ancienne couleur", 1]]);
    expect(withColors.utilisateurs[0].couleur).toBe("Pistache");
  });
  it("rattache chaque utilisateur à son couple", () => {
    expect(out.utilisateurs[0]).toMatchObject({ couple: "Emma et Lucas", site: "publié", invites: 2 });
    expect(out.utilisateurs[3].couple).toBe(null);
  });
});

describe("withPostHog", () => {
  // w1 a deux comptes : u1 s'est connecté il y a 2 jours mais est revenu sans reconnexion il y a 5 min (PostHog) ;
  // u5 a un replay plus ancien. w2 (u2) n'a jamais été vu par PostHog.
  const twoAccounts = {
    ...raw,
    users: [...raw.users.map((u) => (u.id === "u1" ? { ...u, last_sign_in_at: min(60 * 48) } : u)), { id: "u5", email: "lucas@x.fr", created_at: min(60 * 24 * 9), last_sign_in_at: min(60 * 30) }],
    members: [...raw.members, { wedding_id: "w1", user_id: "u5" }],
  };
  const replay = (fin, extra = {}) => ({ session: `s-${fin}`, debut: min(fin + 20), fin: min(fin), actif_s: 300, clics: 40, erreurs: 0, ...extra });
  const sessions = {
    u1: { dernier: min(5), sessions_7j: 4, replay: replay(5) },
    u5: { dernier: min(60 * 30), sessions_7j: 1, replay: replay(60 * 30) },
  };
  const out = withPostHog(buildUtilisateurs(twoAccounts, 60 * 60000, NOW), sessions);
  const w1 = out.mariages.find((m) => m.id === "w1");

  it("prend la visite PostHog quand elle est plus récente que la connexion", () => {
    expect(w1.derniere_visite).toBe(min(5));
    expect(w1.derniere_connexion).toBe(min(60 * 30));
    expect(w1.visite_par).toBe("emma@x.fr");
    expect(w1.comptes.map((c) => c.email)).toEqual(["emma@x.fr", "lucas@x.fr"]);
  });
  it("garde le replay le plus récent du couple et additionne les sessions", () => {
    expect(w1.replay).toMatchObject({ session: "s-5", email: "emma@x.fr" });
    expect(w1.sessions_7j).toBe(5);
    expect(w1.posthog).toBe("ok");
  });
  it("classe les couples par dernière visite", () => {
    expect(out.mariages.map((m) => m.id)).toEqual(["w1", "w2"]);
  });
  it("distingue jamais vu, sessions sans replay et ancien replay", () => {
    expect(out.mariages.find((m) => m.id === "w2")).toMatchObject({ posthog: "jamais", replay: null, sessions_7j: 0 });
    const sansReplay = withPostHog(buildUtilisateurs(raw, 60 * 60000, NOW), { u1: { dernier: min(5), sessions_7j: 2, replay: null } });
    expect(sansReplay.mariages.find((m) => m.id === "w1").posthog).toBe("sans_replay");
    // Connecté il y a 12 min, dernier replay il y a 6 jours : plus rien d'enregistré depuis
    const ancien = withPostHog(buildUtilisateurs(raw, 60 * 60000, NOW), { u1: { dernier: min(60 * 24 * 6), sessions_7j: 0, replay: replay(60 * 24 * 6) } });
    expect(ancien.mariages.find((m) => m.id === "w1")).toMatchObject({ posthog: "ancien", derniere_visite: min(12) });
  });
});

describe("withSessions", () => {
  // u2 (Théo, w2) s'est connecté il y a 30 min ; u1 (Emma, w1) il y a 2 jours, mais sa session a été rafraîchie il y a
  // 10 min : sans cookies, c'est la seule trace de sa visite
  const sansCookies = { ...raw, users: raw.users.map((u) => (u.id === "u1" ? { ...u, last_sign_in_at: min(60 * 48) } : u)) };
  const out = withSessions(buildUtilisateurs(sansCookies, 60 * 60000, NOW), [
    { user_id: "u1", dernier: min(10) },
    { user_id: "u2", dernier: min(60 * 24) },
  ]);
  const w1 = out.mariages.find((m) => m.id === "w1");

  it("prend la dernière session quand elle est plus récente que la connexion, sans toucher la connexion", () => {
    expect(w1.derniere_visite).toBe(min(10));
    expect(w1.derniere_connexion).toBe(min(60 * 48));
    expect(w1.visite_par).toBe("emma@x.fr");
  });
  it("garde la connexion quand la session est plus ancienne, et reclasse les couples", () => {
    expect(out.mariages.find((m) => m.id === "w2").derniere_visite).toBe(min(30));
    expect(out.mariages.map((m) => m.id)).toEqual(["w1", "w2"]);
  });
  it("laisse PostHog l'emporter quand il a vu une visite plus récente, et inversement", () => {
    const both = withPostHog(withSessions(buildUtilisateurs(sansCookies, 60 * 60000, NOW), [{ user_id: "u1", dernier: min(10) }]), { u1: { dernier: min(3), sessions_7j: 1, replay: null } });
    expect(both.mariages.find((m) => m.id === "w1").derniere_visite).toBe(min(3));
    const avant = withPostHog(withSessions(buildUtilisateurs(sansCookies, 60 * 60000, NOW), [{ user_id: "u1", dernier: min(10) }]), { u1: { dernier: min(60 * 40), sessions_7j: 1, replay: null } });
    expect(avant.mariages.find((m) => m.id === "w1").derniere_visite).toBe(min(10));
  });
});

describe("readDernieresSessions", () => {
  const admin = (result) => ({ rpc: async (name) => (name === "pilotage_dernieres_sessions" ? result : { error: { message: "autre" } }) });
  it("lit une ligne par compte", async () => {
    await expect(readDernieresSessions(admin({ data: [{ user_id: "u1", dernier: min(10) }], error: null }))).resolves.toEqual([{ user_id: "u1", dernier: min(10) }]);
  });
  it("se passe de la fonction tant qu'elle n'est pas collée, mais signale les autres erreurs", async () => {
    await expect(readDernieresSessions(admin({ data: null, error: { code: "PGRST202", message: "Could not find the function public.pilotage_dernieres_sessions" } }))).resolves.toEqual([]);
    await expect(readDernieresSessions(admin({ data: null, error: { code: "57014", message: "canceling statement due to statement timeout" } }))).rejects.toThrow("statement timeout");
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

describe("inscriptions par source", () => {
  it("lit la source du lien d'arrivée enregistré avec le brief", () => {
    expect(sourceLabel("?source=meta-a&lang=en")).toBe("meta-a");
    expect(sourceLabel("?lang=en")).toBe("Autre lien");
    expect(sourceLabel(null)).toBe("Sans source");
    const now = Date.parse("2026-11-07T12:00:00Z");
    const users = [{ id: "u1", email: "a@x.fr", created_at: "2026-11-07T10:00:00Z" }, { id: "u2", email: "b@x.fr", created_at: "2026-11-01T10:00:00Z" }, { id: "u3", email: "c@x.fr", created_at: "2026-11-07T11:00:00Z" }];
    const briefs = [
      { user_id: "u1", source: "?source=meta-a", created_at: "2026-11-07T10:00:00Z" },
      { user_id: "u2", source: "?source=meta-a", created_at: "2026-11-01T10:00:00Z" },
      { user_id: "u3", source: null, created_at: "2026-11-07T11:00:00Z" },
    ];
    const r = buildUtilisateurs({ users, briefs }, 24 * 3600 * 1000, now);
    expect(r.sources.find((s) => s.label === "meta-a")).toMatchObject({ n: 1, total: 2 });
    expect(r.sources.find((s) => s.label === "Sans source")).toMatchObject({ n: 1, total: 1 });
    expect(r.utilisateurs.find((u) => u.id === "u1").source).toBe("meta-a");
  });
});

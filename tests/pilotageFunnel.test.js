import { describe, expect, it } from "vitest";
import { buildFunnel, signaux, stade } from "@/lib/pilotage/funnel";
import { resolvePage } from "@/lib/pilotage/nav";
import { buildUtilisateurs } from "@/lib/server/pilotage/utilisateurs";

const NOW = Date.parse("2026-11-12T12:00:00Z");
const jours = (n) => new Date(NOW - n * 86400000).toISOString();
const vide = { invites: 0, reponses_formulaire: 0, devis: 0, taches_faites: 0, budget_touche: false, equipe: 0, site: null, formulaire: null };
const mariage = (id, couple, extra = {}) => ({ ...vide, id, couple, emails: [`${id}@x.fr`], test: false, cree: jours(10), derniere_visite: jours(1), date: "2027-06-12", ...extra });

describe("stade", () => {
  it("prend l'étape la plus avancée, même si une étape a été sautée", () => {
    expect(stade(vide)).toBe(0);
    expect(stade({ ...vide, taches_faites: 2 })).toBe(1);
    expect(stade({ ...vide, formulaire: "publié" })).toBe(1);
    expect(stade({ ...vide, invites: 9 })).toBe(1);
    expect(stade({ ...vide, invites: 10 })).toBe(2);
    expect(stade({ ...vide, reponses_formulaire: 1 })).toBe(3);
    expect(stade({ ...vide, devis: 1 })).toBe(4);
  });
});

describe("signaux", () => {
  it("signale un mariage passé et un couple jamais revenu", () => {
    const m = mariage("a", "Joséphine et Aristide", { date: "2026-09-05", cree: jours(20), derniere_visite: jours(20) });
    expect(signaux(m, [m], NOW).map((s) => s.id)).toEqual(["passe", "revenu"]);
  });
  it("laisse deux jours au couple qui vient de s'inscrire", () => {
    const m = mariage("a", "Ali et Louis", { cree: jours(1), derniere_visite: jours(1) });
    expect(signaux(m, [m], NOW)).toEqual([]);
  });
  it("prend la dernière connexion quand la dernière visite n'est pas lue", () => {
    const m = mariage("a", "Ali et Louis", { derniere_visite: undefined, derniere_connexion: jours(10) });
    expect(signaux(m, [m], NOW).map((s) => s.id)).toEqual(["revenu"]);
  });
  it("trouve un doublon par les prénoms dans le désordre ou par un compte partagé", () => {
    const a = mariage("a", "Marie et Florian");
    const b = mariage("b", "Florián et marie");
    const c = mariage("c", "Clem et Théo", { emails: ["a@x.fr"] });
    const d = mariage("d", "Florence");
    const tous = [a, b, c, d];
    expect(signaux(a, tous, NOW)[0].label).toBe("doublon de Florián et marie");
    expect(signaux(c, tous, NOW)[0].label).toBe("doublon de Marie et Florian");
    expect(signaux(d, [d, mariage("e", "Florence")], NOW)).toEqual([]);
  });
  it("ne prend pas une démo de test pour le doublon d'un vrai couple", () => {
    const vrai = mariage("a", "Emma et Hugo", { emails: ["emma@x.fr"] });
    const demo = mariage("b", "Léo et Léa", { emails: ["stan@x.fr", "emma@x.fr"], test: true });
    expect(signaux(vrai, [vrai, demo], NOW)).toEqual([]);
    expect(signaux(demo, [vrai, demo], NOW)[0].label).toBe("doublon de Emma et Hugo");
  });
});

describe("buildFunnel", () => {
  const mariages = [
    mariage("a", "Inscrit seul"),
    mariage("b", "Avec tâches", { taches_faites: 1 }),
    mariage("c", "Avec invités", { invites: 120 }),
    mariage("d", "Avec réponses", { invites: 80, reponses_formulaire: 4 }),
    mariage("t", "Test", { devis: 2, test: true }),
  ];
  const { etapes, lignes } = buildFunnel(mariages, NOW);

  it("compte les couples arrivés au moins à chaque étape, sans les tests", () => {
    expect(etapes.map((e) => [e.id, e.n, e.ici])).toEqual([
      ["inscrit", 4, 1],
      ["geste", 3, 1],
      ["invites", 2, 1],
      ["reponses", 1, 1],
      ["devis", 0, 0],
    ]);
  });
  it("range les plus avancés d'abord, les tests en bas", () => {
    expect(lignes.map((m) => m.id)).toEqual(["d", "c", "b", "a", "t"]);
  });
});

describe("buildUtilisateurs, champs du funnel", () => {
  const cree = jours(10);
  const apres = (minutes) => new Date(Date.parse(cree) + minutes * 60000).toISOString();
  const raw = {
    users: [{ id: "u1", email: "clem@x.fr", created_at: cree, last_sign_in_at: jours(1) }],
    weddings: [
      { id: "w1", created_at: cree, created_by: "u1", partner1: "Clem", partner2: "Théo" },
      { id: "w2", created_at: cree, created_by: "u1", partner1: "Ali", partner2: "Louis" },
      { id: "w3", created_at: cree, created_by: "u1", partner1: "Emma", partner2: "Hugo" },
    ],
    members: [
      { wedding_id: "w1", user_id: "u1", role: "couple" },
      { wedding_id: "w1", user_id: null, role: "parents", invited_at: apres(60) },
      { wedding_id: "w1", user_id: null, role: "parents", invited_at: null },
      { wedding_id: "w2", user_id: null, role: "couple", contribution: 5000 },
    ],
    budget: [
      { wedding_id: "w1", created_at: apres(1), quote_amount: null },
      { wedding_id: "w3", created_at: apres(1), quote_amount: null },
      { wedding_id: "w3", created_at: apres(600), quote_amount: null },
    ],
    payments: [],
  };
  const out = buildUtilisateurs(raw, 86400000, NOW);
  const de = (id) => out.mariages.find((m) => m.id === id);

  it("ne compte pas les postes créés avec le mariage comme un budget commencé", () => {
    expect(de("w1").budget_touche).toBe(false);
    expect(de("w2").budget_touche).toBe(true);
    expect(de("w3").budget_touche).toBe(true);
  });
  it("compte l'équipe invitée, pas les lignes de l'onboarding restées vides", () => {
    expect(de("w1").equipe).toBe(1);
    expect(de("w3").equipe).toBe(0);
  });
});

describe("navigation", () => {
  it("ouvre Couples › Funnel", () => {
    const { group, page } = resolvePage("/pilotage/couples/funnel");
    expect([group.id, page.id]).toEqual(["couples", "funnel"]);
  });
});

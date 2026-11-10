import { describe, expect, it } from "vitest";
import { findDuplicates, mergePlan, normEmail, pairKey, scorePair } from "@/lib/dash/guestDuplicates";

const g = (id, first_name, last_name, extra = {}) => ({ id, first_name, last_name, created_at: `2026-11-0${id.length}T10:00:00Z`, position: 0, ...extra });
const oui = (guest_id, event_id = "e1") => ({ guest_id, event_id, status: "oui" });

describe("doublons : repérage", () => {
  it("rapproche un nom abrégé en initiales et garde la ligne du couple", () => {
    const list = [g("a", "Ali", "de La Marre", { created_at: "2026-10-01T10:00:00Z" }), g("b", "Ali", "dLM", { created_at: "2026-11-09T10:00:00Z" })];
    const [s] = findDuplicates(list, [oui("b")]);
    expect(s).toMatchObject({ keepId: "a", dropId: "b", reason: "name_close" });
  });
  it("tolère particule oubliée, faute de frappe, prénom et nom inversés", () => {
    expect(scorePair(g("a", "Raphaëlle", "De Lépinau"), g("b", "Raphaelle", "Lepinau"))).not.toBeNull();
    expect(scorePair(g("a", "Jordan", "Casaccio"), g("b", "Jordan", "Casacio"))).not.toBeNull();
    expect(scorePair(g("a", "Ali", "Marre"), g("b", "Marre", "Ali"))).not.toBeNull();
  });
  it("rapproche un surnom ou un début de prénom", () => {
    expect(scorePair(g("a", "Alexandre", "Durand"), g("b", "Alex", "Durand"))).not.toBeNull();
    expect(scorePair(g("a", "Sébastien", "Durand"), g("b", "Bastien", "Durand"))).not.toBeNull();
  });
  it("ne rapproche pas deux personnes différentes", () => {
    expect(scorePair(g("a", "Paul", "Durand"), g("b", "Pierre", "Durand"))).toBeNull();
    expect(scorePair(g("a", "Paul", "Durand"), g("b", "Paul", "Dupont"))).toBeNull();
    expect(scorePair(g("a", "Léa", "Martin"), g("b", "Léo", "Martin"))).toBeNull();
  });
  it("ne confond pas le masculin et le féminin d'un prénom", () => {
    expect(scorePair(g("a", "Paul", "Rousseau"), g("b", "Pauline", "Rousseau"))).toBeNull();
    expect(scorePair(g("a", "Louis", "Roux"), g("b", "Louise", "Roux"))).toBeNull();
  });
  it("un couple qui partage une adresse email n'est pas un doublon", () => {
    const e = "famille@example.com";
    expect(scorePair(g("a", "Paul", "Durand", { email: e }), g("b", "Julie", "Durand", { email: e }))).toBeNull();
    expect(scorePair(g("a", "Marie", "Durand", { email: e }), g("b", "Marie", "Martin", { email: e }))).toMatchObject({ reason: "email" });
  });
  it("le même email suffit, deux emails différents excluent", () => {
    const a = g("a", "Ali", "Marre", { email: "Ali.Marre+noces@Gmail.com" });
    expect(scorePair(a, g("b", "Ali", "Autre", { email: "alimarre@gmail.com" }))).toMatchObject({ score: 1, reason: "email" });
    expect(scorePair(g("a", "Ali", "Marre", { email: "x@example.com" }), g("b", "Ali", "Marre", { email: "y@example.com" }))).toBeNull();
    expect(normEmail("pas un email")).toBe("");
  });
  it("deux invités qui ont chacun répondu restent deux personnes", () => {
    const list = [g("a", "Ali", "Marre"), g("bb", "Ali", "Mare")];
    expect(findDuplicates(list, [oui("a"), oui("bb")])).toEqual([]);
  });
  it("ne propose rien quand la ligne ressemble à deux autres aussi bien", () => {
    const list = [g("a", "Ali", "Marre", { created_at: "2026-10-01T10:00:00Z" }), g("bb", "Ali", "Marre", { created_at: "2026-10-02T10:00:00Z" }), g("ccc", "Ali", "Mare", { created_at: "2026-11-09T10:00:00Z" })];
    expect(findDuplicates(list, [oui("ccc")]).filter((s) => s.dropId === "ccc")).toEqual([]);
  });
  it("oublie les paires refusées et ignore les accompagnants", () => {
    const list = [g("a", "Ali", "Marre"), g("bb", "Ali", "Mare")];
    expect(findDuplicates(list, [], [pairKey("a", "bb")])).toEqual([]);
    expect(findDuplicates([list[0], { ...list[1], plus_one_of: "a" }])).toEqual([]);
  });
});

describe("doublons : fusion", () => {
  it("garde le nom du couple, reporte la réponse, les coordonnées et le siège", () => {
    const keep = g("a", "Ali", "de La Marre", { custom: { f1: "" } });
    const drop = g("bb", "Ali", "dLM", { email: "ali@example.com", diet: "végétarien", custom: { f1: "2 enfants" } });
    const plan = mergePlan(keep, drop, {
      responses: [{ guest_id: "a", event_id: "e1", status: "attente" }, oui("bb", "e1"), oui("bb", "e2")],
      seating: [{ guest_id: "bb", event_id: "e1", table_id: "t1" }],
    });
    expect(plan.patch).toEqual({ email: "ali@example.com", diet: "végétarien", custom: { f1: "2 enfants" } });
    expect(plan.carried.map((r) => r.event_id).sort()).toEqual(["e1", "e2"]);
    expect(plan.seats).toHaveLength(1);
  });
  it("ne reprend pas une réponse qui contredit celle déjà donnée", () => {
    const plan = mergePlan(g("a", "A", "B"), g("bb", "A", "B"), { responses: [{ guest_id: "a", event_id: "e1", status: "non" }, oui("bb", "e1")] });
    expect(plan.carried).toEqual([]);
  });
});

describe("doublons : grande liste", () => {
  it("reste rapide avec 3 000 invités", () => {
    const first = ["Ali", "Zoé", "Paul", "Lina", "Hugo", "Emma", "Noé", "Anaïs", "Théo", "Inès"];
    const list = Array.from({ length: 3000 }, (_, i) => g(`id${i}`, first[i % 10], `Nom${i}x`, { created_at: `2026-10-01T10:00:${String(i % 60).padStart(2, "0")}Z` }));
    const t = Date.now();
    findDuplicates(list, []);
    expect(Date.now() - t).toBeLessThan(5000);
  });
});

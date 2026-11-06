import { describe, expect, it } from "vitest";
import { apresEnvoi, nextWorkday, planAction, summarizeReseau, validateContact } from "@/lib/server/pilotage/reseau";

const NOW = Date.parse("2026-11-09T09:00:00Z"); // lundi
const c = (id, statut, date_action, piste = "marketplace", nom = id) => ({ id, nom, entreprise: "", statut, piste, canal: "linkedin", date_action, prochaine_action: "Relance J+7" });

describe("cadence", () => {
  it("cale la relance à J+7, puis J+14, puis plus rien", () => {
    expect(apresEnvoi({ statut: "a_contacter" }, "2026-11-09")).toMatchObject({ statut: "contacte", date_action: "2026-11-16" });
    expect(apresEnvoi({ statut: "contacte" }, "2026-11-16")).toMatchObject({ statut: "relance_1", date_action: "2026-11-23" });
    expect(apresEnvoi({ statut: "relance_1" }, "2026-11-23")).toMatchObject({ statut: "relance_2", date_action: null });
  });
  it("garde le statut d'une conversation en cours", () => {
    expect(apresEnvoi({ statut: "conversation" }, "2026-11-09")).toEqual({ dernier_contact: "2026-11-09", prochaine_action: "", date_action: null });
  });
  it("saute le week-end", () => {
    expect(nextWorkday("2026-11-06")).toBe("2026-11-09");
    expect(nextWorkday("2026-11-09")).toBe("2026-11-10");
  });
});

describe("planAction", () => {
  it("note un échange sortant quand c'est fait", () => {
    const p = planAction(c("a", "contacte", "2026-11-09"), { action: "fait" }, NOW);
    expect(p.echange).toMatchObject({ contact_id: "a", sens: "sortant", canal: "linkedin", resume: "Relance J+7", jour: "2026-11-09" });
  });
  it("valide un nom pour le jour ouvré suivant", () => {
    expect(planAction(c("a", "a_valider", null), { action: "valider" }, NOW).valeur).toMatchObject({ statut: "a_contacter", date_action: "2026-11-10" });
  });
  it("retire la date d'un contact mis en pause", () => {
    expect(planAction(c("a", "contacte", "2026-11-09"), { action: "statut", statut: "en_pause" }, NOW).valeur).toEqual({ statut: "en_pause", date_action: null });
  });
  it("refuse un statut ou une action inconnus", () => {
    expect(planAction(c("a", "contacte", null), { action: "statut", statut: "x" }, NOW).ok).toBe(false);
    expect(planAction(c("a", "contacte", null), { action: "x" }, NOW).ok).toBe(false);
  });
});

describe("validateContact", () => {
  it("exige un nom et une piste connue, et commence à valider", () => {
    expect(validateContact({ nom: " ", piste: "angels" }).erreur).toBe("nom");
    expect(validateContact({ nom: "A", piste: "x" }).erreur).toBe("piste");
    expect(validateContact({ nom: " A ", entreprise: "B", piste: "angels" }).valeur).toEqual({ nom: "A", entreprise: "B", piste: "angels", statut: "a_valider" });
  });
});

describe("summarizeReseau", () => {
  const rows = [c("retard", "contacte", "2026-11-05"), c("jour", "a_contacter", "2026-11-09"), c("futur", "contacte", "2026-11-12"), c("pause", "en_pause", "2026-11-01"), c("ecarte", "ecarte", null), c("nom", "a_valider", null, "angels")];
  const log = [
    { id: "1", contact_id: "jour", jour: "2026-11-08", sens: "sortant" },
    { id: "2", contact_id: "retard", jour: "2026-11-08", sens: "sortant" },
    { id: "3", contact_id: "retard", jour: "2026-10-01", sens: "sortant" },
    { id: "4", contact_id: "futur", jour: "2026-11-09", sens: "entrant" },
  ];
  const s = summarizeReseau(rows, log, NOW);
  it("trie les actions échues, sans les pauses, le futur ni les noms à valider", () => {
    expect(s.a_faire.map((x) => x.id)).toEqual(["retard", "jour"]);
    expect(s.a_valider.map((x) => x.id)).toEqual(["nom"]);
  });
  it("retire les écartés du pipeline", () => {
    expect(s.total).toBe(5);
    expect(s.pistes.flatMap((p) => p.contacts).some((x) => x.id === "ecarte")).toBe(false);
  });
  it("ne compte comme nouveaux que les premiers messages de la semaine", () => {
    expect(s.semaine).toMatchObject({ nouveaux: 1, reponses: 1 });
  });
});

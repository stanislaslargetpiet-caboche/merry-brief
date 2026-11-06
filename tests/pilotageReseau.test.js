import { describe, expect, it } from "vitest";
import { apresEnvoi, nextPlan, nextWorkday, planAction, planStep, safeLink, summarizeReseau, validateContact } from "@/lib/server/pilotage/reseau";

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

describe("plan du jour", () => {
  const contact = { id: "c1", nom: "Alex", entreprise: "A", statut: "a_contacter", canal: "linkedin", prochaine_action: "Premier message", linkedin: "https://www.linkedin.com/in/alex/" };
  const ligne = (id, jour, creneau, ordre, extra = {}) => ({ id, jour, creneau, ordre, contact_id: "c1", titre: "", message: "Bonjour", lien_envoi: "", statut: "a_faire", ...extra });
  it("ne garde que les liens LinkedIn et Gmail en https", () => {
    expect(safeLink("https://www.linkedin.com/messaging/thread/1/")).toContain("linkedin.com");
    expect(safeLink("https://mail.google.com/mail/u/0/#drafts")).toContain("mail.google.com");
    expect(safeLink("javascript:alert(1)")).toBe("");
    expect(safeLink("http://www.linkedin.com/")).toBe("");
    expect(safeLink("https://linkedin.com.exemple.fr/")).toBe("");
  });
  it("montre le prochain jour préparé, rangé par créneau et par ordre", () => {
    const p = nextPlan([ligne("a", "2026-11-10", "ecrire", 1), ligne("b", "2026-11-09", "ecrire", 2), ligne("c", "2026-11-09", "ecrire", 1), ligne("d", "2026-11-09", "repondre", 1)], [contact], "2026-11-09");
    expect(p.jour).toBe("2026-11-09");
    expect(p.creneaux.map((x) => x.id)).toEqual(["repondre", "ecrire"]);
    expect(p.creneaux[1].lignes.map((l) => l.id)).toEqual(["c", "b"]);
    expect(p.creneaux[0].lignes[0].nom).toBe("Alex");
  });
  it("prend lundi quand l'agent a préparé le plan le vendredi soir", () => {
    expect(nextPlan([ligne("a", "2026-11-09", "ecrire", 1)], [contact], "2026-11-06").jour).toBe("2026-11-09");
    expect(nextPlan([ligne("a", "2026-11-05", "ecrire", 1)], [contact], "2026-11-06")).toBeNull();
  });
  it("sort du reste à faire un contact déjà dans le plan", () => {
    const s = summarizeReseau([{ ...contact, date_action: "2026-11-09", piste: "angels" }], [], NOW, [ligne("a", "2026-11-09", "ecrire", 1)]);
    expect(s.a_faire).toEqual([]);
  });
  it("coche : ligne faite, relance calée, échange noté avec le message", () => {
    const s = planStep(ligne("a", "2026-11-09", "ecrire", 1), contact, { action: "fait" }, NOW);
    expect(s.ligne).toEqual({ statut: "fait" });
    expect(s.contact).toMatchObject({ statut: "contacte", date_action: "2026-11-16" });
    expect(s.echange).toMatchObject({ contact_id: "c1", sens: "sortant", resume: "Bonjour" });
  });
  it("ne touche pas au contact pour une tâche de consolidation", () => {
    const s = planStep(ligne("a", "2026-11-09", "consolider", 1), contact, { action: "fait" }, NOW);
    expect(s.contact).toBeUndefined();
    expect(s.echange).toBeUndefined();
  });
  it("reporte au jour ouvré suivant et refuse un message trop long", () => {
    expect(planStep(ligne("a", "2026-11-09", "ecrire", 1), contact, { action: "reporter" }, NOW).contact).toEqual({ date_action: "2026-11-10" });
    expect(planStep(ligne("a", "2026-11-09", "ecrire", 1), contact, { action: "texte", message: "x".repeat(4001) }, NOW).ok).toBe(false);
  });
});

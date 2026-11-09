import { describe, expect, it } from "vitest";
import { briefAgent, estBug, titreBug } from "@/lib/pilotage/agent";
import { buildFil } from "@/lib/pilotage/items";

const bug = { id: "a", type: "tache", statut: "a_faire", priorite: 0, recurrence: "", detail: "Clic mort sur iPhone.", lien: "", echeance: "2026-11-09", cle: "", projet: "Bugs", titre: "Bug à arbitrer : inscription par invitation" };

describe("bugs du pilotage", () => {
  it("reconnaît un bug à son projet ou à son titre", () => {
    expect(estBug(bug)).toBe(true);
    expect(estBug({ ...bug, projet: "" })).toBe(true);
    expect(estBug({ ...bug, projet: "", titre: "Relire le mail" })).toBe(false);
  });
  it("raccourcit le titre", () => {
    expect(titreBug(bug.titre)).toBe("Inscription par invitation");
  });
  it("la consigne d'audit ne touche pas au code, celle de réparation ouvre une PR sans fusionner", () => {
    expect(briefAgent(bug, "audit")).toContain("sans modifier le code");
    const reparer = briefAgent(bug, "reparer");
    expect(reparer).toContain("pull request");
    expect(reparer).toContain("Ne fusionne rien");
    expect(reparer).toContain("Clic mort sur iPhone.");
    expect(() => briefAgent(bug, "fusionner")).toThrow();
  });
  it("le fil range les bugs, les tâches et le réseau dans leur groupe", () => {
    const fil = buildFil({ today: "2026-11-09", items: [bug, { ...bug, id: "b", projet: "", titre: "Appeler Astrid" }], reseau: { plan: { jour: "2026-11-09", creneaux: [{ id: "ecrire", label: "14 h 00 · Écrire", lignes: [{ id: "p", statut: "a_faire", nom: "X", canal: "linkedin" }] }] } } });
    expect(fil.map((l) => l.groupe).sort()).toEqual(["bugs", "reseau", "taches"]);
  });
});

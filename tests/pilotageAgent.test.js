import { describe, expect, it } from "vitest";
import { briefAgent, estAlerteBug, estBug, titreBug } from "@/lib/pilotage/agent";
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
  it("impose la même réponse en quatre rubriques, à faire avant le détail technique", () => {
    for (const mode of ["audit", "reparer"]) {
      for (const brief of [briefAgent(bug, mode), briefAgent({ titre: "20 clic(s) de rage" }, mode, true)]) {
        const ordre = ["1. Verdict", "2. Effet", "3. À faire", "4. Détail technique"].map((r) => brief.indexOf(r));
        expect(ordre.every((i) => i > -1)).toBe(true);
        expect([...ordre].sort((a, b) => a - b)).toEqual(ordre);
      }
    }
  });
  it("le fil range les bugs, les tâches et le réseau dans leur groupe", () => {
    const fil = buildFil({ today: "2026-11-09", items: [bug, { ...bug, id: "b", projet: "", titre: "Appeler Astrid" }], reseau: { plan: { jour: "2026-11-09", creneaux: [{ id: "ecrire", label: "14 h 00 · Écrire", lignes: [{ id: "p", statut: "a_faire", nom: "X", canal: "linkedin" }] }] } } });
    expect(fil.map((l) => l.groupe).sort()).toEqual(["bugs", "reseau", "taches"]);
  });

  it("envoie aussi à l'agent les alertes qui parlent de bugs", () => {
    expect(estAlerteBug("4 erreur(s) JavaScript sur 7 jours")).toBe(true);
    expect(estAlerteBug("20 clic(s) de rage")).toBe(true);
    expect(estAlerteBug("1 mail(s) en difficulté")).toBe(false);
    const brief = briefAgent({ titre: "20 clic(s) de rage", detail: "au même endroit" }, "audit", true);
    expect(brief).toContain("Alerte : 20 clic(s) de rage");
    expect(brief).toContain("Détail : au même endroit");
    expect(brief).not.toContain("ce bug");
  });
});

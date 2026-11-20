import { describe, expect, it } from "vitest";
import { briefAgent, estAlerteBug, estBug, prDuRapport, statutBug, titreBug } from "@/lib/pilotage/agent";
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
    expect(reparer).toContain("sans demander l'avis de Stan");
    expect(reparer).toContain("gh pr list --state open");
    expect(reparer).not.toContain("arrête-toi");
    expect(() => briefAgent(bug, "fusionner")).toThrow();
  });
  it("impose la même réponse en quatre rubriques, à faire avant le détail technique", () => {
    for (const mode of ["audit", "reparer"]) {
      for (const brief of [briefAgent(bug, mode), briefAgent({ titre: "20 clic(s) de rage" }, mode, true)]) {
        const ordre = ["1. Verdict", "2. Effet", "3. À faire", "4. Détail technique"].map((r) => brief.indexOf(r));
        expect(ordre.every((i) => i > -1)).toBe(true);
        expect([...ordre].sort((a, b) => a - b)).toEqual(ordre);
        expect(brief).toContain("en le tutoyant");
        expect(brief).toContain("Ne pose aucune question à Stan");
        expect(brief).not.toContain("Je recommande A");
      }
    }
  });
  it("demande à l'agent de renvoyer son compte rendu au pilotage, avec un jeton à usage unique", () => {
    const retour = { url: "https://app.example/api/interne/pilotage/agent/rapport", id: "11111111-1111-1111-1111-111111111111", jeton: "abc123" };
    const brief = briefAgent(bug, "reparer", false, retour);
    expect(brief).toContain(`Adresse : ${retour.url}`);
    expect(brief).toContain(`id : ${retour.id}`);
    expect(brief).toContain("jeton : abc123");
    expect(brief.startsWith(briefAgent(bug, "reparer"))).toBe(true);
    expect(briefAgent(bug, "reparer")).not.toContain("jeton :");
  });
  it("le fil range les bugs et les tâches dans leur groupe", () => {
    const fil = buildFil({ today: "2026-11-09", items: [bug, { ...bug, id: "b", projet: "", titre: "Appeler Astrid" }] });
    expect(fil.map((l) => l.groupe).sort()).toEqual(["bugs", "taches"]);
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

describe("statut d'un bug après l'agent", () => {
  const url = (n) => `https://github.com/stanislaslargetpiet-caboche/merry-brief/pull/${n}`;
  const texte = `1. Verdict\nC'est corrigé.\n\n2. Effet\nGênant.\n\n3. À faire\nRelis et fusionne la PR ${url(469)}, puis colle le SQL.\n\n4. Détail technique\nRemplace la PR ${url(453)}.`;
  it("lit la PR dans la rubrique À faire, pas celles citées dans le détail", () => {
    expect(prDuRapport(texte)).toBe(469);
    expect(prDuRapport(`Verdict\nCorrigé.\n\nÀ faire\nRelis et fusionne la PR : ${url(461)}\n\nDétail technique\nPR ${url(456)}`)).toBe(461);
    expect(prDuRapport(`1. Verdict\nok\n\n3. À faire\nRien à faire.\n\n4. Détail technique\nVoir ${url(457)}`)).toBe(null);
    expect(prDuRapport("")).toBe(null);
  });
  it("donne une pastille par étape, et Réparé une fois la PR fusionnée", () => {
    expect(statutBug(null)).toBe(null);
    expect(statutBug({ statut: "en_cours", mode: "reparer" }).texte).toBe("Réparation en cours");
    expect(statutBug({ statut: "pret", mode: "reparer", texte, pr: { numero: 469, etat: "ouverte" } })).toEqual({ texte: "Réparé, PR 469 à fusionner", ton: "warn", lien: url(469) });
    expect(statutBug({ statut: "pret", mode: "reparer", texte, pr: { numero: 469, etat: "fusionnee" } }).texte).toBe("Réparé");
    expect(statutBug({ statut: "pret", mode: "reparer", texte, pr: { numero: 469, etat: "fermee" } }).ton).toBe("bad");
    expect(statutBug({ statut: "pret", mode: "reparer", texte, pr: { numero: 469, etat: null } }).texte).toBe("Réparé, PR 469 à fusionner");
    expect(statutBug({ statut: "pret", mode: "audit", texte: "1. Verdict\nRas.\n\n3. À faire\nRien à faire.\n\n4. Détail technique\n…", pr: null }).texte).toBe("Rien à faire");
    expect(statutBug({ statut: "pret", mode: "audit", texte: "3. À faire\nClique Réparer.", pr: null }).texte).toBe("Audit rendu");
  });
});

import { describe, expect, it } from "vitest";
import { buildFil, etatFil, itemAction, parseCapture, rangerTaches, titreJour, validateItem } from "@/lib/pilotage/items";
import { buildSante } from "@/lib/pilotage/sante";

const LUNDI = "2026-11-09";
const item = (x) => ({ id: "a", type: "tache", statut: "a_faire", priorite: 0, recurrence: "", detail: "", lien: "", echeance: null, cle: "", ...x });

describe("parseCapture", () => {
  it("lit le jour, le projet et la priorité", () => {
    expect(parseCapture("Appeler Astrid demain #perso !", LUNDI)).toEqual({ titre: "Appeler Astrid", echeance: "2026-11-10", projet: "Perso", priorite: 1 });
  });
  it("un jour de la semaine est le prochain, jamais aujourd'hui", () => {
    expect(parseCapture("Relire jeudi", LUNDI).echeance).toBe("2026-11-12");
    expect(parseCapture("Relire lundi", LUNDI).echeance).toBe("2026-11-16");
  });
  it("sans date, prend le jour par défaut", () => {
    expect(parseCapture("Relire", LUNDI, LUNDI).echeance).toBe(LUNDI);
    expect(parseCapture("Relire", LUNDI).echeance).toBe(null);
  });
  it("ne prend un mot pour une date qu'en fin de texte", () => {
    expect(parseCapture("Mardi gras à préparer", LUNDI)).toMatchObject({ titre: "Mardi gras à préparer", echeance: null });
  });
});

describe("validateItem", () => {
  it("refuse un titre vide et un type réservé aux agents", () => {
    expect(validateItem({ titre: " " }, { creation: true }).ok).toBe(false);
    expect(validateItem({ titre: "x", type: "alerte" }, { creation: true }).erreur).toBe("type");
  });
  it("ne garde que les champs envoyés", () => {
    expect(validateItem({ echeance: "" })).toEqual({ ok: true, valeur: { echeance: null } });
    expect(validateItem({ echeance: "demain" }).ok).toBe(false);
  });
});

describe("itemAction", () => {
  it("fait : ferme la tâche", () => {
    expect(itemAction(item(), { action: "fait" }, LUNDI, "t").valeur).toEqual({ statut: "fait", fait_le: "t" });
  });
  it("fait, récurrente : passe à la prochaine date, même en retard", () => {
    expect(itemAction(item({ recurrence: "hebdo", echeance: "2026-10-26" }), { action: "fait" }, LUNDI).valeur).toEqual({ echeance: "2026-11-16" });
    expect(itemAction(item({ recurrence: "mensuel", echeance: "2027-01-31" }), { action: "fait" }, "2027-01-31").valeur).toEqual({ echeance: "2027-02-28" });
  });
  it("plus tard : jour ouvré suivant", () => {
    expect(itemAction(item(), { action: "plus_tard" }, "2026-11-06").valeur).toEqual({ echeance: "2026-11-09" });
  });
  it("refuse une action inconnue", () => {
    expect(itemAction(item(), { action: "rien" }, LUNDI).ok).toBe(false);
  });
});

describe("rangerTaches", () => {
  it("range par échéance et laisse lectures et mots de côté", () => {
    const g = rangerTaches(
      [item({ id: "1" }), item({ id: "2", echeance: "2026-11-02" }), item({ id: "3", echeance: "2026-11-12" }), item({ id: "4", echeance: "2026-11-30" }), item({ id: "5", type: "lecture", echeance: LUNDI })],
      LUNDI,
    );
    expect(g.map((x) => [x.id, x.lignes.map((l) => l.id)])).toEqual([
      ["trier", ["1"]],
      ["jour", ["2"]],
      ["semaine", ["3"]],
      ["tard", ["4"]],
    ]);
  });
});

describe("buildFil", () => {
  it("réunit alerte, demande, réseau et tâche, dans cet ordre", () => {
    const fil = buildFil({
      today: LUNDI,
      items: [item({ titre: "Tâche", echeance: LUNDI }), item({ id: "b", titre: "Demain", echeance: "2026-11-10" })],
      reseau: { plan: { jour: LUNDI, creneaux: [{ lignes: [{ id: "p", statut: "a_faire", nom: "Yseulys Costes", entreprise: "Numberly", titre: "", message: "x" }, { id: "q", statut: "fait", nom: "Vue" }] }] }, a_faire: [] },
      demandes: { disponible: true, en_attente: [{}] },
      sante: [
        { tone: "warn", titre: "20 clic(s) de rage", detail: "" },
        { tone: "bad", titre: "Sitemap illisible", detail: "" },
        { tone: "ok", titre: "Aucune erreur", detail: "" },
      ],
    });
    expect(fil.map((l) => l.titre)).toEqual(["Sitemap illisible", "1 demande(s) d'accès à une fiche", "Yseulys Costes", "Tâche", "20 clic(s) de rage"]);
    expect(fil[2].sous).toBe("Numberly · message prêt");
  });
  it("une alerte vue disparaît, et revient si son texte change", () => {
    const items = [item({ type: "alerte", statut: "fait", cle: "alerte:20 clic(s) de rage" })];
    expect(buildFil({ today: LUNDI, items, sante: [{ tone: "warn", titre: "20 clic(s) de rage" }] })).toEqual([]);
    expect(buildFil({ today: LUNDI, items, sante: [{ tone: "warn", titre: "21 clic(s) de rage" }] })).toHaveLength(1);
  });
  it("le plan d'un autre jour n'entre pas dans le fil", () => {
    expect(buildFil({ today: LUNDI, reseau: { plan: { jour: "2026-11-10", creneaux: [{ lignes: [{ id: "p", statut: "a_faire", nom: "X" }] }] } } })).toEqual([]);
  });
});

describe("titreJour", () => {
  it("écrit le jour avec une capitale et un point", () => {
    expect(titreJour(LUNDI)).toBe("Lundi 9 novembre.");
  });
});

describe("santé des déploiements", () => {
  const deploiement = (x) => buildSante({ vercel: { disponible: true, erreurs: 1, erreurs_production: 1, ...x } }, 7).find((s) => /déploiement/i.test(s.titre));
  it("un échec déjà réparé n'est plus une alerte", () => {
    expect(deploiement({ echecs_actifs: 0 })).toMatchObject({ tone: "warn", titre: "1 déploiement(s) de production en échec, production à jour" });
  });
  it("un échec sur la dernière production reste une alerte", () => {
    expect(deploiement({ echecs_actifs: 1 }).tone).toBe("bad");
  });
});

describe("etatFil", () => {
  it("n'annonce un fil vide qu'une fois la liste et les indicateurs lus", () => {
    expect(etatFil({ charge: true })).toEqual({ complet: true, message: "Rien pour aujourd'hui" });
    expect(etatFil({ charge: true, indicateurs: "lecture" }).complet).toBe(false);
    expect(etatFil({ charge: false, indicateurs: "lus" }).complet).toBe(false);
  });

  it("dit ce qui manque quand une lecture échoue", () => {
    expect(etatFil({ charge: true, indicateurs: "erreur" })).toEqual({ complet: false, message: "Réseau, demandes et alertes non lus" });
    expect(etatFil({ charge: false, err: "Liste non lue : erreur 502", indicateurs: "lecture" })).toEqual({ complet: false, message: "Liste non lue" });
  });
});

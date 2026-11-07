import { describe, expect, it } from "vitest";
import { validateHistorique, validateLectureMemoire } from "@/lib/pilotage/items";
import { lireMemoire, remplacerHistorique } from "@/lib/server/pilotage/items";

const JOUR = "2026-11-07";

// Faux client Supabase : chaque requête finit sur `reponses` selon la table de réponses, et les écritures sont notées
function faux(reponses, ecrit = []) {
  const chaine = (cle) => {
    const c = {
      eq: () => c,
      gte: () => c,
      like: () => c,
      in: (_, ids) => (ecrit.push({ supprime: ids }), Promise.resolve({ error: null })),
      order: () => c,
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
      then: (ok) => ok(reponses[cle] ?? { data: [], error: null }),
    };
    return c;
  };
  return {
    from: () => ({
      select: (champs) => chaine(champs),
      insert: (ligne) => (ecrit.push({ ecrit: ligne.cle }), Promise.resolve({ error: null })),
      delete: () => chaine("delete"),
    }),
  };
}

describe("validateLectureMemoire", () => {
  it("prend 120 jours par défaut", () => {
    expect(validateLectureMemoire("news", null, JOUR)).toEqual({ ok: true, rubrique: "news", depuis: "2026-07-10" });
  });
  it("refuse une rubrique ou une fenêtre inconnue", () => {
    expect(validateLectureMemoire("autre", null, JOUR).erreur).toBe("rubrique");
    expect(validateLectureMemoire("news", "0", JOUR).erreur).toBe("jours");
    expect(validateLectureMemoire("news", "366", JOUR).erreur).toBe("jours");
    expect(validateLectureMemoire("news", "abc", JOUR).erreur).toBe("jours");
  });
});

describe("validateHistorique", () => {
  it("garde un texte court en une partie, hors de la rubrique affichée", () => {
    const v = validateHistorique({ rubrique: "feature", historique: " ligne 1\nligne 2 " });
    expect(v.lignes).toHaveLength(1);
    expect(v.lignes[0]).toMatchObject({ type: "lecture", projet: "Historique", contenu: "ligne 1\nligne 2", cle: "historique:feature:01" });
  });
  it("découpe sans couper une ligne et sans dépasser la colonne", () => {
    const ligne = "x".repeat(900);
    const texte = Array.from({ length: 40 }, () => ligne).join("\n");
    const v = validateHistorique({ rubrique: "news", historique: texte });
    expect(v.lignes.length).toBeGreaterThan(1);
    expect(v.lignes.every((l) => l.contenu.length <= 12000)).toBe(true);
    expect(v.lignes.map((l) => l.contenu).join("\n")).toBe(texte);
    expect(v.lignes[1].cle).toBe("historique:news:02");
  });
  it("refuse un texte vide, trop long, ou une ligne plus longue qu'une partie", () => {
    expect(validateHistorique({ rubrique: "news", historique: " " }).erreur).toBe("historique");
    expect(validateHistorique({ rubrique: "news", historique: "x\n".repeat(60000) }).erreur).toBe("historique");
    expect(validateHistorique({ rubrique: "news", historique: "x".repeat(11001) }).erreur).toBe("ligne");
    expect(validateHistorique({ rubrique: "autre", historique: "x" }).erreur).toBe("rubrique");
    expect(validateHistorique(null).erreur).toBe("rubrique");
  });
});

describe("lireMemoire", () => {
  it("recolle l'historique et renvoie les éditions datées", async () => {
    const admin = faux({
      contenu: { data: [{ contenu: "a" }, { contenu: "b" }], error: null },
      "echeance, titre, contenu": { data: [{ echeance: JOUR, titre: "T", contenu: "C" }], error: null },
    });
    expect(await lireMemoire(admin, "news", "2026-07-10")).toEqual({ historique: "a\nb", editions: [{ date: JOUR, titre: "T", contenu: "C" }] });
  });
  it("remonte une erreur de lecture", async () => {
    const admin = faux({ contenu: { data: null, error: { message: "panne" } } });
    expect((await lireMemoire(admin, "news", "2026-07-10")).error.message).toBe("panne");
  });
});

describe("remplacerHistorique", () => {
  it("écrit les parties puis retire celles d'un import plus long", async () => {
    const ecrit = [];
    const admin = faux({ "id, cle": { data: [{ id: "1", cle: "historique:news:01" }, { id: "2", cle: "historique:news:02" }], error: null } }, ecrit);
    await remplacerHistorique(admin, "news", [{ cle: "historique:news:01" }]);
    expect(ecrit).toEqual([{ ecrit: "historique:news:01" }, { supprime: ["2"] }]);
  });
});

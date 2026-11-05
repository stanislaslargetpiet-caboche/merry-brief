import { describe, expect, it } from "vitest";
import { alignSeries, dayList, delta, exceptionTitle, fmtDuration, splitSeries, sumBy, templatePath } from "@/lib/server/pilotage/shape";
import { allowedEmails } from "@/lib/server/pilotage/acces";

describe("splitSeries", () => {
  it("sépare la période courante (fin) de la précédente", () => {
    const rows = [1, 2, 3, 4, 5, 6].map((n) => ({ jour: `2026-11-0${n}`, n }));
    const { current, previous } = splitSeries(rows, 3);
    expect(current.map((r) => r.n)).toEqual([4, 5, 6]);
    expect(previous.map((r) => r.n)).toEqual([1, 2, 3]);
  });
  it("tolère une série plus courte que deux périodes", () => {
    const rows = [1, 2, 3, 4].map((n) => ({ n }));
    const { current, previous } = splitSeries(rows, 3);
    expect(current.map((r) => r.n)).toEqual([2, 3, 4]);
    expect(previous.map((r) => r.n)).toEqual([1]);
  });
  it("renvoie deux listes vides sans données", () => {
    expect(splitSeries(null, 7)).toEqual({ current: [], previous: [] });
  });
});

describe("delta", () => {
  it("calcule la variation et son sens", () => {
    expect(delta(12, 10)).toEqual({ diff: 2, pct: 20, sens: "hausse" });
    expect(delta(5, 10)).toEqual({ diff: -5, pct: -50, sens: "baisse" });
    expect(delta(3, 3)).toEqual({ diff: 0, pct: 0, sens: "stable" });
  });
  it("ne divise pas par zéro", () => {
    expect(delta(4, 0)).toEqual({ diff: 4, pct: null, sens: "hausse" });
  });
});

describe("alignSeries", () => {
  it("cale des lignes PostHog éparses sur la liste des jours", () => {
    const out = alignSeries(["2026-11-01", "2026-11-02", "2026-11-03"], [["2026-11-01T00:00:00Z", 3, 9], ["2026-11-03", 1, 2]], ["visiteurs", "pages"]);
    expect(out).toEqual([
      { jour: "2026-11-01", visiteurs: 3, pages: 9 },
      { jour: "2026-11-02", visiteurs: 0, pages: 0 },
      { jour: "2026-11-03", visiteurs: 1, pages: 2 },
    ]);
  });
  it("supporte une source absente", () => {
    expect(alignSeries(["2026-11-01"], null, ["n"])).toEqual([{ jour: "2026-11-01", n: 0 }]);
  });
});

describe("templatePath", () => {
  it("remplace les identifiants par un gabarit", () => {
    expect(templatePath("/dashboard/budget/prestataires/5f0c1d2e-1111-2222-3333-444455556666")).toBe("/dashboard/budget/prestataires/:id");
    expect(templatePath("/s/marie-et-florian/")).toBe("/s/:slug");
    expect(templatePath("/f/abc")).toBe("/f/:slug");
    expect(templatePath("/dashboard/")).toBe("/dashboard");
    expect(templatePath(null)).toBe("/");
  });
});

describe("mise en forme", () => {
  it("durées lisibles", () => {
    expect(fmtDuration(42)).toBe("42 s");
    expect(fmtDuration(125)).toBe("2 min 05 s");
    expect(fmtDuration(180)).toBe("3 min");
    expect(fmtDuration(3900)).toBe("1 h 05");
  });
  it("somme une clé en ignorant les valeurs absentes", () => {
    expect(sumBy([{ n: 2 }, { n: "3" }, {}], "n")).toBe(5);
  });
  it("titre d'une exception PostHog", () => {
    expect(exceptionTitle({ $exception_list: [{ type: "TypeError", value: "x is null" }] })).toBe("TypeError : x is null");
    expect(exceptionTitle({ $exception_list: '[{"type":"Error","value":"boom"}]' })).toBe("Error : boom");
    expect(exceptionTitle({ $exception_message: "ancien format" })).toBe("Erreur : ancien format");
    expect(exceptionTitle({})).toBe("Erreur");
  });
});

describe("allowedEmails", () => {
  it("prend les adresses de Stan par défaut, en minuscules", () => {
    const set = allowedEmails({});
    expect(set.has("stanislas.largetpiet@gmail.com")).toBe(true);
    expect(set.has("quelquun@exemple.fr")).toBe(false);
  });
  it("lit PILOTAGE_EMAILS", () => {
    const set = allowedEmails({ PILOTAGE_EMAILS: "A@b.fr, c@d.fr" });
    expect(set.has("a@b.fr")).toBe(true);
    expect(set.has("c@d.fr")).toBe(true);
    expect(set.has("stanislas.largetpiet@gmail.com")).toBe(false);
  });
});

describe("dayList", () => {
  it("donne 2 × days jours, du plus ancien au plus récent, en heure de Paris", () => {
    const now = Date.parse("2026-11-05T08:00:00Z");
    expect(dayList(2, now)).toEqual(["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05"]);
    // 23 h 30 UTC le 4 est déjà le 5 à Paris
    expect(dayList(1, Date.parse("2026-11-04T23:30:00Z"))).toEqual(["2026-11-04", "2026-11-05"]);
  });
});

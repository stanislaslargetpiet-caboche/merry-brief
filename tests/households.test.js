import { describe, expect, it } from "vitest";
import { householdKey, householdLabel, householdsOf } from "@/lib/dash/households";

const g = (id, first, last, extra = {}) => ({ id, first_name: first, last_name: last, ...extra });

describe("foyers", () => {
  it("un accompagnant suit son hôte, un membre suit son foyer", () => {
    const host = g("a", "Claire", "Morel", { household_id: "h1" });
    const plus = g("b", "", "", { plus_one_of: "a" });
    const solo = g("c", "Jean", "Petit");
    const byId = new Map([host, plus, solo].map((x) => [x.id, x]));
    expect(householdKey(host, byId)).toBe("h1");
    expect(householdKey(plus, byId)).toBe("h1");
    expect(householdKey(solo, byId)).toBe("c");
    const map = householdsOf([host, plus, solo], byId);
    expect(map.get("h1").map((x) => x.id)).toEqual(["a", "b"]);
    expect(map.get("c")).toHaveLength(1);
  });
  it("nomme un foyer comme sur une enveloppe", () => {
    expect(householdLabel([g("1", "Claire", "Morel"), g("2", "Pierre", "Morel")])).toBe("Claire & Pierre Morel");
    expect(householdLabel([g("1", "Claire", "Morel"), g("2", "Pierre", "Morel"), g("3", "Léo", "Morel"), g("4", "Zoé", "Morel")])).toBe("Famille Morel (4)");
    expect(householdLabel([g("1", "Claire", "Morel"), g("2", "Jean", "Petit")])).toBe("Claire Morel & Jean Petit");
    expect(householdLabel([g("1", "Claire", "Morel"), g("2", "", "")])).toBe("Claire Morel + 1");
    expect(householdLabel([g("1", "", "")])).toBe("Foyer sans nom");
  });
});

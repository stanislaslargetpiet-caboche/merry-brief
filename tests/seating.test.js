import { describe, expect, it } from "vitest";
import { autoSeat, defaultSeatingEvent, planFor, splitUnits } from "@/lib/dash/seating";

const g = (id, group_id, extra = {}) => ({ id, first_name: id, last_name: "", group_id, ...extra });

describe("plan de table", () => {
  it("choisit le dîner par défaut", () => {
    const events = [{ id: "1", name: "Cocktail" }, { id: "2", name: "Dîner" }, { id: "3", name: "Brunch" }];
    expect(defaultSeatingEvent(events).id).toBe("2");
    expect(defaultSeatingEvent([{ id: "9", name: "Soirée" }]).id).toBe("9");
    expect(defaultSeatingEvent([])).toBeNull();
  });

  it("reconstruit qui est à quelle table, dans l'ordre des places", () => {
    const data = {
      guests: [g("a"), g("b"), g("c")],
      tables: [{ id: "t1", event_id: "e", position: 1 }, { id: "t0", event_id: "e", position: 0 }, { id: "tx", event_id: "autre", position: 0 }],
      seating: [
        { event_id: "e", guest_id: "b", table_id: "t0", position: 1 },
        { event_id: "e", guest_id: "a", table_id: "t0", position: 0 },
        { event_id: "e", guest_id: "zombie", table_id: "t0", position: 2 },
      ],
    };
    const plan = planFor(data, "e");
    expect(plan.tables.map((t) => t.id)).toEqual(["t0", "t1"]);
    expect(plan.perTable.get("t0").map((x) => x.id)).toEqual(["a", "b"]);
    expect(plan.tableOf.get("a")).toBe("t0");
  });

  it("garde un invité avec ses accompagnants et remplit table après table", () => {
    const guests = [g("a", "g1"), g("b", "g1", { plus_one_of: "a" }), g("c", "g1", { plus_one_of: "a" }), g("d", "g2"), g("e", "g2")];
    const tables = [{ id: "t1", capacity: 2 }, { id: "t2", capacity: 4 }];
    const out = autoSeat(guests, tables, new Map(), ["g1", "g2"]);
    const at = Object.fromEntries(out.map((x) => [x.guest_id, x.table_id]));
    // l'unité de trois ne tient pas à la table de deux : elle va à la suivante, entière
    expect([at.a, at.b, at.c]).toEqual(["t2", "t2", "t2"]);
    // puis on finit de remplir cette table avant de passer à la suivante
    expect(at.d).toBe("t2");
    expect(at.e).toBe("t1");
    expect(out).toHaveLength(5);
  });

  it("signale un accompagnant séparé de son hôte", () => {
    const guests = [g("a", "g"), g("b", "g", { plus_one_of: "a" }), g("c", "g")];
    const tableOf = new Map([["a", "t1"], ["b", "t2"], ["c", "t1"]]);
    expect([...splitUnits(guests, tableOf)]).toEqual(["a"]);
  });
});

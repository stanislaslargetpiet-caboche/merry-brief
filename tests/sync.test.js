import { describe, expect, it } from "vitest";
import { applyChange } from "@/lib/dash/sync";

const base = () => ({
  guests: [{ id: "a", position: 0, plus_one_of: null }, { id: "b", position: 1, plus_one_of: "a" }],
  responses: [{ guest_id: "a", event_id: "e", status: "oui" }],
  seating: [{ event_id: "e", guest_id: "a", table_id: "t" }],
  tables: [{ id: "t", event_id: "e" }],
  events: [{ id: "e", position: 0 }],
  wedding: { id: "w" },
});

describe("direct entre organisateurs : fusion des changements reçus", () => {
  it("insère, met à jour, et garde l'ordre", () => {
    const d1 = applyChange(base(), "guests", { eventType: "INSERT", new: { id: "c", position: 0.5 } });
    expect(d1.guests.map((g) => g.id)).toEqual(["a", "c", "b"]);
    const d2 = applyChange(d1, "guests", { eventType: "UPDATE", new: { id: "c", position: 5, first_name: "Zoé" } });
    expect(d2.guests[2]).toMatchObject({ id: "c", first_name: "Zoé" });
  });
  it("ne fait pas revenir une ligne retirée ici quand son écho tardif arrive", () => {
    const d = applyChange(base(), "guests", { eventType: "UPDATE", new: { id: "zz", position: 9 } });
    expect(d.guests).toHaveLength(2);
    const r = applyChange(base(), "guest_responses", { eventType: "UPDATE", new: { guest_id: "x", event_id: "e", status: "non" } });
    expect(r.responses).toHaveLength(1);
  });
  it("supprime en cascade comme la base", () => {
    const d = applyChange(base(), "guests", { eventType: "DELETE", old: { id: "a" } });
    expect(d.guests).toEqual([]); // l'accompagnant part avec son hôte
    expect(d.responses).toEqual([]);
    const e = applyChange(base(), "events", { eventType: "DELETE", old: { id: "e" } });
    expect(e.tables).toEqual([]);
    expect(e.seating).toEqual([]);
  });
  it("supprime une ligne à clé composée", () => {
    const d = applyChange(base(), "seating", { eventType: "DELETE", old: { event_id: "e", guest_id: "a" } });
    expect(d.seating).toEqual([]);
  });
  it("ne rend rien de neuf quand rien ne change", () => {
    const b = base();
    expect(applyChange(b, "guest_responses", { eventType: "UPDATE", new: { guest_id: "a", event_id: "e", status: "oui" } })).toBe(b);
  });
});

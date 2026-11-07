import { describe, expect, it } from "vitest";
import { dayLabel, dePrefix, namesLine, teamChanges, timeLabel } from "@/lib/dash/activity";

const NOW = Date.parse("2026-11-07T15:00:00");
const at = (minutesAgo) => new Date(NOW - minutesAgo * 60000).toISOString();
const row = (id, minutesAgo, extra) => ({ id, created_at: at(minutesAgo), source: "organisateur", member_id: "lea", guest_id: id, guest_name: `Invité ${id}`, kind: "champ", field: "diet", ...extra });

describe("modifications de l'équipe", () => {
  it("ne garde que les autres organisateurs, sur 3 jours, sans le formulaire", () => {
    const items = teamChanges(
      [row("a", 5), row("b", 5, { member_id: "moi" }), row("c", 5, { source: "formulaire", member_id: null }), row("d", 4 * 24 * 60)],
      "moi",
      NOW,
    );
    expect(items.map((i) => i.id)).toEqual(["a"]);
  });

  it("regroupe une rafale de même nature, pas deux natures ni deux moments", () => {
    const items = teamChanges(
      [
        row("r1", 10, { kind: "reponse", event_id: "cocktail", field: null }),
        row("r2", 12, { kind: "reponse", event_id: "cocktail", field: null }),
        row("r3", 14, { kind: "reponse", event_id: "diner", field: null }),
        row("x1", 30, { kind: "ajout", field: null }),
        row("x2", 35, { kind: "ajout", field: null }),
        row("x3", 60, { kind: "ajout", field: null }),
      ],
      "moi",
      NOW,
    );
    expect(items.map((i) => i.guests.length)).toEqual([2, 1, 2, 1]);
    expect(items[0].at).toBe(at(10));
  });

  it("compte une fois un invité changé deux fois", () => {
    const items = teamChanges([row("a", 1, { new_value: "Sans gluten" }), row("a", 2, { id: "a2", new_value: "Vegan" })], "moi", NOW);
    expect(items).toHaveLength(1);
    expect(items[0].guests).toEqual([{ id: "a", name: "Invité a" }]);
  });

  it("écrit les libellés en français", () => {
    expect(dePrefix("Inès")).toBe("d'");
    expect(dePrefix("Claire")).toBe("de ");
    expect(namesLine([{ name: "A" }, { name: "B" }])).toBe("A et B");
    expect(namesLine([{ name: "A" }, { name: "B" }, { name: "C" }, { name: "D" }])).toBe("A, B et 2 autres");
    expect(timeLabel("2026-11-07T14:05:00")).toBe("14 h 05");
    expect(dayLabel("2026-11-07T09:00:00", new Date(NOW))).toBe("Aujourd'hui");
    expect(dayLabel("2026-11-06T22:00:00", new Date(NOW))).toBe("Hier");
    expect(dayLabel("2026-11-05T09:00:00", new Date(NOW))).toBe("Jeudi 5 novembre");
  });
});

import { describe, expect, it } from "vitest";
import { dayLabel, dePrefix, guestChanges, namesLine, teamChanges, timeLabel } from "@/lib/dash/activity";

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

describe("réponses au formulaire", () => {
  const form = (id, minutesAgo, extra) => row(id, minutesAgo, { source: "formulaire", member_id: null, guest_id: "claire", guest_name: "Claire Dubois", ...extra });

  it("fait un élément par envoi, l'accompagnant compris, sans les organisateurs ni au-delà de 3 jours", () => {
    const items = guestChanges(
      [
        form("r1", 2, { kind: "reponse", field: null, event_id: "diner", old_value: "attente", new_value: "oui" }),
        form("r2", 2, { kind: "reponse", field: null, event_id: "cocktail", old_value: "attente", new_value: "non" }),
        form("m1", 2, { field: "email" }),
        form("p1", 2, { kind: "ajout", field: null, guest_id: "paul", guest_name: "Paul Henry" }),
        form("p2", 2, { field: "phone", guest_id: "paul", guest_name: "Paul Henry" }),
        row("o1", 3),
        form("old", 4 * 24 * 60, { kind: "reponse", field: null, event_id: "diner", new_value: "non" }),
      ],
      [{ id: "claire" }, { id: "paul", plus_one_of: "claire" }],
      NOW,
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      guest_id: "claire",
      name: "Claire Dubois",
      added: false,
      fields: ["email"],
      plus: { id: "paul", name: "Paul Henry", added: true },
    });
    expect(items[0].answers).toEqual([
      { event_id: "diner", status: "oui" },
      { event_id: "cocktail", status: "non" },
    ]);
  });

  it("sépare deux envois éloignés et garde la dernière réponse par moment", () => {
    const items = guestChanges(
      [
        form("r2", 5, { kind: "reponse", field: null, event_id: "diner", new_value: "non" }),
        form("r1", 120, { kind: "reponse", field: null, event_id: "diner", new_value: "oui" }),
        form("a1", 121, { kind: "ajout", field: null }),
      ],
      [],
      NOW,
    );
    expect(items.map((i) => i.answers[0].status)).toEqual(["non", "oui"]);
    expect(items.map((i) => i.added)).toEqual([false, true]);
  });
});

import { describe, expect, it } from "vitest";
import { KPI_MAX, chosenKpis, kpiCatalog, kpiItems } from "@/lib/dash/model";

const data = (kpiPrefs) => ({
  kpiPrefs,
  wedding: { budget_total: 1000 },
  guests: [{ id: "a", address: "1 rue" }, { id: "b" }],
  responses: [{ guest_id: "a", event_id: "e", status: "oui" }, { guest_id: "b", event_id: "e", status: "attente" }],
  events: [{ id: "e", name: "Dîner" }],
  items: [], payments: [], tasks: [], members: [],
});

describe("indicateurs des invités", () => {
  it("propose cinq indicateurs au plus", () => {
    const all = kpiCatalog("invites").flatMap((f) => f.items);
    expect(all.length).toBeLessThanOrEqual(5);
  });
  it("suit le choix enregistré, ignore un indicateur disparu, et ne dépasse jamais la limite", () => {
    const chosen = chosenKpis(data({ invites: ["attente", "oui:old-event", "adresses", "invites", "oui", "non"] }), "invites");
    expect(chosen.map((d) => d.id)).toEqual(["attente", "adresses", "invites", "oui"]);
    expect(chosen.length).toBe(KPI_MAX);
  });
  it("calcule les valeurs de la liste", () => {
    const items = kpiItems(data({ invites: ["invites", "attente", "adresses"] }), "invites");
    expect(items.map((i) => [i.id, i.value])).toEqual([["invites", "2"], ["attente", "1"], ["adresses", "1"]]);
  });
});

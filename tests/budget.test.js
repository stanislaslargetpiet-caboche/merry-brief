import { describe, expect, it } from "vitest";
import { budgetTotals } from "@/lib/dash/model";

const data = (items, payments) => ({ wedding: { budget_total: 40000 }, items, payments, guests: [], responses: [], events: [], members: [] });

describe("budget : engagé et payé", () => {
  it("compte comme engagé ce qui est payé sans devis", () => {
    const t = budgetTotals(
      data(
        [{ id: "a", label: "Lieu", quote_amount: 11000, budgeted: 12000 }, { id: "b", label: "Beauté", quote_amount: null, budgeted: 500 }],
        [{ id: "p1", budget_item_id: "a", amount: 5000, paid_at: "2026-10-01" }, { id: "p2", budget_item_id: "b", amount: 100, paid_at: "2026-10-02" }],
      ),
    );
    expect(t.paid).toBe(5100);
    expect(t.engaged).toBe(11100);
    expect(t.paid).toBeLessThanOrEqual(t.engaged);
    expect(t.remaining).toBe(6000);
  });
  it("ne laisse jamais le payé dépasser l'engagé, même au-delà du devis", () => {
    const t = budgetTotals(data([{ id: "a", label: "Lieu", quote_amount: 1000, budgeted: null }], [{ id: "p", budget_item_id: "a", amount: 1200, paid_at: "2026-10-01" }]));
    expect(t.engaged).toBe(1200);
    expect(t.remaining).toBe(0);
  });
});

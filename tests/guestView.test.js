import { describe, expect, it } from "vitest";
import { readView, writeView } from "@/lib/dash/guestView";

describe("vue de la liste dans l'adresse", () => {
  it("fait l'aller-retour sans perte", () => {
    const view = { query: "dup", groups: ["g1", "g2"], status: "attente", moments: { e1: "oui", e2: "non" }, field: { fieldId: "f1", key: "navette" }, relance: "0", sort: { key: "ev:e1", dir: -1 } };
    expect(readView(writeView(view))).toEqual(view);
  });
  it("ignore ce qui n'est pas valide", () => {
    const v = readView("?st=bidon&m=e1:peutetre,e2:oui&rl=2&tri=name");
    expect(v.status).toBeNull();
    expect(v.moments).toEqual({ e2: "oui" });
    expect(v.relance).toBeNull();
    expect(v.sort).toEqual({ key: "name", dir: 1 });
  });
});

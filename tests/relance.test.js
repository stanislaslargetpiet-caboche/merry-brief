import { describe, expect, it } from "vitest";
import { mailHref, pendingGuests, waDigits, waHref } from "@/lib/dash/relance";

describe("relances : liens", () => {
  it("met un numéro français au format international", () => {
    expect(waDigits("06 12 34 56 78")).toBe("33612345678");
    expect(waDigits("+33 6 12 34 56 78")).toBe("33612345678");
    expect(waDigits("0033612345678")).toBe("33612345678");
    expect(waDigits("12")).toBe("");
  });
  it("encode le texte des liens WhatsApp et mail", () => {
    expect(waHref("0612345678", "Coucou & à bientôt ?")).toBe("https://wa.me/33612345678?text=Coucou%20%26%20%C3%A0%20bient%C3%B4t%20%3F");
    expect(mailHref(["a@x.fr", "b@x.fr"], "Objet", "Corps", { bcc: true })).toBe("mailto:?bcc=a%40x.fr%2Cb%40x.fr&subject=Objet&body=Corps");
    expect(mailHref([], "Objet", "Corps")).toBe("");
  });
  it("ne relance que ceux qui n'ont pas répondu, sans leurs accompagnants", () => {
    const guests = [{ id: "a" }, { id: "b", plus_one_of: "a" }, { id: "c" }];
    const idx = new Map([["a", { e: "attente" }], ["b", { e: "attente" }], ["c", { e: "oui" }]]);
    expect(pendingGuests(guests, idx, [{ id: "e" }]).map((g) => g.id)).toEqual(["a"]);
  });
});

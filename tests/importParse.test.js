import { describe, expect, it } from "vitest";
import { parseText, rsvpFromCell, statusAttendance } from "@/lib/dash/importParse";

describe("import : cellules de présence", () => {
  it("lit les réponses et les invitations", () => {
    expect(rsvpFromCell("Vient")).toBe("oui");
    expect(rsvpFromCell("pas là")).toBe("non");
    expect(rsvpFromCell("x")).toBe("attente");
    expect(rsvpFromCell("Non invité")).toBe("non_invite");
    expect(rsvpFromCell("non")).toBe("non_invite");
    expect(rsvpFromCell("")).toBeNull();
    expect(rsvpFromCell("peut-être")).toBeNull();
  });
  it("déplie un statut en deux moments", () => {
    expect(statusAttendance("diner")).toEqual({ Dîner: "Invité", Cocktail: "Invité" });
    expect(statusAttendance("cocktail")).toEqual({ Dîner: "Non invité", Cocktail: "Invité" });
    expect(statusAttendance("tbc")).toEqual({ Dîner: "", Cocktail: "" });
    expect(statusAttendance("salade")).toBeNull();
  });
});

describe("import : texte collé", () => {
  it("lit un tableau avec en-tête, quel que soit le séparateur", () => {
    const out = parseText("Prénom;Nom;Email\nLéa;Dupont;lea@example.com\nPaul;Martin;");
    expect(out.guests.map((x) => [x.first_name, x.last_name, x.email || ""])).toEqual([
      ["Léa", "Dupont", "lea@example.com"],
      ["Paul", "Martin", ""],
    ]);
  });
  it("reconnaît la colonne mail, avec ou sans tiret", () => {
    for (const head of ["E-mail", "Email", "Mail", "Courriel", "Adresse mail", "Adresse e-mail"]) {
      const out = parseText(`Prénom;Nom;${head}\nLéa;Dupont;lea@example.com\nPaul;Martin;paul@example.com`);
      expect(out.guests[0].email).toBe("lea@example.com");
      expect(out.extraColumns).toEqual([]);
    }
  });
  it("lit une liste libre, une personne par ligne", () => {
    const out = parseText("Léa Dupont\nPaul Martin");
    expect(out.guests).toHaveLength(2);
    expect(out.guests[0].first_name).toBe("Léa");
  });
  it("ne renvoie rien pour du vide", () => {
    expect(parseText("  \n\n")).toEqual({ guests: [], extraColumns: [] });
  });
});

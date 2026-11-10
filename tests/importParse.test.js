import { describe, expect, it } from "vitest";
import { parseText, rsvpFromCell, statusAttendance, unreadRows, unreadText, withUnreadRows } from "@/lib/dash/importParse";

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

describe("import : lignes du fichier sans invité", () => {
  const rows = [
    ["AMIS DE CÔME", "NB", "Statut"],
    ["Prénom", "Nom", "Nb"],
    ["Gab & Zazou", "de Miribel", "2"],
    ["Pierre et Marie-Pia", "COMMU", "2"],
    ["Jean", "Commu", "1"],
    ["Tiph G", "", "1"],
    ["Côté Astrid"],
    ["Total", "", "42"],
    ["", "", "12"],
    ["Famille Leroy (4)"],
  ];
  const read = [
    { first_name: "Jean", last_name: "Commu", group: "Amis de Côme" },
    { first_name: "Tiph G", last_name: "", group: "Amis de Côme" },
    { first_name: "", last_name: "", plus_one_of: "Jean Commu" },
  ];

  it("retrouve les lignes que la lecture a sautées, sans compter titres, en-têtes et totaux", () => {
    const out = unreadRows(rows, read, ["Amis de Astrid"]);
    expect(out.map((r) => r.cells[0])).toEqual(["Gab & Zazou", "Pierre et Marie-Pia", "Famille Leroy (4)"]);
  });

  it("une ligne lue sous un autre nom de famille reste à vérifier, pas un homonyme de prénom", () => {
    const out = unreadRows([["Jean", "Martin"]], [{ first_name: "Jean", last_name: "Commu" }]);
    expect(out).toHaveLength(1);
  });

  it("ajoute ces lignes à vérifier, avec le texte d'origine", () => {
    const { guests, unread } = withUnreadRows(read, rows, ["Amis de Astrid"]);
    expect(unread).toBe(3);
    const [gab, pierre, leroy] = guests.slice(-3);
    expect(gab).toMatchObject({ first_name: "Gab & Zazou de Miribel", last_name: "", uncertain: true, unread: true });
    expect(pierre.first_name).toBe("Pierre et Marie-Pia Commu");
    expect(pierre.note).toContain("COMMU");
    expect(leroy).toMatchObject({ first_name: "Famille", last_name: "Leroy (4)" });
    expect(unreadText(3)).toContain("3 lignes");
  });

  it("ne signale rien quand tout est lu", () => {
    const all = [...read, { first_name: "Gab", last_name: "de Miribel" }, { first_name: "Pierre", last_name: "Commu" }, { first_name: "", last_name: "Leroy" }];
    expect(withUnreadRows(all, rows, ["Amis de Astrid"]).unread).toBe(0);
  });
});

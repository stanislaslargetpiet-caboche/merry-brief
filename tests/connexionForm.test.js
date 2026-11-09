import { describe, expect, it } from "vitest";
import { formError } from "@/lib/connexionForm";

describe("formError", () => {
  it("laisse passer un formulaire complet", () => {
    expect(formError("signup", { firstName: "Léa", email: "lea@exemple.fr", password: "12345678" })).toBe("");
    expect(formError("login", { email: " lea@exemple.fr ", password: "court" })).toBe("");
    expect(formError("forgot", { email: "lea@exemple.fr" })).toBe("");
    expect(formError("reset", { password: "12345678" })).toBe("");
  });
  it("nomme le champ qui bloque l'inscription", () => {
    expect(formError("signup", { firstName: " ", email: "lea@exemple.fr", password: "12345678" })).toBe("firstNameMissing");
    expect(formError("signup", { firstName: "Léa", email: "lea@exemple", password: "12345678" })).toBe("emailInvalid");
    expect(formError("signup", { firstName: "Léa", email: "lea@exemple.fr", password: "" })).toBe("passwordMissing");
    expect(formError("signup", { firstName: "Léa", email: "lea@exemple.fr", password: "1234567" })).toBe("passwordTooShort");
    expect(formError("reset", { password: "1234567" })).toBe("passwordTooShort");
  });
});

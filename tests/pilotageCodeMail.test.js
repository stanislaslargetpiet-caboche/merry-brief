import { describe, expect, it } from "vitest";
import { codeMail } from "@/lib/server/pilotage/codeMail";

describe("codeMail (code de connexion au pilotage)", () => {
  it("met le code dans l'objet et dans le corps, en tutoiement", () => {
    const { subject, text, html } = codeMail({ token: "482913" });
    expect(subject).toBe("482913 est ton code Merry");
    expect(html).toContain("482913");
    expect(html).toContain("Voici ton code.");
    expect(html).toContain("Saisis-le pour te connecter à Merry.");
    expect(html).toContain("Ce code expire dans 10 minutes.");
    expect(text).toContain("482913");
    expect(html).not.toMatch(/\bvotre\b|\bvous\b/i);
  });

  it("reprend la carte pistache des mails Merry, pas la pastille jaune", () => {
    const { html } = codeMail({ token: "111111" });
    expect(html).toContain("#bfe9a6");
    expect(html).not.toContain("#fff700");
    expect(html).toContain("merry.png");
  });
});

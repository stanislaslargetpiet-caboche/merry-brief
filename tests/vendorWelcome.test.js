import { describe, expect, it } from "vitest";
import { vendorWelcomeMail } from "../lib/server/vendorWelcome.js";

describe("mail de bienvenue prestataire", () => {
  const mail = vendorWelcomeMail({ vendorName: "Le Mas", credits: 100, origin: "https://app.withmerry.com", rdv: "https://calendly.com/x" });

  it("garde l'objet et vouvoie", () => {
    expect(mail.subject).toBe("Bienvenue sur Merry, Le Mas");
    expect(mail.text).toContain("Votre fiche est prête");
    expect(mail.text).not.toMatch(/\bta fiche\b|\btes crédits\b/i);
  });

  it("porte le mot signé de Stan et le lien de rendez-vous", () => {
    expect(mail.text).toContain("Je suis Stan, fondateur de Merry");
    expect(mail.text).toContain("Prendre rendez-vous : https://calendly.com/x");
    expect(mail.html).toContain('href="https://calendly.com/x"');
    expect(mail.html).toContain("Fondateur de Merry");
  });

  it("n'affiche pas de bloc crédits sans crédits", () => {
    const sans = vendorWelcomeMail({ vendorName: "", credits: 0, origin: "https://app.withmerry.com" });
    expect(sans.subject).toBe("Bienvenue sur Merry");
    expect(sans.html).not.toContain("crédits offerts");
  });
});

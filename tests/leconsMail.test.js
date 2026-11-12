import { describe, expect, it } from "vitest";
import { demandesEnvoyeesMail } from "../lib/server/demandeCoupleMail.js";
import { apresImportMail, formulairePublieMail } from "../lib/server/formulaireLeconsMail.js";
import { lieuSigneMail } from "../lib/server/lieuSigneMail.js";

describe("demandesEnvoyeesMail (V55)", () => {
  it("accorde le titre et le verbe à une seule demande", () => {
    const mail = demandesEnvoyeesMail({ names: ["Le Mas de la Source"], dashboardLink: "https://x/dashboard" });
    expect(mail.subject).toBe("Ta demande est partie");
    expect(mail.text).toContain("Le Mas de la Source a reçu ton message.");
  });

  it("énumère plusieurs prestataires et accorde le pluriel", () => {
    const mail = demandesEnvoyeesMail({ names: ["Le Mas", "Les Oliviers", "La Bastide"], dashboardLink: "https://x/dashboard" });
    expect(mail.subject).toBe("Tes 3 demandes sont parties");
    expect(mail.text).toContain("Le Mas, Les Oliviers et La Bastide ont reçu ton message.");
    expect(mail.html).toContain("Le Mas");
    expect(mail.html).toContain("La Bastide");
  });
});

describe("formulairePublieMail (V60)", () => {
  it("renvoie vers le lien du formulaire", () => {
    const mail = formulairePublieMail({ formLink: "https://x/dashboard/invites/formulaire" });
    expect(mail.subject).toBe("Ton formulaire est en ligne");
    expect(mail.html).toContain("https://x/dashboard/invites/formulaire");
  });
});

describe("apresImportMail (V59)", () => {
  it("accorde le singulier à un seul invité, sans ligne de doublons", () => {
    const mail = apresImportMail({ guestCount: 1, duplicates: 0, formLink: "https://x/f" });
    expect(mail.subject).toBe("1 invité dans ta liste");
    expect(mail.text).toContain("1 invité est dans ta liste.");
    expect(mail.text).not.toContain("doublon");
  });

  it("compte les doublons au pluriel", () => {
    const mail = apresImportMail({ guestCount: 42, duplicates: 3, formLink: "https://x/f" });
    expect(mail.subject).toBe("42 invités dans ta liste");
    expect(mail.text).toContain("dont 3 doublons à vérifier");
  });
});

describe("lieuSigneMail (V64)", () => {
  it("nomme le lieu signé et liste les traiteurs suggérés", () => {
    const mail = lieuSigneMail({ lieuName: "Le Mas de la Source", traiteurs: [{ name: "Maison Ravel", city: "Apt" }], link: "https://x/dashboard/prestataires" });
    expect(mail.subject).toBe("Le lieu est réservé");
    expect(mail.text).toContain("Le Mas de la Source est noté comme signé");
    expect(mail.html).toContain("Maison Ravel");
  });

  it("reste correct sans suggestion de traiteur", () => {
    const mail = lieuSigneMail({ lieuName: "Le Mas", traiteurs: [], link: "https://x/dashboard/prestataires" });
    expect(mail.text).not.toContain("Quelques traiteurs");
  });
});

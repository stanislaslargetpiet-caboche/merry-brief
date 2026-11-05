import { describe, expect, it } from "vitest";
import { cleanPhone, validPhone, validateDemande } from "@/lib/server/proDemande";
import { demandeLines, demandeMail } from "@/lib/server/demandeMail";
import { buildSante } from "@/lib/pilotage/sante";
import { demandeRecueMail, demandeRefuseeMail } from "@/lib/server/demandeVendorMails";

const account = { email: "Camille@Exemple.fr ", password: "motdepasse", phone: "06 12 34 56 78" };
const both = { hasEmail: true, hasPhone: true };

describe("validateDemande", () => {
  it("accepte deux coordonnées confirmées et un compte complet", () => {
    const r = validateDemande({ coords: { email: { choice: "oui" }, phone: { choice: "oui" } }, account }, both, false);
    expect(r.ok).toBe(true);
    expect(r.value.email).toEqual({ ok: true, choice: "oui", given: null });
    expect(r.value.account).toMatchObject({ email: "camille@exemple.fr", phone: "0612345678" });
  });

  it("« non » exige la bonne coordonnée, valide", () => {
    const coords = (e) => ({ email: { choice: "non", given: e }, phone: { choice: "oui" } });
    expect(validateDemande({ coords: coords(""), account }, both, false)).toEqual({ ok: false, error: "coords_email" });
    expect(validateDemande({ coords: coords("pas-un-mail"), account }, both, false)).toEqual({ ok: false, error: "coords_email" });
    const r = validateDemande({ coords: coords("Nouveau@Exemple.fr"), account }, both, false);
    expect(r.value.email).toEqual({ ok: true, choice: "non", given: "nouveau@exemple.fr" });
  });

  it("une coordonnée qui n'a pas été confirmée bloque", () => {
    expect(validateDemande({ coords: { email: { choice: "oui" }, phone: {} }, account }, both, false)).toEqual({ ok: false, error: "coords_phone" });
  });

  it("une fiche sans coordonnée exige la saisie, sans choix", () => {
    const none = { hasEmail: false, hasPhone: false };
    const r = validateDemande({ coords: { email: { choice: "oui", given: "contact@lieu.fr" }, phone: { given: "04 90 00 00 00" } }, account }, none, false);
    expect(r.ok).toBe(true);
    expect(r.value.email).toEqual({ ok: true, choice: null, given: "contact@lieu.fr" });
    expect(r.value.phone.given).toBe("0490000000");
    expect(validateDemande({ coords: { email: {}, phone: {} }, account }, none, false)).toEqual({ ok: false, error: "coords_email" });
  });

  it("« oui » ignore une saisie restée dans le champ", () => {
    const r = validateDemande({ coords: { email: { choice: "oui", given: "reste@la.fr" }, phone: { choice: "oui", given: "0600000000" } }, account }, both, false);
    expect(r.value.email.given).toBeNull();
    expect(r.value.phone.given).toBeNull();
  });

  it("le téléphone du compte est obligatoire, le mot de passe et le mail seulement hors connexion", () => {
    const coords = { email: { choice: "oui" }, phone: { choice: "oui" } };
    expect(validateDemande({ coords, account: { ...account, phone: "12" } }, both, false)).toEqual({ ok: false, error: "account_phone" });
    expect(validateDemande({ coords, account: { ...account, email: "x" } }, both, false)).toEqual({ ok: false, error: "account_email" });
    expect(validateDemande({ coords, account: { ...account, password: "court" } }, both, false)).toEqual({ ok: false, error: "bad_password" });
    expect(validateDemande({ coords, account: { phone: "06 12 34 56 78" } }, both, true).ok).toBe(true);
  });
});

describe("téléphone", () => {
  it("tolère espaces, points et tirets, refuse le trop court", () => {
    expect(cleanPhone("06.12-34 56 78")).toBe("0612345678");
    expect(validPhone("+33 6 12 34 56 78")).toBe(true);
    expect(validPhone("0612")).toBe(false);
    expect(validPhone("abc")).toBe(false);
  });
});

describe("mail d'alerte", () => {
  const vendor = { name: "Le Clos des Amandiers", city: "Lourmarin", category: "Lieu de réception" };
  const claim = { fiche_email: "contact@closdesamandiers.fr", fiche_phone: "06 12 34 56 78", email_choice: "oui", email_given: null, phone_choice: "non", phone_given: "0698765432", account_email: "camille@exemple.fr", account_phone: "0698765432" };

  it("dit ce qui a été confirmé, ce qui a été changé et qui contacter", () => {
    const lines = Object.fromEntries(demandeLines({ vendor, claim }));
    expect(lines["Email de la fiche"]).toContain("confirmé par le demandeur");
    expect(lines["Téléphone de la fiche"]).toContain("06 12 34 56 78");
    expect(lines["Téléphone de la fiche"]).toContain("0698765432");
    const mail = demandeMail({ vendor, claim, origin: "https://app.withmerry.com" });
    expect(mail.subject).toBe("Demande d'accès : Le Clos des Amandiers (coordonnées changées)");
    expect(mail.text).toContain("coordonnées d'origine");
    expect(mail.text).toContain("https://app.withmerry.com/pilotage#demandes");
  });

  it("sans changement, pas de mention « changées »", () => {
    const mail = demandeMail({ vendor, claim: { ...claim, phone_choice: "oui", phone_given: null }, origin: "https://app.withmerry.com" });
    expect(mail.subject).toBe("Demande d'accès : Le Clos des Amandiers");
  });

  it("échappe le HTML d'un nom de fiche", () => {
    const mail = demandeMail({ vendor: { ...vendor, name: "<b>X</b>" }, claim, origin: "https://app.withmerry.com" });
    expect(mail.html).toContain("&lt;b&gt;X&lt;/b&gt;");
  });
});

describe("Santé : demandes en attente", () => {
  const base = { supabase: null, posthog: null, resend: null, vercel: null, google: null, seo: null };
  it("signale une demande en attente, en alerte au bout d'une heure", () => {
    const recent = { disponible: true, en_attente: [{ cree_le: new Date(Date.now() - 10 * 60000).toISOString() }] };
    const old = { disponible: true, en_attente: [{ cree_le: new Date(Date.now() - 3 * 3600000).toISOString() }] };
    expect(buildSante({ ...base, demandes: recent }, 7)[0]).toMatchObject({ tone: "warn" });
    expect(buildSante({ ...base, demandes: old }, 7)[0]).toMatchObject({ tone: "bad" });
    expect(buildSante({ ...base, demandes: { disponible: true, en_attente: [] } }, 7).some((s) => /demande/.test(s.titre))).toBe(false);
  });
});

describe("mails au demandeur", () => {
  it("accusé de réception : nom de la fiche, délai d'une heure", () => {
    const m = demandeRecueMail({ vendorName: "Château La Tour Vaucros" });
    expect(m.subject).toBe("Ta demande est bien reçue");
    expect(m.text).toContain("Château La Tour Vaucros");
    expect(m.text).toContain("dans l'heure");
  });
  it("refus : explique, donne un moyen de répondre, échappe le HTML", () => {
    const m = demandeRefuseeMail({ vendorName: "<i>X</i>" });
    expect(m.subject).toBe("Ta demande d'accès n'a pas pu être validée");
    expect(m.text).toContain("SIRET");
    expect(m.html).toContain("&lt;i&gt;X&lt;/i&gt;");
    expect(m.html).not.toContain("<i>X</i>");
  });
});

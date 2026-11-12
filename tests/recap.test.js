import { describe, expect, it } from "vitest";
import { echeance, fonctionAEssayer, joursRestants, lignes, recapMail } from "../lib/server/recapMail.js";
import { fenetre, isSunday, semaineDe } from "../lib/server/recapJob.js";

const origin = "https://app.withmerry.com";
const unsub = "https://app.withmerry.com/desinscription?e=x&t=y&k=nouveautes";
const vide = { reponses: [], ajouts: [], prestataires: [], messages: [], signes: [], devis: 0, taches: 0 };
const base = { origin, unsub, firstName: "Léa", weddingDate: "2027-09-12", today: "2026-11-15", budgetTotal: 25000, engage: 8400, enAttente: 33, oui: 7, guestCount: 42, usage: {} };

describe("phrases du récap", () => {
  it("compte les jours de date à date", () => {
    expect(joursRestants("2027-09-12", "2026-11-15")).toBe(301);
    expect(joursRestants("2026-11-14", "2026-11-14")).toBeNull();
    expect(joursRestants(null, "2026-11-14")).toBeNull();
  });
  it("situe une échéance", () => {
    expect(echeance("2026-11-10", "2026-11-14")).toBe("en retard");
    expect(echeance("2026-11-18", "2026-11-14")).toBe("cette semaine");
    expect(echeance("2026-12-20", "2026-11-14")).toBe("prévu en décembre");
    expect(echeance("2027-03-01", "2026-11-14")).toBe("prévu en mars 2027");
    expect(echeance(null, "2026-11-14")).toBe("");
  });
  it("dit ce qui a bougé, à la deuxième personne pour ses propres ajouts", () => {
    const l = lignes({
      ...vide,
      reponses: [{ name: "A", comes: true }, { name: "B", comes: false }, { name: "C", comes: true }],
      ajouts: [{ author: "Thomas", count: 12, moi: false }, { author: "Léa", count: 1, moi: true }],
      prestataires: [{ name: "Maison Ravel" }],
      messages: [{ name: "Atelier Lumen", count: 2 }],
      signes: [{ label: "Lieu", amount: 8400 }],
    });
    expect(l).toEqual([
      ["3 invités ont répondu au formulaire", "2 viennent"],
      ["Thomas a ajouté 12 invités", ""],
      ["Tu as ajouté un invité", ""],
      ["Maison Ravel a répondu à ta demande", ""],
      ["Atelier Lumen t’a écrit", "2 messages"],
      ["Lieu : devis signé", "8 400 €"],
    ]);
  });
  it("accorde les ajouts des parents", () => {
    const l = lignes({ ...vide, ajouts: [{ author: "Parents de Léa", count: 39, moi: false }, { author: "Parents de Thomas", count: 2, moi: false }] }, "Léa");
    expect(l).toEqual([["Tes parents ont ajouté 39 invités", ""], ["Les parents de Thomas ont ajouté 2 invités", ""]]);
  });
  it("propose la première fonction pas encore essayée, dans l'ordre des anciens mails du samedi", () => {
    expect(fonctionAEssayer({}).cle).toBe("budget");
    expect(fonctionAEssayer({ budget: true, invites: true }).cle).toBe("formulaire");
    const plan = fonctionAEssayer({ budget: true, invites: true, formulaire: true, site: true, documents: true, prestataires: true }, 7);
    expect(plan.texte).toContain("les 7 invités qui ont déjà dit oui");
    expect(fonctionAEssayer({ budget: true, invites: true, formulaire: true, site: true, documents: true, prestataires: true, plan: true })).toBeNull();
  });
});

describe("recapMail", () => {
  it("V65 : la semaine, les trois choses à faire et une fonction à essayer", () => {
    const mail = recapMail({
      ...base,
      semaine: { ...vide, reponses: Array.from({ length: 9 }, (_, i) => ({ name: `I${i}`, comes: i < 7 })), devis: 2 },
      taches: [{ title: "Choisir le traiteur", due_date: "2026-11-18" }, { title: "Choisir le photographe", due_date: "2026-12-05" }, { title: "Réserver les alliances", due_date: null }, { title: "En trop", due_date: null }],
      usage: { budget: true, invites: true, formulaire: true, site: true, documents: true, prestataires: true },
    });
    expect(mail.variante).toBe("semaine");
    expect(mail.subject).toBe("Ta semaine : 9 réponses d’invités et 2 devis");
    expect(mail.text).toContain("Bonjour Léa, plus que 301 jours avant le 12 septembre 2027. Voici ce qui a avancé depuis dimanche dernier, puis les trois choses à faire ensuite.");
    expect(mail.text).toContain("Réponses : 9 (33 en attente)");
    expect(mail.text).toContain("Engagé : 8 400 € (sur 25 000 €)");
    expect(mail.text).toContain("- Choisir le traiteur (cette semaine)");
    expect(mail.text).not.toContain("En trop");
    expect(mail.text).toContain("Pas encore essayé : Le plan de table.");
    expect(mail.html).toContain("utm_campaign=recap-dimanche");
    expect(mail.html).toContain("Ne plus recevoir le récap du dimanche");
    expect(mail.html).toContain("8&nbsp;400&nbsp;€");
  });
  it("V65 bis : rien n'a bougé, une liste presque vide passe en premier", () => {
    const mail = recapMail({ ...base, semaine: vide, guestCount: 0, taches: [{ title: "Choisir le lieu", due_date: null }] });
    expect(mail.variante).toBe("calme");
    expect(mail.subject).toBe("Une seule chose cette semaine");
    expect(mail.text).toContain("Bonjour Léa, rien n’a bougé sur ton mariage depuis dimanche dernier.");
    expect(mail.text).toContain("Plus que 301 jours avant le 12 septembre 2027 : tu as le temps");
    expect(mail.text).toContain("Ajouter tes premiers invités (10 minutes)");
    expect(recapMail({ ...base, semaine: { ...vide, ajouts: [{ author: "Thomas", count: 4, moi: false }] }, taches: [] }).subject).toBe("Ta semaine : 4 invités ajoutés");
    expect(mail.text).toContain("/dashboard/invites/importer?utm_source=mail");
  });
  it("V65 bis : liste remplie, la prochaine tâche du rétroplanning", () => {
    const mail = recapMail({ ...base, semaine: vide, weddingDate: null, taches: [{ title: "Choisir le lieu", due_date: "2026-11-01" }] });
    expect(mail.text).toContain("Choisir le lieu (en retard)");
    expect(mail.text).toContain("Ouvrir le rétroplanning");
    expect(mail.text).not.toContain("jours avant");
  });
  it("rien à dire : semaine calme, liste remplie et plus rien à faire", () => {
    expect(recapMail({ ...base, semaine: vide, taches: [] })).toBeNull();
  });
});

describe("semaine du récap", () => {
  it("va du dimanche précédent 20 h à ce dimanche 20 h, heure de Paris", () => {
    const w = fenetre(new Date("2026-11-15T19:05:00Z"));
    expect(w.today).toBe("2026-11-15");
    expect(w.end.toISOString()).toBe("2026-11-15T19:00:00.000Z");
    expect(w.start.toISOString()).toBe("2026-11-08T19:00:00.000Z");
    expect(w.startDate).toBe("2026-11-08");
    expect(isSunday(new Date("2026-11-15T19:05:00Z"))).toBe(true);
    expect(isSunday(new Date("2026-11-14T19:05:00Z"))).toBe(false);
  });
  it("garde les devis signés dans la semaine et nomme ses propres ajouts", () => {
    const w = fenetre(new Date("2026-11-15T19:05:00Z"));
    const lot = { items: [{ label: "Lieu", quote_amount: 8400, quote_signed_at: "2026-11-10" }, { label: "Traiteur", quote_amount: 6000, quote_signed_at: "2026-10-01" }] };
    const activity = { reponses: [], ajoutsParEquipe: [{ memberId: "m1", author: "Léa", count: 3 }], prestataires: [], messages: [] };
    const s = semaineDe(activity, lot, { devis: 1, tachesFaites: 2 }, { id: "m1" }, w);
    expect(s.signes).toEqual([{ label: "Lieu", amount: 8400 }]);
    expect(s.ajouts).toEqual([{ author: "Léa", count: 3, moi: true }]);
    expect(semaineDe(undefined, { items: [] }, { devis: 0, tachesFaites: 0 }, { id: "m1" }, w).reponses).toEqual([]);
  });
});

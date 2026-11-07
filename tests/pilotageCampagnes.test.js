import { describe, expect, it } from "vitest";
import { buildCampagnes } from "@/lib/server/pilotage/campagnes";
import { isCampagne } from "@/lib/server/pilotage/resend";
import { SUBJECT } from "@/lib/server/nouveautesMail";

const ISSUES = [
  { numero: 1, samedi: "2026-11-07", titre: ["Un.", "Deux."] },
  { numero: 2, samedi: "2026-11-14", titre: ["Trois."] },
];
const DEPART = "2026-11-07T07:00:10Z";
const ev = (email_id, type, occurred_at = DEPART, extra = {}) => ({ email_id, type, occurred_at, ...extra });
const reserves = [
  { key: "nouveautes:1:a@x.fr", sent_at: "2026-11-06T17:23:54Z" },
  { key: "nouveautes:1:b@x.fr", sent_at: "2026-11-06T17:23:55Z" },
];
const now = Date.parse("2026-11-07T12:00:00Z");
const build = (events, opts = {}) => buildCampagnes({ issues: ISSUES, events, reserves, optouts: [], days: 7, now, ...opts });

describe("campagnes emails", () => {
  it("rattache au numéro les mails partis à son heure et écarte les tests", () => {
    const c = build([
      ev("test", "email.sent", "2026-11-06T15:05:18Z"),
      ev("a", "email.sent"),
      ev("a", "email.delivered"),
      ev("a", "email.opened", "2026-11-07T09:00:00Z"),
      ev("a", "email.clicked", "2026-11-07T09:01:00Z", { link: "https://app.withmerry.com/dashboard/budget?utm=1" }),
      ev("b", "email.sent"),
      ev("b", "email.bounced", DEPART, { to_email: "b@x.fr", bounce_type: "Permanent" }),
    ]);
    expect(c.periode).toMatchObject({ envoyes: 2, delivres: 1, ouverts: 1, cliques: 1, echecs: 1 });
    expect(c.numeros[1]).toMatchObject({ numero: 1, statut: "Parti", prevus: 2, envoyes: 2 });
    expect(c.liens).toEqual([{ label: "/dashboard/budget", n: 1 }]);
    expect(c.problemes[0]).toMatchObject({ numero: 1, a: "b@x.fr", etat: "Rebond", detail: "Permanent" });
    expect(c.ouvertures_suivies).toBe(true);
  });

  it("ne dit pas parti ce qui attend chez Resend", () => {
    const c = build([], { now: Date.parse("2026-11-06T20:00:00Z") });
    expect(c.numeros[1].statut).toBe("Programmé");
    expect(c.numeros[0].statut).toBe("À envoyer");
    expect(c.ouvertures_suivies).toBe(false);
  });

  it("signale un départ passé sans aucun retour du webhook", () => {
    expect(build([]).numeros[1].statut).toBe("Sans retour");
  });

  it("suit la période choisie et la compare à la précédente", () => {
    const events = [ev("a", "email.sent")];
    expect(build(events, { days: 1 }).periode.envoyes).toBe(1);
    expect(build(events, { days: 1, now: Date.parse("2026-11-08T12:00:00Z") })).toMatchObject({ periode: { envoyes: 0 }, precedente: { envoyes: 1 } });
    expect(build(events).par_jour).toEqual([["2026-11-07", 1]]);
  });

  it("compte les désinscriptions jusqu'au numéro suivant", () => {
    const c = build([ev("a", "email.sent")], { optouts: [{ created_at: "2026-11-07T10:00:00Z" }, { created_at: "2026-10-20T10:00:00Z" }] });
    expect(c.numeros[1].desinscrits).toBe(1);
    expect(c.numeros[0].desinscrits).toBeNull();
    expect(c.periode.desinscrits).toBe(1);
  });

  it("reconnaît l'objet du mail du samedi", () => {
    expect(isCampagne(SUBJECT)).toBe(true);
    expect(isCampagne("Bienvenue sur Merry")).toBe(false);
  });
});

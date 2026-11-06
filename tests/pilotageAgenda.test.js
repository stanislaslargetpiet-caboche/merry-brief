import { describe, expect, it } from "vitest";
import { meetingsExterieurs, nomInvite } from "@/lib/pilotage/agenda";
import { validatePublication } from "@/lib/pilotage/items";

const JOUR = "2026-11-05";
const moi = { email: "stan@example.com", self: true, responseStatus: "accepted" };
const ev = (x) => ({ id: "e", status: "confirmed", start: { dateTime: "2026-11-05T16:00:00+01:00" }, attendees: [moi, { email: "maxime@duodeal.com" }], ...x });

describe("meetingsExterieurs", () => {
  it("garde l'heure et la personne", () => {
    expect(meetingsExterieurs([ev({ start: { dateTime: "2026-11-05T17:30:00+01:00" } })], JOUR)).toEqual([{ id: "e", heure: "17 h 30", personnes: "Maxime" }]);
  });
  it("écarte les événements sans autre invité, et les salles ne comptent pas", () => {
    expect(meetingsExterieurs([ev({ attendees: undefined }), ev({ attendees: [moi] }), ev({ attendees: [moi, { email: "salle@resource.calendar.google.com", resource: true }] })], JOUR)).toEqual([]);
  });
  it("écarte le perso, les annulés, les refusés, la journée entière et les autres jours", () => {
    const refuse = ev({ attendees: [{ ...moi, responseStatus: "declined" }, { email: "a@b.fr" }] });
    const entier = ev({ start: { date: JOUR } });
    const demain = ev({ start: { dateTime: "2026-11-06T00:30:00+01:00" } });
    expect(meetingsExterieurs([ev({ colorId: "11" }), ev({ status: "cancelled" }), refuse, entier, demain], JOUR)).toEqual([]);
  });
  it("reconnaît le jour à Paris, pas en UTC", () => {
    expect(meetingsExterieurs([ev({ start: { dateTime: "2026-11-04T23:30:00Z" } })], JOUR)).toHaveLength(1);
  });
  it("reconnaît l'agenda par son adresse et trie par heure", () => {
    const tot = ev({ id: "tot", start: { dateTime: "2026-11-05T09:00:00+01:00" }, attendees: [{ email: "Stan@example.com" }, { email: "a@b.fr" }] });
    expect(meetingsExterieurs([ev(), tot], JOUR, "stan@example.com").map((m) => m.heure)).toEqual(["9 h", "16 h"]);
  });
  it("résume au-delà de trois personnes", () => {
    const attendees = [moi, ...["a", "b", "c", "d", "e"].map((x) => ({ email: `${x}@b.fr` }))];
    expect(meetingsExterieurs([ev({ attendees })], JOUR)[0].personnes).toBe("A, B, C, +2");
  });
});

describe("nomInvite", () => {
  it("préfère le nom affiché, sinon lit l'adresse", () => {
    expect(nomInvite({ displayName: "Adèle", email: "a@b.fr" })).toBe("Adèle");
    expect(nomInvite({ email: "lucas.berger@spark.do" })).toBe("Lucas Berger");
    expect(nomInvite({ email: "marguerite.girod04@gmail.com" })).toBe("Marguerite Girod");
  });
});

describe("validatePublication", () => {
  it("donne une ligne par rubrique et par jour", () => {
    const v = validatePublication({ rubrique: "news", titre: " Titre ", detail: "Résumé", lien: "https://slack.com/x" }, JOUR);
    expect(v.valeur).toEqual({ type: "lecture", projet: "News of the Day", titre: "Titre", detail: "Résumé", lien: "https://slack.com/x", echeance: JOUR, cle: `news:${JOUR}` });
  });
  it("refuse une rubrique inconnue, un titre vide, un long résumé et un lien non https", () => {
    expect(validatePublication(null, JOUR).erreur).toBe("rubrique");
    expect(validatePublication({ rubrique: "autre", titre: "x" }, JOUR).erreur).toBe("rubrique");
    expect(validatePublication({ rubrique: "feature", titre: " " }, JOUR).erreur).toBe("titre");
    expect(validatePublication({ rubrique: "feature", titre: "x", detail: "y".repeat(1001) }, JOUR).erreur).toBe("detail");
    expect(validatePublication({ rubrique: "feature", titre: "x", lien: "javascript:alert(1)" }, JOUR).erreur).toBe("lien");
  });
});

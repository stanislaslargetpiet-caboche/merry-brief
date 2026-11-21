import { describe, expect, it } from "vitest";
import { buildSante, detailReplays } from "@/lib/pilotage/sante";
import { briefAgent } from "@/lib/pilotage/agent";
import { fmtDateTime } from "@/lib/server/pilotage/shape";

// Alerte du 21 nov. 2026 : « 7 session(s) avec un bug vu dans le replay · sur 95 analysée(s) : voir Coulisses ›
// Santé », sans un seul constat. Le pilotage lisait pourtant les 15 constats du lecteur de replays sans les montrer,
// et l'agent bugs, qui ne reçoit que le titre et le détail, n'avait rien à réparer (déjà le 11 et le 17 nov.).
const LISTE = [
  { quand: "2026-11-20T17:05:00Z", raison: "Le bouton « Envoyer » reste sans effet après trois clics,\n puis la personne quitte la page.", lien: "https://eu.posthog.com/project/321035/replay/s1?t=42" },
  { quand: "2026-11-19T08:10:00Z", raison: "Les photos des prestataires s'affichent cassées.", lien: "https://eu.posthog.com/project/321035/replay/s2" },
  { quand: null, raison: "", lien: "https://eu.posthog.com/project/321035/replay/s3" },
  { quand: "2026-11-18T10:00:00Z", raison: "La liste des invités reste vide après l'import.", lien: "https://eu.posthog.com/project/321035/replay/s4" },
  { quand: "2026-11-17T10:00:00Z", raison: "Quatrième constat.", lien: "https://eu.posthog.com/project/321035/replay/s5" },
];

describe("constats des replays résumés", () => {
  it("nomme les trois constats les plus marquants, avec leur heure de Paris", () => {
    expect(fmtDateTime("2026-11-20T17:05:00Z")).toContain("18:05");
    expect(detailReplays({ analysees: 95, bugs: 7, liste: LISTE })).toBe(
      `sur 95 analysée(s) · Le bouton « Envoyer » reste sans effet après trois clics, puis la personne quitte la page. (${fmtDateTime("2026-11-20T17:05:00Z")}) · Les photos des prestataires s'affichent cassées. (${fmtDateTime("2026-11-19T08:10:00Z")}) · La liste des invités reste vide après l'import. (${fmtDateTime("2026-11-18T10:00:00Z")}) · liste dans Coulisses › Santé`,
    );
  });
  it("coupe les constats interminables : les trois tiennent dans la consigne de l'agent", () => {
    const longs = [1, 2, 3].map((i) => ({ quand: "2026-11-20T17:05:00Z", raison: `Constat ${i} ${"a".repeat(2000)}` }));
    const detail = detailReplays({ analysees: 95, bugs: 3, liste: longs });
    expect(detail.length).toBeLessThan(1000);
    expect(detail).toContain("Constat 3");
  });
  it("sans la liste des constats, le détail reste le total d'avant", () => {
    expect(detailReplays({ analysees: 95, bugs: 7 })).toBe("sur 95 analysée(s) : voir Coulisses › Santé");
    expect(detailReplays({ analysees: 95, bugs: 7, liste: [{ raison: " " }] })).toBe("sur 95 analysée(s) : voir Coulisses › Santé");
  });
});

describe("alerte des bugs vus en replay", () => {
  const data = (replays) => ({ supabase: { series: [{ jour: "2026-11-20" }, { jour: "2026-11-21" }], totaux: {} }, posthog: { disponible: true, bugs: { series: [], replays } }, erreurs: [] });
  it("porte les constats jusqu'à la consigne de l'agent bugs, sans changer le titre", () => {
    const alerte = buildSante(data({ analysees: 95, bugs: 7, liste: LISTE }), 7).find((s) => /replay/.test(s.titre));
    expect(alerte.titre).toBe("7 session(s) avec un bug vu dans le replay");
    expect(alerte.detail).toContain("Le bouton « Envoyer » reste sans effet après trois clics");
    expect(briefAgent({ titre: alerte.titre, detail: alerte.detail.slice(0, 1000) }, "reparer", true)).toContain("La liste des invités reste vide après l'import.");
  });
  it("aucune alerte quand le lecteur n'a rien vu", () => {
    expect(buildSante(data({ analysees: 95, bugs: 0, liste: [] }), 7).find((s) => /replay/.test(s.titre))).toBeUndefined();
  });
});

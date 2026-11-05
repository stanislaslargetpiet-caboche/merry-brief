import { describe, expect, it } from "vitest";
import { buildSante } from "@/lib/pilotage/sante";
import { buildBrief, costRows, morningAlerts, yesterdayRows } from "@/lib/server/pilotage/brief";
import { demoData } from "@/lib/server/pilotage/demo";
import { briefKey, inBriefWindow, parisParts } from "@/lib/server/pilotage/schedule";

describe("heure de Paris pour le mail de 8 h", () => {
  it("8 h à Paris en hiver (7 h UTC) comme en été (6 h UTC)", () => {
    expect(parisParts(new Date("2026-11-05T07:00:00Z")).hour).toBe(8);
    expect(parisParts(new Date("2026-07-05T06:00:00Z")).hour).toBe(8);
  });
  it("la fenêtre d'envoi couvre 8 h et 9 h, pas 7 h ni 10 h", () => {
    expect([7, 8, 9, 10].map(inBriefWindow)).toEqual([false, true, true, false]);
    // en hiver la tâche de 6 h UTC tombe à 7 h Paris : elle ne fait rien, celle de 7 h UTC envoie
    expect(inBriefWindow(parisParts(new Date("2026-11-05T06:30:00Z")).hour)).toBe(false);
    expect(inBriefWindow(parisParts(new Date("2026-11-05T07:30:00Z")).hour)).toBe(true);
  });
  it("la clé du jour suit la date de Paris, pas celle d'UTC", () => {
    expect(briefKey(new Date("2026-11-04T23:30:00Z"))).toBe("brief:2026-11-05");
    expect(briefKey(new Date("2026-11-05T07:00:00Z"))).toBe("brief:2026-11-05");
  });
});

describe("santé partagée", () => {
  it("rien d'anormal : que des OK", () => {
    const data = { supabase: { series: [{ jour: "2026-11-04" }, { jour: "2026-11-05" }], totaux: {} }, posthog: { disponible: true, bugs: { series: [] } }, resend: { disponible: true, envoyes: 3, problemes: [], par_etat: { delivered: 3 } }, vercel: { disponible: true, erreurs: 0, erreurs_production: 0, derniere_production: null }, erreurs: [] };
    const sante = buildSante(data, 2);
    expect(sante.every((s) => s.tone === "ok")).toBe(true);
    expect(sante.find((s) => /JavaScript/.test(s.titre)).titre).toBe("Aucune erreur JavaScript sur 2 jours");
  });
  it("une source en échec et un build en échec sont des alertes", () => {
    const data = { vercel: { disponible: true, erreurs: 1, erreurs_production: 1, derniere_production: null }, erreurs: [{ source: "supabase", message: "statement timeout" }] };
    const bad = buildSante(data, 2).filter((s) => s.tone === "bad").map((s) => s.titre);
    expect(bad).toEqual(["1 déploiement(s) de production en échec", "Source en échec : supabase"]);
  });
});

describe("coûts dans le mail du matin", () => {
  const now = new Date("2026-11-05T07:00:00Z");
  const couts = { disponible: true, lignes: 8, mois: 34.37, mois_par_jour: 6.87, trente_jours: 259.92, trente_par_jour: 8.66 };
  it("donne le mois en cours et les 30 jours, avec l'équivalent par jour", () => {
    expect(costRows({ couts }, now)).toEqual([
      { name: "Dépensé en novembre", status: "34,37 € · 6,87 € par jour" },
      { name: "30 derniers jours", status: "260 € · 8,66 € par jour" },
    ]);
  });
  it("n'ajoute rien quand le registre est vide ou non lu", () => {
    expect(costRows({ couts: { ...couts, lignes: 0 } }, now)).toEqual([]);
    expect(costRows({ couts: { disponible: false, raison: "x" } }, now)).toEqual([]);
    expect(costRows({}, now)).toEqual([]);
  });
  it("le bloc Coûts figure dans le texte et dans le mail, avec ou sans alerte", () => {
    for (const erreurs of [[], [{ source: "supabase", message: "statement timeout" }]]) {
      const brief = buildBrief({ couts, erreurs }, now);
      expect(brief.text).toContain("Coûts :\n- Dépensé en novembre : 34,37 € · 6,87 € par jour");
      expect(brief.body).toContain("Coûts</h2>");
    }
    expect(buildBrief({ erreurs: [] }, now).text).not.toContain("Coûts :");
  });
});

describe("mail du matin", () => {
  it("ne retient que les alertes, les points à voir et les sources non lues", () => {
    const sante = [
      { tone: "ok", titre: "Aucune erreur", detail: "" },
      { tone: "neutral", titre: "23 prestataire(s) actifs sans photo", detail: "" },
      { tone: "neutral", titre: "Déploiements Vercel non lus", detail: "x" },
      { tone: "warn", titre: "17 clic(s) de rage", detail: "" },
      { tone: "bad", titre: "Source en échec : supabase", detail: "" },
    ];
    expect(morningAlerts(sante).map((a) => a.titre)).toEqual(["Source en échec : supabase", "17 clic(s) de rage", "Déploiements Vercel non lus"]);
  });
  it("compte les alertes dans l'objet et met le détail dans le texte", () => {
    const brief = buildBrief({ erreurs: [{ source: "supabase", message: "statement timeout" }] }, new Date("2026-11-05T07:00:00Z"));
    expect(brief.subject).toBe("Merry · jeudi 5 novembre · 1 alerte");
    expect(brief.text).toContain("Alerte : Source en échec : supabase");
    expect(brief.text).toContain("https://app.withmerry.com/pilotage");
    expect(brief.alertes).toBe(1);
  });
  it("une journée calme le dit", () => {
    const data = { supabase: { series: [{ jour: "2026-11-03" }, { jour: "2026-11-04" }, { jour: "2026-11-05" }], totaux: { comptes_actifs: 4 } }, erreurs: [] };
    const brief = buildBrief(data, new Date("2026-11-05T07:00:00Z"));
    expect(brief.subject).toBe("Merry · jeudi 5 novembre · rien d'anormal");
    expect(brief.body).toContain("Rien d&#39;anormal ce matin");
  });
  it("hier face à avant-hier, depuis les séries par jour", () => {
    const series = [
      { jour: "2026-11-02", inscriptions: 1, mariages: 0, demandes: 0, messages_couple: 0, messages_pro: 0, reponses_rsvp: 0 },
      { jour: "2026-11-03", inscriptions: 2, mariages: 1, demandes: 3, messages_couple: 4, messages_pro: 1, reponses_rsvp: 114 },
      { jour: "2026-11-04", inscriptions: 5, mariages: 2, demandes: 6, messages_couple: 9, messages_pro: 7, reponses_rsvp: 0 },
      { jour: "2026-11-05", inscriptions: 0, mariages: 0, demandes: 0, messages_couple: 0, messages_pro: 0, reponses_rsvp: 0 },
    ];
    const rows = yesterdayRows({ supabase: { series, totaux: { comptes_actifs: 7 } } }, new Date("2026-11-05T07:00:00Z"));
    expect(rows.find((r) => r.name === "Nouveaux comptes").status).toBe("5 · avant-hier 2");
    expect(rows.find((r) => r.name === "Demandes de devis").status).toBe("6 · avant-hier 3");
    expect(rows.find((r) => r.name === "Réponses RSVP").status).toBe("0 · avant-hier 114");
    expect(rows.find((r) => r.name.startsWith("Comptes connectés")).status).toBe("7");
  });
  it("tient avec le jeu d'exemple complet et échappe le HTML", () => {
    const data = demoData(2);
    data.erreurs = [{ source: "posthog", message: "<script>alert(1)</script>" }];
    const brief = buildBrief(data, new Date("2026-11-05T07:00:00Z"));
    expect(brief.body).not.toContain("<script>");
    expect(brief.body).toContain("&lt;script&gt;");
    expect(brief.body).toContain("Sessions dans l&#39;appli");
    expect(brief.text.split("\n").length).toBeGreaterThan(8);
  });
});

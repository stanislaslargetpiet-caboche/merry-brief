import { describe, expect, it } from "vitest";
import { buildFunnelPros, signauxPro, stadePro } from "@/lib/pilotage/funnelPros";
import { buildPrestataires } from "@/lib/server/pilotage/prestataires";
import { resolvePage } from "@/lib/pilotage/nav";

const NOW = Date.parse("2026-11-19T12:00:00Z");
const jours = (n) => new Date(NOW - n * 86400000).toISOString();
const vide = { photos_pro: 0, formules: 0, dates: 0, clients_manuels: 0, collaborateurs: 0, demandes: 0, reponses: 0, reservations: 0 };
const fiche = (id, extra = {}) => ({ ...vide, id, nom: id, test: false, comptes: [{ id: `u-${id}` }], revendiquee: jours(10), derniere_visite: jours(1), ...extra });

describe("stadePro", () => {
  it("prend l'étape la plus avancée, même si une étape a été sautée", () => {
    expect(stadePro(vide)).toBe(0);
    expect(stadePro({ ...vide, formules: 1 })).toBe(1);
    expect(stadePro({ ...vide, photos_pro: 2 })).toBe(1);
    expect(stadePro({ ...vide, demandes: 1 })).toBe(2);
    expect(stadePro({ ...vide, reponses: 1 })).toBe(3);
    expect(stadePro({ ...vide, reservations: 1 })).toBe(4);
  });
});

describe("signauxPro", () => {
  it("signale une fiche sans compte, jamais revenue, ou une demande sans réponse depuis plus de 48 h", () => {
    expect(signauxPro(fiche("a", { comptes: [] }), NOW).map((s) => s.id)).toEqual(["compte"]);
    expect(signauxPro(fiche("b", { derniere_visite: jours(10) }), NOW).map((s) => s.id)).toEqual(["revenu"]);
    expect(signauxPro(fiche("c", { sans_reponse: 1, sans_reponse_depuis: jours(3) }), NOW).map((s) => s.id)).toEqual(["attente"]);
    expect(signauxPro(fiche("d", { sans_reponse: 1, sans_reponse_depuis: jours(1) }), NOW)).toEqual([]);
  });
});

describe("buildFunnelPros", () => {
  it("compte les vraies fiches par étape et range les tests en bas", () => {
    const { etapes, lignes } = buildFunnelPros([fiche("t", { test: true, reservations: 1 }), fiche("a"), fiche("b", { demandes: 1 })], NOW);
    expect(etapes.map((e) => e.n)).toEqual([2, 1, 1, 0, 0]);
    expect(etapes.map((e) => e.ici)).toEqual([1, 0, 1, 0, 0]);
    expect(lignes.map((l) => l.id)).toEqual(["b", "a", "t"]);
  });
});

describe("buildPrestataires", () => {
  it("lit comptes, photos de l'espace pro, demandes, réponses et crédits dépensés", () => {
    const [p] = buildPrestataires(
      {
        pros: [{ vendor_id: "v", claimed_at: jours(5), credits: 15 }],
        fiches: [{ id: "v", name: "Le Cercle", city: "Rennes", primary_category: "traiteur" }],
        categories: [{ slug: "traiteur", label: "Traiteur" }],
        members: [{ vendor_id: "v", user_id: "u1", role: "gerant" }, { vendor_id: "v", user_id: null, email: "x@y.fr", role: "membre" }],
        photos: [{ vendor_id: "v", storage_path: "v/pro-1.jpg" }, { vendor_id: "v", storage_path: "v/places-1.jpg" }],
        formulas: [{ vendor_id: "v" }],
        options: [],
        dates: [],
        clients: [
          { vendor_id: "v", source: "merry", stage: "devis", answered_at: jours(2), created_at: jours(3) },
          { vendor_id: "v", source: "merry", stage: "nouvelle", answered_at: null, created_at: jours(4) },
          { vendor_id: "v", source: "hors_merry", stage: "reserve", answered_at: null, created_at: jours(4) },
        ],
        views: [{ vendor_id: "v" }, { vendor_id: "v" }],
        ledger: [{ vendor_id: "v", kind: "remboursement", delta: 100 }, { vendor_id: "v", kind: "utilisation", delta: -25 }],
      },
      [{ id: "u1", email: "cercle@exemple.fr", last_sign_in_at: jours(1) }],
      {},
    );
    expect(p).toMatchObject({ nom: "Le Cercle", metier: "Traiteur", test: false, emails: ["cercle@exemple.fr"], collaborateurs: 1, photos: 2, photos_pro: 1, formules: 1, vues: 2, demandes: 2, reponses: 1, reservations: 1, clients_manuels: 1, sans_reponse: 1, credits: 15, credits_depenses: 25 });
    expect(p.sans_reponse_depuis).toBe(jours(4));
  });
  it("reconnaît une fiche de test à son nom", () => {
    const [p] = buildPrestataires({ pros: [{ vendor_id: "v" }], fiches: [{ id: "v", name: "Merry Test (ne pas réserver)" }] }, [], {});
    expect(p.test).toBe(true);
  });
});

describe("navigation", () => {
  it("Prestataires › Funnel a sa propre adresse", () => {
    const { group, page } = resolvePage("/pilotage/prestataires/funnel-pros");
    expect([group.id, page.id]).toEqual(["prestataires", "funnel-pros"]);
  });
});

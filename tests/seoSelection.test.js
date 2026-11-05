import { describe, expect, it } from "vitest";
import { pickVendors, selectionRank } from "@/lib/seo/selection";
import { tradeOf } from "@/lib/seo/trades";

const row = (name, google_categories, id = name) => ({ id, name, google_categories });
const planners = tradeOf("wedding-planners");
const deco = tradeOf("decoration");
const beauty = tradeOf("coiffure-maquillage");

// Fiches relevées sur la page Bretagne des wedding planners le 5 nov. 2026, dans l'ordre de l'ancien tri
const bretagne = [
  row("Domaine de Keravel", ["Prestataire de mariage", "Location de cottage", "Maison de vacances"]),
  row("Résidence Le One", ["Lieu de mariage", "Salle de réception", "Séminaire"]),
  row("L'instant Prod | Vidéaste de mariage à Saint-Malo et Rennes", ["Prestataire de mariage"]),
  row("Event d'Ouest - Wedding Planner", ["Organisateur de mariages", "Organisateur d'événements"]),
  row("LA MAISON DES MOMENTS - Wedding planner & designer", ["Organisateur de mariages"]),
  row("Hit the road - wedding", ["Organisateur de mariages"]),
  row("Mam louve events - décoratrice de mariage côtes d'Armor", ["Prestataire de mariage", "Agence événementielle"]),
  row("Petits Points De Tout wedding planner", ["Organisateur de mariages"]),
];

describe("selectionRank", () => {
  it("les lieux et les autres métiers passent après les wedding planners", () => {
    expect(selectionRank(bretagne[0], planners.selection)).toBe(2);
    expect(selectionRank(bretagne[1], planners.selection)).toBe(2);
    expect(selectionRank(bretagne[2], planners.selection)).toBe(2);
    expect(selectionRank(bretagne[3], planners.selection)).toBe(0);
    expect(selectionRank(bretagne[6], planners.selection)).toBe(0);
  });
  it("une fiche qui relève du métier l'emporte sur un mot qui ressemble à un autre métier", () => {
    expect(selectionRank(row("Château Events - Wedding planner", ["Organisateur de mariages", "Lieu de mariage"]), planners.selection)).toBe(0);
  });
  it("sans catégorie ni indice, la fiche reste neutre", () => {
    expect(selectionRank(row("Studio Lune", []), planners.selection)).toBe(1);
    expect(selectionRank(row("Studio Lune", null), planners.selection)).toBe(1);
    expect(selectionRank(row("Studio Lune", ["Service establishment"]), planners.selection)).toBe(1);
  });
  it("un métier sans règle ne change rien", () => {
    expect(selectionRank(bretagne[0], undefined)).toBe(1);
  });
});

describe("pickVendors", () => {
  it("met d'abord les wedding planners, garde l'ordre des photos dedans, puis complète", () => {
    const names = pickVendors(bretagne, planners, 6).map((r) => r.name);
    expect(names).toEqual([
      "Event d'Ouest - Wedding Planner",
      "LA MAISON DES MOMENTS - Wedding planner & designer",
      "Hit the road - wedding",
      "Mam louve events - décoratrice de mariage côtes d'Armor",
      "Petits Points De Tout wedding planner",
      "Domaine de Keravel",
    ]);
  });
  it("n'exclut rien : une zone sans fiche du métier affiche les autres", () => {
    expect(pickVendors(bretagne.slice(0, 3), planners, 6)).toHaveLength(3);
  });
  it("un métier sans règle garde les six premières fiches dans l'ordre de lecture", () => {
    const rows = Array.from({ length: 10 }, (_, i) => row(`n${i}`, []));
    expect(pickVendors(rows, tradeOf("lieux"), 6).map((r) => r.name)).toEqual(["n0", "n1", "n2", "n3", "n4", "n5"]);
  });
  it("décoration : la location et la décoration d'abord, les lieux et photographes ensuite", () => {
    const rows = [
      row("Espace des Roches", ["Espace événementiel", "Lieu de mariage"]),
      row("Studio Flash", ["Service de photographie", "Photographe de mariage"]),
      row("Tentes & Co", ["Service de location de tentes"]),
      row("Atelier Fleurs", ["Décorateur.rice floral.e"]),
    ];
    expect(pickVendors(rows, deco, 4).map((r) => r.name)).toEqual(["Tentes & Co", "Atelier Fleurs", "Espace des Roches", "Studio Flash"]);
  });
  it("coiffure et maquillage : les fiches tournées mariage d'abord, les instituts généralistes en dernier", () => {
    const rows = [
      row("Institut Zen", ["Institut de beauté", "Institut de massages"]),
      row("Salon Martin", ["Salon de coiffure"]),
      row("Léa maquilleuse", ["Maquilleur.euse"]),
      row("Coiffure Bridal Studio", ["Salon de coiffure"]),
    ];
    expect(pickVendors(rows, beauty, 4).map((r) => r.name)).toEqual(["Léa maquilleuse", "Coiffure Bridal Studio", "Salon Martin", "Institut Zen"]);
  });
});

describe("wedding planners : les lieux qui se disent aussi organisateurs", () => {
  const rank = (name, cats) => selectionRank(row(name, cats), planners.selection);
  it("un nom de château ou de domaine l'emporte sur les catégories, accents ou non", () => {
    expect(rank("Château de la Baume", ["Organisateur de mariages", "Château", "Organisateur d'événements", "Restaurant français", "Lieu de mariage"])).toBe(2);
    expect(rank("Chateau de Rajat", ["Espace événementiel", "Organisateur d'événements", "Château", "Séminaire", "Lieu de mariage"])).toBe(2);
    expect(rank("MV2 Evénements - Le Domaine La Fontaine", ["Organisateur d'événements", "Salle de réception", "Lieu de mariage"])).toBe(2);
  });
  it("un lieu dont la première catégorie n'est pas le métier passe après", () => {
    expect(rank("LE CANOTIER LIVE – Café-théâtre, cabaret & soirées", ["Salle de réception", "Salle de banquet", "Bar à cocktails", "Organisateur d'événements", "Lieu de mariage"])).toBe(2);
  });
  it("une vraie wedding planner qui cite « lieu de mariage » en dernier reste en tête", () => {
    expect(rank("Enéane - Wedding Planner", ["Organisateur de mariages", "Célébrant.e de mariage", "Prestataire de mariage", "Lieu de mariage"])).toBe(0);
    expect(rank("Fine Events - Créatrice de Bonheur", ["Organisateur de mariages", "Organisateur d'événements", "Lieu de mariage"])).toBe(0);
    expect(rank("Studio Lune", ["Organisateur de mariages", "Lieu de mariage"])).toBe(0);
  });
  it("un nom de wedding planner l'emporte sur un mot de lieu", () => {
    expect(rank("Domaine Events - Wedding planner", ["Prestataire de mariage", "Lieu de mariage"])).toBe(0);
  });
  it("décoration et coiffure gardent la règle large : une seule catégorie du métier suffit", () => {
    expect(selectionRank(row("Atelier Fleurs", ["Service de location de matériel de soirée", "Espace événementiel"]), deco.selection)).toBe(0);
  });
});

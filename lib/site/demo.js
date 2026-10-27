// Site de mariage en démo (?demo=1) : le contenu d'exemple des maquettes, adapté au mariage de démonstration

import { emptyContent } from "./model";

const BY_KIND = {
  civil: { time: "16:00", place: "Mairie d'Éguilles, salle des mariages", address: "Place Gabriel Payeur, 13510 Éguilles", text: "La cérémonie civile, en petit comité" },
  veille: { time: "20:00", place: "Domaine des Oliviers, la terrasse", address: "Chemin des Oliviers, 13510 Éguilles", text: "Pour ceux qui arrivent tôt" },
  cocktail: { time: "16:30", place: "Domaine des Oliviers", address: "Chemin des Oliviers, 13510 Éguilles", text: "Cérémonie dans le jardin, puis le cocktail" },
  diner: { time: "20:00", place: "Domaine des Oliviers", address: "Chemin des Oliviers, 13510 Éguilles", text: "Dîner sous les platanes, puis la soirée" },
  brunch: { time: "11:00", place: "Les jardins du domaine", address: "Chemin des Oliviers, 13510 Éguilles", text: "Pour se dire au revoir sans se presser" },
};

export function demoSiteContent(data) {
  const c = emptyContent();
  const p1 = (data.wedding?.partner1 || "Léo").split(" ")[0];
  const p2 = (data.wedding?.partner2 || "Léa").split(" ")[0];
  for (const e of data.events || []) if (BY_KIND[e.kind]) c.moments[e.id] = { ...BY_KIND[e.kind] };
  c.tagline = `Là où ${p2} passait ses étés, nous allons nous dire oui.`;
  c.time = "16:30";
  c.venue = { name: data.wedding?.venue || "Domaine des Oliviers", address: "Chemin des Oliviers, 13510 Éguilles", area: "Provence", text: "Cérémonie dans le jardin, puis dîner sous les platanes." };
  c.dress = {
    title: "Champêtre chic",
    text: "Couleurs claires bienvenues. Talons plats conseillés : la cérémonie a lieu dans le jardin.",
    colors: [
      { name: "Écru", color: "#ebe4d6" },
      { name: "Lin", color: "#d3c5ad" },
      { name: "Sauge", color: "#a3ab92" },
      { name: "Olive", color: "#6c7353" },
      { name: "Lavande", color: "#9e98b6" },
    ],
  };
  c.travel = [
    { kind: "train", text: "Gare d’Aix-en-Provence TGV, puis 25 min de route ou nos navettes.", place: "Aix-en-Provence TGV", duration: "25 min" },
    { kind: "avion", text: "Aéroport Marseille Provence, à 30 min de route.", place: "Marseille Provence", duration: "30 min" },
    { kind: "voiture", text: "A8, sortie Aix-Ouest, puis direction Éguilles. Parking gratuit sur place.", place: "A8 · Sortie Aix-Ouest", duration: "Parking sur place" },
    { kind: "navette", text: "Samedi à 15 h depuis la gare TGV et les hôtels conseillés. Retours à 1 h et à 3 h.", place: "Sam. 15:00 · Aix TGV", duration: "Retour 1:00 · 3:00" },
  ];
  c.stays = [
    { name: "La Bastide du Figuier", distance: "À 1 km", note: "Chambres d’hôtes" },
    { name: "Hôtel des Restanques", distance: "À 3 km", note: "Avec piscine" },
    { name: "Mas Sainte-Anne", distance: "À 6 km", note: "Gîtes pour les familles" },
  ];
  c.kids = { title: "Les enfants sont les bienvenus", text: "Un espace de jeux et deux baby-sitters les attendent pendant le dîner." };
  c.story = { title: "Notre histoire", text: `Nous nous sommes rencontrés un soir de juin, à Avignon, pendant le festival. Huit ans, deux appartements et un vieux chien plus tard, nous voulons réunir tous ceux que nous aimons en Provence, là où ${p2} passait ses étés.` };
  c.citation = "Quand le soleil touche la colline, nous dirons oui";
  c.faq = [
    { group: "Venir et dormir", q: "Comment venir au domaine ?", a: "En train : gare d’Aix-en-Provence TGV, puis 25 min de route ou nos navettes. En avion : aéroport Marseille Provence, à 30 min." },
    { group: "Venir et dormir", q: "Où dormir ?", a: "Trois adresses à moins de 6 km : la Bastide du Figuier, l’hôtel des Restanques et le Mas Sainte-Anne." },
    { group: "Venir et dormir", q: "Y a-t-il des navettes ?", a: "Oui, samedi à 15 h depuis la gare TGV et les hôtels conseillés. Retours à 1 h et à 3 h." },
    { group: "Le jour J", q: "Quelle tenue ?", a: "Champêtre chic. Talons plats conseillés : la cérémonie a lieu dans le jardin." },
    { group: "Le jour J", q: "Les enfants sont-ils invités ?", a: "Oui, avec plaisir. Un espace de jeux et deux baby-sitters les attendent pendant le dîner." },
    { group: "Le jour J", q: "Jusqu’à quelle heure dure la fête ?", a: "Jusqu’au bout de la nuit. Dernière navette à 3 h." },
  ];
  c.contacts = [
    { name: "Clara", role: `Témoin de ${p2}`, reach: "clara@exemple.fr" },
    { name: "Hugo", role: `Témoin de ${p1}`, reach: "hugo@exemple.fr" },
  ];
  return c;
}

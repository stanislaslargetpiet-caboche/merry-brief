// Prestataires : les critères du couple, en un seul endroit (boîte « Vos critères »).
// Ceux du brief (lieu, date, invités, budget, style) sont lus et écrits dans le brief ;
// ceux de « Préciser mes envies » (accès, capacité, couchages, fin de soirée, traiteur…) dans vendor_wishes.
// Chaque critère a une icône, la même partout : boîte des critères, cartes, fiche, « Pourquoi ce lieu ».

import { euros, toDate } from "./format";

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const dateLong = (d) => {
  const x = toDate(d);
  return x ? `${x.getDate() === 1 ? "1er" : x.getDate()} ${MONTHS[x.getMonth()]} ${x.getFullYear()}` : "";
};

// Icônes des critères : [jeu, nom] (« duo » : icônes bicolores du Brief, « line » : icônes au trait)
export const CRIT_ICON = {
  lieu: ["duo", "lieu"],
  date: ["duo", "calendar"],
  invites: ["duo", "table"],
  budget: ["duo", "wallet"],
  style: ["duo", "tenues"],
  seats: ["line", "seat"],
  beds: ["duo", "lit"],
  airport: ["line", "plane"],
  station: ["line", "train"],
  parking: ["line", "parking"],
  pmr: ["duo", "users"],
  caterer: ["duo", "traiteur"],
  late: ["duo", "horloge"],
  ceremony: ["duo", "fleurs"],
  exclusive: ["duo", "cloche"],
  words: ["duo", "beaute"],
};

// Fourchettes d'invités et de budget du brief (mêmes valeurs que l'onboarding)
export const GUEST_RANGES = [
  { code: "<50", label: "Moins de 50 invités", min: 0, max: 50 },
  { code: "50-100", label: "50 à 100 invités", min: 50, max: 100 },
  { code: "100-150", label: "100 à 150 invités", min: 100, max: 150 },
  { code: "150-200", label: "150 à 200 invités", min: 150, max: 200 },
  { code: ">200", label: "Plus de 200 invités", min: 200, max: 250 },
];
export const BUDGET_RANGES = [
  { code: "<15k", label: "Moins de 15 000 €" },
  { code: "15-30k", label: "15 000 à 30 000 €" },
  { code: "30-50k", label: "30 000 à 50 000 €" },
  { code: ">50k", label: "Plus de 50 000 €" },
];
export const VIBES = ["Champêtre", "Grande fête", "Intime", "Chic", "Bohème", "Bord de mer", "Rock", "À l'ancienne", "Un peu dingue"];

// Invités : la fourchette du brief fait foi ; la liste d'invités n'est qu'une indication
export function guestsOf(data) {
  const range = GUEST_RANGES.find((r) => r.code === data.brief?.guests) || null;
  const listCount = (data.guests || []).filter((g) => !g.plus_one_of).length;
  return { range, listCount, label: range ? range.label : listCount ? `${listCount} invités` : "" };
}

// Ce qu'il faut de places assises pour la fourchette du brief
export function seatsNeeded(data) {
  const w = data.wishes?.wishes || {};
  if (w.seats) return w.seats;
  const g = guestsOf(data);
  return g.range ? Math.min(g.range.max, 220) : g.listCount || null;
}

export function budgetText(data) {
  const total = data.wedding?.budget_total;
  if (total !== null && total !== undefined && total !== "") return euros(total);
  return BUDGET_RANGES.find((r) => r.code === data.brief?.budget)?.label || "";
}

// Lieu : un seul critère. Régions choisies, sinon « près d'une ville », sinon le lieu du brief
export function placeText(data) {
  const w = data.wishes?.wishes || {};
  if (w.regions?.length) return w.regions.join(", ");
  if (w.city?.name?.trim()) return `Près de ${w.city.name.trim()}${w.city.max ? `, ${w.city.max} min` : ""}`;
  return data.wedding?.region || data.brief?.region || "";
}

const minutes = (m) => (m ? ` (${m} min)` : "");

// Tous les critères, dans l'ordre de la boîte. optional : retiré d'un clic ; key : éditeur à ouvrir
export function criteriaList(data) {
  const w = data.wishes?.wishes || {};
  const b = data.brief || {};
  const out = [
    { key: "lieu", label: placeText(data) || "Lieu à définir", empty: !placeText(data) },
    { key: "date", label: data.wedding?.wedding_date ? dateLong(data.wedding.wedding_date) : "Date à définir", empty: !data.wedding?.wedding_date },
    { key: "invites", label: guestsOf(data).label || "Invités à définir", empty: !guestsOf(data).label },
    { key: "budget", label: budgetText(data) || "Budget à définir", empty: !budgetText(data) },
    { key: "style", label: (b.vibes || []).filter((x) => !/sait pas/i.test(x)).join(", ") || "Style à définir", empty: !(b.vibes || []).length },
  ];
  if (w.airport?.on) out.push({ key: "airport", optional: true, label: `Près d'un aéroport${minutes(w.airport.max || 60)}` });
  if (w.station?.on) out.push({ key: "station", optional: true, label: `Près d'une gare TGV${minutes(w.station.max || 60)}` });
  if ((w.access || []).includes("parking")) out.push({ key: "parking", optional: true, label: "Parking sur place" });
  if ((w.access || []).includes("pmr")) out.push({ key: "pmr", optional: true, label: "Accessible PMR" });
  if (w.seats) out.push({ key: "seats", optional: true, label: `${w.seats} places assises` });
  if (w.beds) out.push({ key: "beds", optional: true, label: `${w.beds} couchages` });
  if ((w.venue || []).includes("fin_tardive")) out.push({ key: "late", optional: true, label: "Fin de soirée après 2 h" });
  if ((w.venue || []).includes("ceremonie_exterieur")) out.push({ key: "ceremony", optional: true, label: "Cérémonie en extérieur" });
  if ((w.venue || []).includes("exclusivite")) out.push({ key: "exclusive", optional: true, label: "Lieu en exclusivité" });
  if (w.caterer === "libre" || w.caterer === "impose") out.push({ key: "caterer", optional: true, label: w.caterer === "libre" ? "Traiteur libre" : "Traiteur du lieu" });
  for (const c of w.criteria || []) out.push({ key: "words", optional: true, label: c, word: c });
  return out;
}

// Faits d'un lieu, dans l'ordre d'affichage, avec ceux qui répondent à un critère du couple (match)
export function venueFacts(v, data, { all = false } = {}) {
  if (v.category !== "lieu") return [];
  const w = data.wishes?.wishes || {};
  const tags = v.tags || [];
  const need = seatsNeeded(data);
  const out = [];
  if (v.seats) out.push({ key: "seats", label: "Places assises", text: `${v.seats} places assises`, value: `${v.seats} invités`, match: !!need && v.seats >= need });
  if (v.beds !== undefined && v.beds !== null) out.push({ key: "beds", label: "Couchages", text: `${v.beds} couchages`, value: `${v.beds} sur place`, match: !!w.beds && v.beds >= w.beds });
  const airportOk = w.airport?.on && v.airport !== undefined && v.airport <= (w.airport.max || 60);
  const stationOk = w.station?.on && v.station !== undefined && v.station <= (w.station.max || 60);
  if (v.airport !== undefined && v.airport !== null && (all || airportOk || !(v.station < v.airport))) {
    out.push({ key: "airport", label: "Aéroport le plus proche", text: `${v.airport} min de l'aéroport${v.airportName ? ` de ${v.airportName}` : ""}`, value: v.airportName ? `${v.airportName}, ${v.airport} min` : `${v.airport} min`, match: !!airportOk });
  }
  if (v.station !== undefined && v.station !== null && (all || stationOk || !(v.airport <= v.station))) {
    out.push({ key: "station", label: "Gare TGV la plus proche", text: `${v.station} min de la gare${v.stationName ? ` ${v.stationName}` : " TGV"}`, value: v.stationName ? `${v.stationName}, ${v.station} min` : `${v.station} min`, match: !!stationOk });
  }
  const free = tags.includes("traiteur_libre") || v.caterer === false;
  const imposed = v.caterer === true;
  if (free || imposed) out.push({ key: "caterer", label: "Traiteur", text: free ? "Traiteur libre" : "Traiteur du lieu", value: free ? "Libre, vous choisissez" : "Celui du lieu", match: (w.caterer === "libre" && free) || (w.caterer === "impose" && imposed) });
  if (tags.includes("fin_tardive")) out.push({ key: "late", label: "Fin de soirée", text: "Fin de soirée après 2 h", value: "Après 2 h", match: (w.venue || []).includes("fin_tardive") });
  const extra = [
    ["parking", "Parking", "Parking sur place", "Sur place", (w.access || []).includes("parking")],
    ["pmr", "Accès PMR", "Accessible PMR", "Oui", (w.access || []).includes("pmr")],
    ["ceremony", "Cérémonie", "Cérémonie en extérieur", "En extérieur, possible", (w.venue || []).includes("ceremonie_exterieur")],
    ["exclusive", "Exclusivité", "Lieu en exclusivité", "Le lieu rien que pour vous", (w.venue || []).includes("exclusivite")],
  ];
  const tagOf = { parking: "parking", pmr: "pmr", ceremony: "ceremonie_exterieur", exclusive: "exclusivite" };
  for (const [key, label, text, value, wished] of extra) {
    if (tags.includes(tagOf[key]) && (all || wished)) out.push({ key, label, text, value, match: wished });
  }
  return out;
}

// Lieux pour la page Acquisition › Persona (D-398) : le lieu tapé à l'onboarding (« Brest, 29200, Finistère »,
// « Bordeaux », « Saint Georges sur Loire (49) », « Picardie ») et la région envoyée par Google Ads (« Brittany »,
// « Ile-de-France ») ramenés à l'une des 13 régions de France métropolitaine, ou « Outre-mer ». Fonctions pures,
// testées (tests/pilotagePersona.test.js).

export const REGIONS = {
  idf: "Île-de-France",
  cvl: "Centre-Val de Loire",
  bfc: "Bourgogne-Franche-Comté",
  nor: "Normandie",
  hdf: "Hauts-de-France",
  ge: "Grand Est",
  pdl: "Pays de la Loire",
  bre: "Bretagne",
  naq: "Nouvelle-Aquitaine",
  occ: "Occitanie",
  ara: "Auvergne-Rhône-Alpes",
  paca: "Provence-Alpes-Côte d'Azur",
  cor: "Corse",
  om: "Outre-mer",
};

// Code, nom, région
const DEPARTEMENTS = [
  ["01", "Ain", "ara"], ["02", "Aisne", "hdf"], ["03", "Allier", "ara"], ["04", "Alpes-de-Haute-Provence", "paca"], ["05", "Hautes-Alpes", "paca"],
  ["06", "Alpes-Maritimes", "paca"], ["07", "Ardèche", "ara"], ["08", "Ardennes", "ge"], ["09", "Ariège", "occ"], ["10", "Aube", "ge"],
  ["11", "Aude", "occ"], ["12", "Aveyron", "occ"], ["13", "Bouches-du-Rhône", "paca"], ["14", "Calvados", "nor"], ["15", "Cantal", "ara"],
  ["16", "Charente", "naq"], ["17", "Charente-Maritime", "naq"], ["18", "Cher", "cvl"], ["19", "Corrèze", "naq"], ["2A", "Corse-du-Sud", "cor"],
  ["2B", "Haute-Corse", "cor"], ["21", "Côte-d'Or", "bfc"], ["22", "Côtes-d'Armor", "bre"], ["23", "Creuse", "naq"], ["24", "Dordogne", "naq"],
  ["25", "Doubs", "bfc"], ["26", "Drôme", "ara"], ["27", "Eure", "nor"], ["28", "Eure-et-Loir", "cvl"], ["29", "Finistère", "bre"],
  ["30", "Gard", "occ"], ["31", "Haute-Garonne", "occ"], ["32", "Gers", "occ"], ["33", "Gironde", "naq"], ["34", "Hérault", "occ"],
  ["35", "Ille-et-Vilaine", "bre"], ["36", "Indre", "cvl"], ["37", "Indre-et-Loire", "cvl"], ["38", "Isère", "ara"], ["39", "Jura", "bfc"],
  ["40", "Landes", "naq"], ["41", "Loir-et-Cher", "cvl"], ["42", "Loire", "ara"], ["43", "Haute-Loire", "ara"], ["44", "Loire-Atlantique", "pdl"],
  ["45", "Loiret", "cvl"], ["46", "Lot", "occ"], ["47", "Lot-et-Garonne", "naq"], ["48", "Lozère", "occ"], ["49", "Maine-et-Loire", "pdl"],
  ["50", "Manche", "nor"], ["51", "Marne", "ge"], ["52", "Haute-Marne", "ge"], ["53", "Mayenne", "pdl"], ["54", "Meurthe-et-Moselle", "ge"],
  ["55", "Meuse", "ge"], ["56", "Morbihan", "bre"], ["57", "Moselle", "ge"], ["58", "Nièvre", "bfc"], ["59", "Nord", "hdf"],
  ["60", "Oise", "hdf"], ["61", "Orne", "nor"], ["62", "Pas-de-Calais", "hdf"], ["63", "Puy-de-Dôme", "ara"], ["64", "Pyrénées-Atlantiques", "naq"],
  ["65", "Hautes-Pyrénées", "occ"], ["66", "Pyrénées-Orientales", "occ"], ["67", "Bas-Rhin", "ge"], ["68", "Haut-Rhin", "ge"], ["69", "Rhône", "ara"],
  ["70", "Haute-Saône", "bfc"], ["71", "Saône-et-Loire", "bfc"], ["72", "Sarthe", "pdl"], ["73", "Savoie", "ara"], ["74", "Haute-Savoie", "ara"],
  ["75", "Paris", "idf"], ["76", "Seine-Maritime", "nor"], ["77", "Seine-et-Marne", "idf"], ["78", "Yvelines", "idf"], ["79", "Deux-Sèvres", "naq"],
  ["80", "Somme", "hdf"], ["81", "Tarn", "occ"], ["82", "Tarn-et-Garonne", "occ"], ["83", "Var", "paca"], ["84", "Vaucluse", "paca"],
  ["85", "Vendée", "pdl"], ["86", "Vienne", "naq"], ["87", "Haute-Vienne", "naq"], ["88", "Vosges", "ge"], ["89", "Yonne", "bfc"],
  ["90", "Territoire de Belfort", "bfc"], ["91", "Essonne", "idf"], ["92", "Hauts-de-Seine", "idf"], ["93", "Seine-Saint-Denis", "idf"], ["94", "Val-de-Marne", "idf"],
  ["95", "Val-d'Oise", "idf"], ["971", "Guadeloupe", "om"], ["972", "Martinique", "om"], ["973", "Guyane", "om"], ["974", "La Réunion", "om"], ["976", "Mayotte", "om"],
];

// Noms de région (français, anciens, anglais de Google Ads) et villes fréquentes, déjà normalisés par `norm`
const ALIAS = {
  idf: ["ile de france", "region parisienne"],
  cvl: ["centre val de loire", "val de loire", "touraine", "sologne"],
  bfc: ["bourgogne franche comte", "bourgogne", "franche comte", "burgundy", "dijon", "besancon"],
  nor: ["normandie", "normandy", "rouen", "caen", "le havre", "deauville", "etretat"],
  hdf: ["hauts de france", "picardie", "nord pas de calais", "lille", "amiens"],
  ge: ["grand est", "alsace", "lorraine", "champagne", "champagne ardenne", "strasbourg", "illkirch graffenstaden", "illkirch", "reims", "metz", "nancy", "colmar", "mulhouse"],
  pdl: ["pays de la loire", "nantes", "angers", "le mans", "la baule"],
  bre: ["bretagne", "brittany", "rennes", "brest", "saint malo", "quimper", "vannes", "lorient"],
  naq: ["nouvelle aquitaine", "aquitaine", "poitou charentes", "limousin", "pays basque", "bordeaux", "biarritz", "bayonne", "arcachon", "mimizan", "la rochelle", "limoges", "poitiers", "perigord", "cap ferret", "hossegor"],
  occ: ["occitanie", "languedoc", "languedoc roussillon", "midi pyrenees", "toulouse", "montpellier", "nimes", "perpignan", "carcassonne"],
  ara: ["auvergne rhone alpes", "auvergne", "rhone alpes", "metropole de lyon", "lyon", "grenoble", "annecy", "chamonix", "evian les bains", "evian", "clermont ferrand", "saint etienne", "megeve"],
  paca: ["provence alpes cote d azur", "provence", "cote d azur", "luberon", "marseille", "nice", "aix en provence", "cannes", "avignon", "toulon", "saint tropez"],
  cor: ["corse", "corsica", "ajaccio", "bastia", "porto vecchio"],
  om: ["outre mer", "reunion", "dom tom"],
};

/** Minuscules, sans accents ni ponctuation : « Côte-d'Or » → « cote d or » */
export const norm = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const PAR_CODE = new Map(DEPARTEMENTS.map(([code, , r]) => [code.toLowerCase(), r]));
// Les noms les plus longs d'abord : « haute savoie » avant « savoie », « loire atlantique » avant « loire »
const NOMS = [...DEPARTEMENTS.map(([, nom, r]) => [norm(nom), r]), ...Object.entries(ALIAS).flatMap(([r, noms]) => noms.map((n) => [n, r]))].sort((a, b) => b[0].length - a[0].length);

function parCodePostal(texte) {
  const cp = /\b(\d{5})\b/.exec(texte)?.[1];
  if (cp) {
    if (cp.startsWith("97")) return PAR_CODE.get(cp.slice(0, 3)) || "om";
    if (cp.startsWith("20")) return "cor";
    return PAR_CODE.get(cp.slice(0, 2)) || null;
  }
  const dep = /\((\d{2}|2[ab]|97\d)\)/i.exec(texte)?.[1];
  return dep ? PAR_CODE.get(dep.toLowerCase()) || null : null;
}

/** Région d'un lieu tapé librement, ou null quand rien ne la donne */
export function regionDe(texte) {
  if (!texte) return null;
  const code = parCodePostal(String(texte));
  if (code) return REGIONS[code];
  const n = ` ${norm(texte)} `;
  if (n.trim() === "moi" || !n.trim()) return null;
  // Le dernier morceau (« Brest, 29200, Finistère » → « Finistère ») d'abord, puis le texte entier
  const morceaux = String(texte).split(",").map(norm).filter(Boolean).reverse();
  for (const m of morceaux) {
    const exact = NOMS.find(([nom]) => nom === m);
    if (exact) return REGIONS[exact[1]];
  }
  const trouve = NOMS.find(([nom]) => n.includes(` ${nom} `));
  return trouve ? REGIONS[trouve[1]] : null;
}

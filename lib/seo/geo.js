// Pages SEO : régions et départements de métropole. catalog.vendors.department porte le code (« 84 », « 2A ») ;
// la région d'une fiche se déduit de son département. `in` est la forme qui suit le métier :
// « Lieux de mariage dans les Yvelines », « … à Paris », « … en Gironde ».

export const REGIONS = [
  { name: "Île-de-France", in: "en Île-de-France" },
  { name: "Hauts-de-France", in: "dans les Hauts-de-France" },
  { name: "Normandie", in: "en Normandie" },
  { name: "Grand Est", in: "dans le Grand Est" },
  { name: "Bretagne", in: "en Bretagne" },
  { name: "Pays de la Loire", in: "en Pays de la Loire" },
  { name: "Centre-Val de Loire", in: "en Centre-Val de Loire" },
  { name: "Bourgogne-Franche-Comté", in: "en Bourgogne-Franche-Comté" },
  { name: "Nouvelle-Aquitaine", in: "en Nouvelle-Aquitaine" },
  { name: "Auvergne-Rhône-Alpes", in: "en Auvergne-Rhône-Alpes" },
  { name: "Occitanie", in: "en Occitanie" },
  { name: "Provence-Alpes-Côte d'Azur", in: "en Provence-Alpes-Côte d'Azur" },
  { name: "Corse", in: "en Corse" },
];

const ARA = "Auvergne-Rhône-Alpes";
const BFC = "Bourgogne-Franche-Comté";
const BRE = "Bretagne";
const CVL = "Centre-Val de Loire";
const COR = "Corse";
const GE = "Grand Est";
const HDF = "Hauts-de-France";
const IDF = "Île-de-France";
const NOR = "Normandie";
const NA = "Nouvelle-Aquitaine";
const OCC = "Occitanie";
const PDL = "Pays de la Loire";
const PACA = "Provence-Alpes-Côte d'Azur";

// [code, nom, région, forme « dans »]
const RAW = [
  ["01", "Ain", ARA, "dans l'Ain"],
  ["02", "Aisne", HDF, "dans l'Aisne"],
  ["03", "Allier", ARA, "dans l'Allier"],
  ["04", "Alpes-de-Haute-Provence", PACA, "dans les Alpes-de-Haute-Provence"],
  ["05", "Hautes-Alpes", PACA, "dans les Hautes-Alpes"],
  ["06", "Alpes-Maritimes", PACA, "dans les Alpes-Maritimes"],
  ["07", "Ardèche", ARA, "en Ardèche"],
  ["08", "Ardennes", GE, "dans les Ardennes"],
  ["09", "Ariège", OCC, "en Ariège"],
  ["10", "Aube", GE, "dans l'Aube"],
  ["11", "Aude", OCC, "dans l'Aude"],
  ["12", "Aveyron", OCC, "dans l'Aveyron"],
  ["13", "Bouches-du-Rhône", PACA, "dans les Bouches-du-Rhône"],
  ["14", "Calvados", NOR, "dans le Calvados"],
  ["15", "Cantal", ARA, "dans le Cantal"],
  ["16", "Charente", NA, "en Charente"],
  ["17", "Charente-Maritime", NA, "en Charente-Maritime"],
  ["18", "Cher", CVL, "dans le Cher"],
  ["19", "Corrèze", NA, "en Corrèze"],
  ["2A", "Corse-du-Sud", COR, "en Corse-du-Sud"],
  ["2B", "Haute-Corse", COR, "en Haute-Corse"],
  ["21", "Côte-d'Or", BFC, "en Côte-d'Or"],
  ["22", "Côtes-d'Armor", BRE, "dans les Côtes-d'Armor"],
  ["23", "Creuse", NA, "dans la Creuse"],
  ["24", "Dordogne", NA, "en Dordogne"],
  ["25", "Doubs", BFC, "dans le Doubs"],
  ["26", "Drôme", ARA, "dans la Drôme"],
  ["27", "Eure", NOR, "dans l'Eure"],
  ["28", "Eure-et-Loir", CVL, "en Eure-et-Loir"],
  ["29", "Finistère", BRE, "dans le Finistère"],
  ["30", "Gard", OCC, "dans le Gard"],
  ["31", "Haute-Garonne", OCC, "en Haute-Garonne"],
  ["32", "Gers", OCC, "dans le Gers"],
  ["33", "Gironde", NA, "en Gironde"],
  ["34", "Hérault", OCC, "dans l'Hérault"],
  ["35", "Ille-et-Vilaine", BRE, "en Ille-et-Vilaine"],
  ["36", "Indre", CVL, "dans l'Indre"],
  ["37", "Indre-et-Loire", CVL, "en Indre-et-Loire"],
  ["38", "Isère", ARA, "en Isère"],
  ["39", "Jura", BFC, "dans le Jura"],
  ["40", "Landes", NA, "dans les Landes"],
  ["41", "Loir-et-Cher", CVL, "dans le Loir-et-Cher"],
  ["42", "Loire", ARA, "dans la Loire"],
  ["43", "Haute-Loire", ARA, "en Haute-Loire"],
  ["44", "Loire-Atlantique", PDL, "en Loire-Atlantique"],
  ["45", "Loiret", CVL, "dans le Loiret"],
  ["46", "Lot", OCC, "dans le Lot"],
  ["47", "Lot-et-Garonne", NA, "dans le Lot-et-Garonne"],
  ["48", "Lozère", OCC, "en Lozère"],
  ["49", "Maine-et-Loire", PDL, "en Maine-et-Loire"],
  ["50", "Manche", NOR, "dans la Manche"],
  ["51", "Marne", GE, "dans la Marne"],
  ["52", "Haute-Marne", GE, "en Haute-Marne"],
  ["53", "Mayenne", PDL, "en Mayenne"],
  ["54", "Meurthe-et-Moselle", GE, "en Meurthe-et-Moselle"],
  ["55", "Meuse", GE, "dans la Meuse"],
  ["56", "Morbihan", BRE, "dans le Morbihan"],
  ["57", "Moselle", GE, "en Moselle"],
  ["58", "Nièvre", BFC, "dans la Nièvre"],
  ["59", "Nord", HDF, "dans le Nord"],
  ["60", "Oise", HDF, "dans l'Oise"],
  ["61", "Orne", NOR, "dans l'Orne"],
  ["62", "Pas-de-Calais", HDF, "dans le Pas-de-Calais"],
  ["63", "Puy-de-Dôme", ARA, "dans le Puy-de-Dôme"],
  ["64", "Pyrénées-Atlantiques", NA, "dans les Pyrénées-Atlantiques"],
  ["65", "Hautes-Pyrénées", OCC, "dans les Hautes-Pyrénées"],
  ["66", "Pyrénées-Orientales", OCC, "dans les Pyrénées-Orientales"],
  ["67", "Bas-Rhin", GE, "dans le Bas-Rhin"],
  ["68", "Haut-Rhin", GE, "dans le Haut-Rhin"],
  ["69", "Rhône", ARA, "dans le Rhône"],
  ["70", "Haute-Saône", BFC, "en Haute-Saône"],
  ["71", "Saône-et-Loire", BFC, "en Saône-et-Loire"],
  ["72", "Sarthe", PDL, "dans la Sarthe"],
  ["73", "Savoie", ARA, "en Savoie"],
  ["74", "Haute-Savoie", ARA, "en Haute-Savoie"],
  ["75", "Paris", IDF, "à Paris"],
  ["76", "Seine-Maritime", NOR, "en Seine-Maritime"],
  ["77", "Seine-et-Marne", IDF, "en Seine-et-Marne"],
  ["78", "Yvelines", IDF, "dans les Yvelines"],
  ["79", "Deux-Sèvres", NA, "dans les Deux-Sèvres"],
  ["80", "Somme", HDF, "dans la Somme"],
  ["81", "Tarn", OCC, "dans le Tarn"],
  ["82", "Tarn-et-Garonne", OCC, "dans le Tarn-et-Garonne"],
  ["83", "Var", PACA, "dans le Var"],
  ["84", "Vaucluse", PACA, "dans le Vaucluse"],
  ["85", "Vendée", PDL, "en Vendée"],
  ["86", "Vienne", NA, "dans la Vienne"],
  ["87", "Haute-Vienne", NA, "en Haute-Vienne"],
  ["88", "Vosges", GE, "dans les Vosges"],
  ["89", "Yonne", BFC, "dans l'Yonne"],
  ["90", "Territoire de Belfort", BFC, "dans le Territoire de Belfort"],
  ["91", "Essonne", IDF, "dans l'Essonne"],
  ["92", "Hauts-de-Seine", IDF, "dans les Hauts-de-Seine"],
  ["93", "Seine-Saint-Denis", IDF, "en Seine-Saint-Denis"],
  ["94", "Val-de-Marne", IDF, "dans le Val-de-Marne"],
  ["95", "Val-d'Oise", IDF, "dans le Val-d'Oise"],
];

export function slugify(s) {
  return String(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const DEPARTMENTS = RAW.map(([code, name, region, inPhrase]) => ({ code, name, region, in: inPhrase, slug: slugify(name) }));

const DEP_BY_CODE = new Map(DEPARTMENTS.map((d) => [d.code, d]));

export function departmentOf(code) {
  return DEP_BY_CODE.get(String(code || "").trim().toUpperCase().padStart(2, "0")) || null;
}

export const FRANCE = { kind: "france", slug: null, name: "France", in: "en France" };

// Zones d'une page : la France entière, une région ou un département
const ZONES = new Map([
  ...REGIONS.map((r) => [slugify(r.name), { kind: "region", slug: slugify(r.name), name: r.name, in: r.in, region: r.name }]),
  ...DEPARTMENTS.map((d) => [d.slug, { kind: "department", slug: d.slug, name: d.name, in: d.in, region: d.region, code: d.code }]),
]);

export function zoneOf(slug) {
  return ZONES.get(String(slug || "")) || null;
}

export function regionZone(name) {
  return zoneOf(slugify(name));
}

export function departmentsOf(regionName) {
  return DEPARTMENTS.filter((d) => d.region === regionName);
}

// Codes de département couverts par une zone, tels qu'ils peuvent être écrits dans le catalogue
export function codesOf(zone) {
  const deps = zone.kind === "department" ? [departmentOf(zone.code)] : zone.kind === "region" ? departmentsOf(zone.region) : DEPARTMENTS;
  return deps.flatMap((d) => (/[A-Z]/.test(d.code) ? [d.code, d.code.toLowerCase()] : [d.code]));
}

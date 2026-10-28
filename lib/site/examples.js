// Photos d'exemple du site de mariage : dans l'éditeur, chaque emplacement de photo encore vide en montre une,
// pour que le couple voie ce qui va où. Les invités ne les voient jamais (page publique : emplacements vides
// masqués comme avant). Photos d'Unsplash, libres d'usage (licence Unsplash), réduites à 1 600 px dans
// public/site-exemples ; les auteurs sont cités ci-dessous, la licence ne l'impose pas.

const P = (name) => `/site-exemples/${name}.jpg`;

export const EXAMPLE_PHOTOS = {
  cover: P("couverture"),
  venue: P("lieu"),
  citation: P("coucher-de-soleil"),
  story: [P("histoire-1"), P("histoire-2")],
  ambiance: [P("ambiance-table"), P("ambiance-village"), P("ambiance-ceremonie"), P("ambiance-bouquet")],
  album: [P("album-chaises"), P("album-alliance"), P("album-danse"), P("album-cierges"), P("album-bouquet"), P("album-silhouette")],
  moments: [P("moments-balade"), P("moments-oliviers"), P("moments-lumiere"), P("moments-mains")],
};

export const isExample = (src) => typeof src === "string" && src.startsWith("/site-exemples/");

// Les photos du couple d'abord ; les emplacements vides prennent l'exemple
export function withExamples(photos = {}) {
  const out = { ...photos };
  for (const [key, ex] of Object.entries(EXAMPLE_PHOTOS)) {
    if (Array.isArray(ex)) {
      const mine = Array.isArray(photos[key]) ? photos[key].filter(Boolean) : [];
      out[key] = mine.length ? mine : ex;
    } else if (!photos[key]) out[key] = ex;
  }
  return out;
}

// Fichier, page Unsplash, auteur
export const CREDITS = [
  ["couverture", "PuXtB1B4zL8", "Vadim Paripa"],
  ["lieu", "LATvJObY2Q0", "Ryan Klaus"],
  ["coucher-de-soleil", "QdpYkcQ72ms", "Jacob Diehl"],
  ["histoire-1", "Rnton6rhDe4", "Céline Druguet"],
  ["histoire-2", "sj3gSYe5OXE", "Klara Kulikova"],
  ["ambiance-table", "CUcBdenZ1nE", "Bruno Ngarukiye"],
  ["ambiance-village", "MJbkxi0Jel8", "Harvey Holt"],
  ["ambiance-ceremonie", "WwEIxPBHN3I", "Paul Lichtblau"],
  ["ambiance-bouquet", "wTmdLZ36EUE", "Hasan Hasanzadeh"],
  ["album-chaises", "6o4vz9R33Iw", "Troy Olson"],
  ["album-alliance", "4-X87OBEO2M", "Brooke Balentine"],
  ["album-danse", "usgSE13MRY4", "Sammy Swae"],
  ["album-cierges", "IrlSpL3bo8o", "Fotógrafo Samuel Cruz"],
  ["album-bouquet", "cfk4k2QQ0Wk", "Duong Ngan"],
  ["album-silhouette", "8AJvXLsFw7g", "Cybele and Bevan"],
  ["moments-balade", "bxo7CT4jlmw", "James Kovin"],
  ["moments-oliviers", "yEcKzQtGUgw", "Tim Stagge"],
  ["moments-lumiere", "QaNSHeDl3A4", "Pedro Pulido"],
  ["moments-mains", "lKSc42JLhzs", "Tamara Menzi"],
];

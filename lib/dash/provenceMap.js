// Fond de carte du Sud-Est (canvas « Merry · Carte brief », artboards 7d, 7e, 7p et 7q).
// Dessiné dans un repère de 1000 × 1100 unités ; projection calée sur les villes de la maquette
// (Marseille, Avignon, Nîmes, Toulon, Nice, Grenoble), assez juste pour placer un lieu à quelques km près.

export const MAP_W = 1000;
export const MAP_H = 1100;

const LNG0 = 5.3698;
const LAT0 = 43.2965;
const X0 = 493.3;
const Y0 = 750.6;
const KX = 221.75; // unités par degré de longitude
const KY = 308.3; // unités par degré de latitude

export function project(lat, lng) {
  return { x: X0 + (lng - LNG0) * KX, y: Y0 - (lat - LAT0) * KY };
}

export function unproject(x, y) {
  return { lat: LAT0 + (Y0 - y) / KY, lng: LNG0 + (x - X0) / KX };
}

// Distance à vol d'oiseau, en km
export function distanceKm(a, b) {
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r;
  const dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export const MAP_BG = "#f3eee2";

export const MAP_SVG = "<polygon points=\"-476.8,966.6 -143.8,1043.8 -99.4,1022.2 -43.9,1006.8 4.9,1016.0 4.9,1016.0 22.7,1037.6 38.2,1053.0 11.6,1071.6 -3.9,1114.8 11.6,1167.2 0.5,1198.1 -32.8,1398.7 -476.8,1398.7\" fill=\"#ebe6da\"/><polygon points=\"972.9,599.4 979.5,565.4 1006.2,509.9 1003.9,482.1 948.4,494.4 855.2,463.6 828.6,405.0 844.1,364.8 826.3,318.5 866.3,281.5 799.7,226.0 770.8,195.1 884.1,148.8 855.2,87.1 877.4,40.8 844.1,-20.9 864.1,-144.4 1410.2,-144.4 1410.2,565.4 1166.0,550.0 1066.1,577.8 1032.8,590.1 1006.2,599.4\" fill=\"#ebe6da\"/><polygon points=\"-32.8,1398.7 0.5,1198.1 11.6,1167.2 -3.9,1114.8 11.6,1071.6 38.2,1053.0 22.7,1037.6 4.9,1016.0 -3.9,991.3 -21.7,982.1 -23.9,966.6 -26.1,935.8 -21.7,889.5 -23.9,858.6 -10.6,818.5 16.0,781.5 56.0,756.8 100.4,725.9 127.0,716.7 155.9,695.0 189.2,673.4 215.8,673.4 244.7,698.1 284.7,707.4 318.0,732.1 355.7,735.2 382.3,725.9 404.5,719.7 422.3,741.3 455.6,741.3 477.8,741.3 491.1,759.9 504.4,778.4 528.9,781.5 548.8,793.8 577.7,803.1 593.2,821.6 617.7,812.3 639.9,818.5 659.8,830.8 666.5,818.5 682.0,809.2 715.3,803.1 744.2,796.9 775.3,781.5 784.2,762.9 764.2,756.8 779.7,744.4 797.5,716.7 824.1,713.6 844.1,688.9 859.6,673.4 881.8,670.4 886.3,658.0 904.0,639.5 921.8,630.2 939.6,621.0 955.1,611.7 972.9,599.4 1006.2,599.4 1032.8,590.1 1066.1,577.8 1166.0,550.0 1410.2,565.4 1410.2,1614.7 -32.8,1614.7\" fill=\"#dfe8ea\"/><polygon points=\"422.3,704.3 437.8,682.7 455.6,676.5 466.7,695.0 455.6,713.6 433.4,713.6\" fill=\"#dfe8ea\"/><polygon points=\"311.3,679.6 333.5,670.4 342.4,685.8 322.4,695.0\" fill=\"#dfe8ea\"/><polyline points=\"371.2,-144.4 377.9,71.6 366.8,148.8 377.9,226.0 384.6,303.1 351.3,380.3 340.2,457.4 355.7,519.1 366.8,556.2 340.2,611.7 329.1,633.3 344.6,673.4 373.5,732.1\" fill=\"none\" stroke=\"#cddde1\" stroke-width=\"2.2\" stroke-linejoin=\"round\" stroke-linecap=\"round\"/><polyline points=\"329.1,633.3 300.2,670.4 284.7,707.4\" fill=\"none\" stroke=\"#cddde1\" stroke-width=\"1.6\" stroke-linejoin=\"round\" stroke-linecap=\"round\"/><polyline points=\"777.5,256.8 733.1,364.8 677.6,395.7 622.1,472.8 622.1,550.0 588.8,590.1 544.4,627.2 488.9,627.2 433.4,605.6 366.8,556.2\" fill=\"none\" stroke=\"#d3e1e4\" stroke-width=\"1.6\" stroke-linejoin=\"round\" stroke-linecap=\"round\"/><polyline points=\"722.0,40.8 577.7,164.2 500.0,179.7 411.2,210.5 380.1,226.0\" fill=\"none\" stroke=\"#d3e1e4\" stroke-width=\"1.6\" stroke-linejoin=\"round\" stroke-linecap=\"round\"/><polyline points=\"284.7,707.4 300.2,658.0 326.8,621.0 333.5,580.9 349.0,534.6 340.2,442.0\" fill=\"none\" stroke=\"#cbc3b2\" stroke-width=\"1\" stroke-linejoin=\"round\" stroke-linecap=\"round\" stroke-dasharray=\"4 3\"/><polyline points=\"340.2,442.0 278.0,426.6 189.2,395.7 144.8,364.8 56.0,287.7 -55.0,226.0\" fill=\"none\" stroke=\"#cbc3b2\" stroke-width=\"1\" stroke-linejoin=\"round\" stroke-linecap=\"round\" stroke-dasharray=\"4 3\"/><polyline points=\"340.2,442.0 411.2,426.6 466.7,472.8 522.2,457.4 544.4,395.7 599.9,380.3 644.3,324.7 710.9,272.2 770.8,195.1\" fill=\"none\" stroke=\"#cbc3b2\" stroke-width=\"1\" stroke-linejoin=\"round\" stroke-linecap=\"round\" stroke-dasharray=\"4 3\"/><polyline points=\"-43.9,1006.8 4.9,1016.0\" fill=\"none\" stroke=\"#b8b0a0\" stroke-width=\"1.2\" stroke-linejoin=\"round\" stroke-linecap=\"round\"/><polyline points=\"972.9,599.4 979.5,565.4 1006.2,509.9 1003.9,482.1 948.4,494.4 855.2,463.6 828.6,405.0 844.1,364.8 826.3,318.5 866.3,281.5 799.7,226.0 770.8,195.1 884.1,148.8 855.2,87.1 877.4,40.8 844.1,-20.9 864.1,-144.4\" fill=\"none\" stroke=\"#b8b0a0\" stroke-width=\"1.2\" stroke-linejoin=\"round\" stroke-linecap=\"round\"/><polyline points=\"-476.8,966.6 -143.8,1043.8 -99.4,1022.2 -43.9,1006.8\" fill=\"none\" stroke=\"#b8b0a0\" stroke-width=\"1.2\" stroke-linejoin=\"round\" stroke-linecap=\"round\"/><circle cx=\"493.3\" cy=\"750.6\" r=\"2.5\" fill=\"#9d978a\"/><text x=\"493.3\" y=\"766.6\" text-anchor=\"middle\" font-family=\"Archivo, Helvetica, Arial, sans-serif\" font-size=\"11\" fill=\"#6b6a63\">Marseille</text><circle cx=\"369.0\" cy=\"550.0\" r=\"2.5\" fill=\"#9d978a\"/><text x=\"362.0\" y=\"554.0\" text-anchor=\"end\" font-family=\"Archivo, Helvetica, Arial, sans-serif\" font-size=\"11\" fill=\"#6b6a63\">Avignon</text><circle cx=\"269.1\" cy=\"583.9\" r=\"2.5\" fill=\"#9d978a\"/><text x=\"262.1\" y=\"587.9\" text-anchor=\"end\" font-family=\"Archivo, Helvetica, Arial, sans-serif\" font-size=\"11\" fill=\"#6b6a63\">Nîmes</text><circle cx=\"162.6\" cy=\"654.9\" r=\"2.5\" fill=\"#9d978a\"/><text x=\"162.6\" y=\"670.9\" text-anchor=\"middle\" font-family=\"Archivo, Helvetica, Arial, sans-serif\" font-size=\"11\" fill=\"#6b6a63\">Montpellier</text><circle cx=\"617.7\" cy=\"806.2\" r=\"2.5\" fill=\"#9d978a\"/><text x=\"617.7\" y=\"822.2\" text-anchor=\"middle\" font-family=\"Archivo, Helvetica, Arial, sans-serif\" font-size=\"11\" fill=\"#6b6a63\">Toulon</text><circle cx=\"912.9\" cy=\"627.2\" r=\"2.5\" fill=\"#9d978a\"/><text x=\"912.9\" y=\"619.2\" text-anchor=\"middle\" font-family=\"Archivo, Helvetica, Arial, sans-serif\" font-size=\"11\" fill=\"#6b6a63\">Nice</text><circle cx=\"571.0\" cy=\"167.3\" r=\"2.5\" fill=\"#9d978a\"/><text x=\"571.0\" y=\"183.3\" text-anchor=\"middle\" font-family=\"Archivo, Helvetica, Arial, sans-serif\" font-size=\"11\" fill=\"#6b6a63\">Grenoble</text><text x=\"455.6\" y=\"920.3\" text-anchor=\"middle\" font-family=\"Archivo, Helvetica, Arial, sans-serif\" font-size=\"11\" letter-spacing=\"0.12em\" fill=\"#8f9ba0\" font-style=\"italic\">Mer Méditerranée</text><text x=\"955.1\" y=\"349.4\" text-anchor=\"middle\" font-family=\"Archivo, Helvetica, Arial, sans-serif\" font-size=\"11\" letter-spacing=\"0.12em\" fill=\"#8f9ba0\" font-style=\"normal\">ITALIE</text><text x=\"-166.0\" y=\"1136.4\" text-anchor=\"middle\" font-family=\"Archivo, Helvetica, Arial, sans-serif\" font-size=\"11\" letter-spacing=\"0.12em\" fill=\"#8f9ba0\" font-style=\"normal\">ESPAGNE</text>";

// Répartition des prix de départ (histogramme du filtre « Fourchette de prix »), de 0 à 30 000 €
export const PRICE_BARS = [4.3, 4.3, 8.7, 13.0, 17.3, 26.0, 34.7, 47.7, 39.0, 52.0, 43.3, 34.7, 39.0, 30.3, 21.7, 26.0, 17.3, 13.0, 13.0, 8.7, 8.7, 4.3, 4.3];

// Polices des images générées (next/og) : le moteur ne lit pas les graisses d'une police variable et montrerait
// Alan Sans en 300. D'où deux graisses figées à côté de ce fichier, tirées de public/fonts/alan-sans.ttf
// (fontTools, varLib.instancer, wght 600 et 700). Climate Crisis, la police du logo, vient de Google Fonts,
// réduite aux lettres demandées.

import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function climateCrisis(text) {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Climate+Crisis&text=${encodeURIComponent(text)}`)).text();
    const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    return url ? await (await fetch(url)).arrayBuffer() : null;
  } catch {
    return null;
  }
}

// Alan Sans 600 et 700, au format attendu par ImageResponse ; liste vide si les fichiers manquent
export async function alanSans() {
  try {
    const [semi, bold] = await Promise.all([600, 700].map((w) => readFile(join(process.cwd(), `lib/og/alan-sans-${w}.ttf`))));
    return [
      { name: "Alan Sans", data: semi, style: "normal", weight: 600 },
      { name: "Alan Sans", data: bold, style: "normal", weight: 700 },
    ];
  } catch {
    return [];
  }
}

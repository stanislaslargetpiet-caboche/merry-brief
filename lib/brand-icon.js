// Icône de Merry (onglet du navigateur, écran d'accueil du téléphone, résultats Google) :
// un M noir en Climate Crisis, la police du logo texte du site, sur fond citron.

import { ImageResponse } from "next/og";

async function climateCrisis() {
  try {
    const css = await (await fetch("https://fonts.googleapis.com/css2?family=Climate+Crisis&text=M")).text();
    const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    return url ? await (await fetch(url)).arrayBuffer() : null;
  } catch {
    return null;
  }
}

export async function brandIcon(px, radius) {
  const font = await climateCrisis();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#CFFF81",
          borderRadius: radius,
          color: "#000000",
          fontFamily: font ? "Climate Crisis" : "sans-serif",
          fontWeight: 800,
          fontSize: Math.round(px * 0.62),
          lineHeight: 1,
          paddingTop: Math.round(px * 0.06),
        }}
      >
        M
      </div>
    ),
    { width: px, height: px, fonts: font ? [{ name: "Climate Crisis", data: font, style: "normal", weight: 400 }] : [] }
  );
}

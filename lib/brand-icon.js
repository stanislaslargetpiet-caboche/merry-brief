// Icône de Merry (onglet du navigateur, écran d'accueil du téléphone, résultats Google) :
// un M en Climate Crisis, la police du logo texte du site, sur l'accent citron du système v2.1 pour l'appli,
// sur le pistache pour le site (D-235, app/vitrine/icon.js).

import { ImageResponse } from "next/og";
import { climateCrisis } from "@/lib/og/fonts";

export async function brandIcon(px, radius, background = "#FFF700") {
  const font = await climateCrisis("M");
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background,
          borderRadius: radius,
          color: "#1C1C1A",
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

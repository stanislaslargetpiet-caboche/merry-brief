import { describe, expect, it } from "vitest";
import { buildSante, formatErreur, resumeErreurs } from "@/lib/pilotage/sante";

// Alerte du 17 nov. 2026 : « 16 erreur(s) JavaScript sur 7 jours · 5 sur la période précédente », sans un seul
// message d'erreur. Le pilotage lisait pourtant les 40 dernières erreurs (titre, page, navigateur) sans les montrer.
const ERREURS = [
  { quand: "2026-11-12T09:10:00Z", hote: "app.withmerry.com", chemin: "/dashboard/invites", titre: "TypeError : Cannot read properties of undefined (reading 'map')", navigateur: "Safari", appareil: "Mobile", session: "s1" },
  { quand: "2026-11-12T09:12:00Z", hote: "app.withmerry.com", chemin: "/dashboard/invites", titre: "TypeError : Cannot read properties of undefined (reading 'map')", navigateur: "Safari", appareil: "Mobile", session: "s1" },
  { quand: "2026-11-12T11:00:00Z", hote: "app.withmerry.com", chemin: "/dashboard", titre: "TypeError : Cannot read properties of undefined (reading 'map')", navigateur: "Chrome", appareil: "Desktop", session: "s2" },
  { quand: "2026-11-14T08:30:00Z", hote: "app.withmerry.com", chemin: "/dashboard/budget", titre: "ChunkLoadError : Loading chunk 512 failed", navigateur: "Safari", appareil: "Mobile", session: "s3" },
  { quand: "2026-11-14T08:31:00Z", hote: "www.withmerry.com", chemin: "/", titre: "ReferenceError : gtag is not defined", navigateur: "Firefox", appareil: "Desktop", session: null },
  { quand: "2026-11-14T08:32:00Z", hote: "www.withmerry.com", chemin: "/", titre: "Erreur", navigateur: "Firefox", appareil: "Desktop", session: null },
];

describe("erreurs JavaScript résumées", () => {
  it("regroupe par message, les plus fréquentes d'abord, avec la page la plus touchée", () => {
    expect(resumeErreurs(ERREURS)).toEqual([
      { titre: "TypeError : Cannot read properties of undefined (reading 'map')", n: 3, chemin: "/dashboard/invites" },
      { titre: "ChunkLoadError : Loading chunk 512 failed", n: 1, chemin: "/dashboard/budget" },
      { titre: "Erreur", n: 1, chemin: "/" },
    ]);
    expect(resumeErreurs(ERREURS, 10)).toHaveLength(4);
    expect(resumeErreurs([])).toEqual([]);
    expect(resumeErreurs(null)).toEqual([]);
  });
  it("écrit le message, le nombre et la page, et coupe les messages interminables", () => {
    expect(formatErreur({ titre: "TypeError : x", n: 3, chemin: "/dashboard/invites" })).toBe("TypeError : x (×3, /dashboard/invites)");
    expect(formatErreur({ titre: "TypeError : x", n: 1, chemin: null })).toBe("TypeError : x");
    const long = formatErreur({ titre: `Error : ${"a".repeat(300)}`, n: 1, chemin: "/" });
    expect(long.length).toBeLessThan(140);
    expect(long.endsWith("… (/)")).toBe(true);
  });
});

describe("alerte des erreurs JavaScript", () => {
  const data = (exceptions) => ({
    supabase: { series: [{ jour: "2026-11-10" }, { jour: "2026-11-11" }, { jour: "2026-11-12" }, { jour: "2026-11-13" }], totaux: {} },
    posthog: {
      disponible: true,
      bugs: {
        series: [
          ["2026-11-10", 2, 0, 0],
          ["2026-11-11", 3, 0, 0],
          ["2026-11-12", 4, 0, 0],
          ["2026-11-13", 2, 0, 0],
        ],
        exceptions,
      },
    },
    erreurs: [],
  });
  it("nomme les erreurs dans le détail, pour le mail du matin et l'agent bugs", () => {
    const alerte = buildSante(data(ERREURS), 2).find((s) => /JavaScript/.test(s.titre));
    expect(alerte.titre).toBe("6 erreur(s) JavaScript sur 2 jours");
    expect(alerte.detail).toBe(
      "5 sur la période précédente · TypeError : Cannot read properties of undefined (reading 'map') (×3, /dashboard/invites) · ChunkLoadError : Loading chunk 512 failed (/dashboard/budget) · Erreur (/)",
    );
  });
  it("sans la liste des erreurs, le détail reste le total d'avant", () => {
    const alerte = buildSante(data(undefined), 2).find((s) => /JavaScript/.test(s.titre));
    expect(alerte.detail).toBe("5 sur la période précédente");
  });
});

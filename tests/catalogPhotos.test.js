import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PHOTO_URL_SECONDS } from "@/lib/catalogPhotos";

// Les photos du catalogue sont servies par des liens signés. Signés pour une heure, ils expiraient avant que PostHog
// rejoue la session (photos cassées dans chaque replay, verdict « bug » du lecteur automatique) et chez les couples qui
// rouvraient l'appli sur leur téléphone plus tard (400 vus dans les journaux Supabase les 15, 16 et 17 novembre 2026).
// Chaque endroit de l'appli qui signe une photo du catalogue doit prendre la durée partagée, jamais un nombre à lui.
// Le site vitrine (lib/seo/data.js) a sa propre durée, liée au cache de ses pages : il n'est pas concerné.

const racine = new URL("../", import.meta.url);
const lire = (chemin) => readFileSync(new URL(chemin, racine), "utf8");

const FICHIERS = ["lib/dash/catalog.js", "lib/pro/store.js", "app/api/pro/claim/route.js", "app/api/prestataires/photos-google/route.js"];

// Les instructions qui signent une photo du catalogue : createSignedUrl(s) sur le stockage catalog-photos, ou l'aide
// signed("catalog-photos", …) de lib/pro/store.js
function signatures(texte) {
  return texte.split("\n").filter((l) => /catalog-photos/.test(l) && /createSignedUrls?\(|signed\("catalog-photos"/.test(l) && !/\.upload\(|\.remove\(/.test(l));
}

describe("liens signés des photos du catalogue", () => {
  it("durent au moins trente jours, le temps que PostHog garde un replay", () => {
    expect(PHOTO_URL_SECONDS).toBeGreaterThanOrEqual(30 * 86400);
  });

  for (const fichier of FICHIERS) {
    it(`${fichier} signe chaque photo avec la durée partagée`, () => {
      const texte = lire(fichier);
      const lignes = signatures(texte);
      expect(lignes.length, "au moins une signature à vérifier").toBeGreaterThan(0);
      for (const ligne of lignes) {
        expect(ligne, "la durée partagée doit être nommée").toContain("PHOTO_URL_SECONDS");
        expect(ligne, "plus de nombre en dur").not.toMatch(/,\s*\d+\s*\)/);
      }
      expect(texte).toMatch(/import \{[^}]*PHOTO_URL_SECONDS[^}]*\} from "@\/lib\/catalogPhotos"/);
    });
  }
});

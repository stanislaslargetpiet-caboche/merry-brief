import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Le brouillon de réponse de la messagerie prestataire (app/api/pro/brouillon/route.js) passe par le compteur
// merry_ai_tick() et répond 403 s'il refuse. Ce compteur n'acceptait que les comptes ayant un mariage : tout
// prestataire était refusé (trois fois pour le même gérant de fiche le 23 novembre 2026, aucun brouillon affiché).
// Le scénario en base est dans scripts/sql/test-ia-prestataires.sql.

const lire = (chemin) => readFileSync(new URL(`../${chemin}`, import.meta.url), "utf8");

function corpsDuCompteur(texte) {
  const m = texte.match(/create or replace function public\.merry_ai_tick\(\)[\s\S]*?\$\$([\s\S]*?)\$\$;/);
  return m ? m[1] : "";
}

describe("compteur de l'IA pour les prestataires", () => {
  it("la route du brouillon passe bien par merry_ai_tick", () => {
    expect(lire("app/api/pro/brouillon/route.js")).toContain('sb.rpc("merry_ai_tick")');
  });

  it.each(["supabase/ia-prestataires.sql", "supabase/dashboard.sql"])("%s accepte les gérants de fiche", (f) => {
    const corps = corpsDuCompteur(lire(f));
    expect(corps).toContain("public.wedding_members");
    expect(corps).toContain("public.pro_members");
  });

  it("le fichier est rejoué par la vérification SQL de la CI, après espace-prestataire.sql", () => {
    const check = lire("scripts/sql/check.sh");
    const ordre = check.indexOf("supabase/ia-prestataires.sql");
    expect(ordre).toBeGreaterThan(check.indexOf("supabase/espace-prestataire.sql"));
  });
});

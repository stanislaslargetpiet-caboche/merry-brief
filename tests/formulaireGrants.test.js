import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// L'éditeur du formulaire invités (lib/dash/store.js, saveOneRow) renvoie la ligne guest_forms entière lue par
// select *, moins quelques colonnes réservées au serveur. Les droits d'écriture sont donnés colonne par colonne
// dans supabase/formulaire.sql : une colonne ajoutée à guest_forms sans y figurer fait échouer chaque
// enregistrement (42501 « permission denied for table guest_forms », vu le 15 novembre 2026 avec shared_at,
// ajoutée par supabase/mails-lecons.sql le 12 novembre). Et une colonne citée dans les droits doit exister
// dans formulaire.sql lui-même, sinon le fichier ne se rejoue plus sur une base neuve (CI de la PR #453).

const dir = new URL("../supabase/", import.meta.url);
const sql = (name) => readFileSync(new URL(name, dir), "utf8");

// Colonnes que l'éditeur ne renvoie jamais (liste `drop` de saveForm) ou que seul le serveur pose
const SERVEUR = ["submissions", "created_at", "rate_window_start", "rate_window_count"];

function colonnesAjoutees(texte) {
  return [...texte.matchAll(/alter table public\.guest_forms add column if not exists (\w+)/g)].map((m) => m[1]);
}

function colonnesCreees(texte) {
  const bloc = texte.match(/create table if not exists public\.guest_forms \(([\s\S]*?)\n\);/);
  return bloc ? bloc[1].split("\n").map((l) => l.trim().match(/^(\w+)\s/)?.[1]).filter(Boolean) : [];
}

function colonnesAccordees(texte, droit) {
  const m = texte.match(new RegExp(`grant ${droit} \\(([^)]+)\\)\\s+on public\\.guest_forms to authenticated`));
  return m ? m[1].split(",").map((c) => c.trim()) : [];
}

describe("droits de colonne de guest_forms", () => {
  const formulaire = sql("formulaire.sql");
  const fichiers = readdirSync(dir).filter((f) => f.endsWith(".sql"));
  const ajoutees = [...new Set(fichiers.flatMap((f) => colonnesAjoutees(sql(f))))];
  const declarees = [...colonnesCreees(formulaire), ...colonnesAjoutees(formulaire)];

  it("trouve bien les listes de droits et les colonnes", () => {
    expect(colonnesAccordees(formulaire, "insert")).toContain("fields");
    expect(colonnesAccordees(formulaire, "update")).toContain("fields");
    expect(declarees).toContain("wedding_id");
    expect(ajoutees).toContain("shared_at");
  });

  for (const droit of ["insert", "update"]) {
    it(`accorde ${droit} sur chaque colonne que l'éditeur renvoie`, () => {
      const accordees = colonnesAccordees(formulaire, droit);
      for (const col of ajoutees.filter((c) => !SERVEUR.includes(c))) expect(accordees, col).toContain(col);
    });

    it(`n'accorde ${droit} que sur des colonnes que formulaire.sql déclare lui-même`, () => {
      for (const col of colonnesAccordees(formulaire, droit)) expect(declarees, col).toContain(col);
    });
  }
});

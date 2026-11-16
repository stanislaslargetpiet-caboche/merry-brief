import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// L'éditeur du formulaire invités (lib/dash/store.js, saveOneRow) renvoie la ligne guest_forms entière, moins
// quelques colonnes réservées au serveur. Les droits d'écriture sont donnés colonne par colonne dans
// supabase/formulaire.sql : une colonne ajoutée ailleurs sans y figurer fait échouer chaque enregistrement
// (42501 « permission denied for table guest_forms », vu le 15 novembre 2026 après l'ajout de shared_at).

const sql = (name) => readFileSync(new URL(`../supabase/${name}`, import.meta.url), "utf8");

// Colonnes que l'éditeur ne renvoie jamais (liste `drop` de saveForm) ou que seul le serveur pose
const SERVEUR = ["submissions", "created_at", "rate_window_start", "rate_window_count"];

function colonnesAjoutees(texte) {
  return [...texte.matchAll(/alter table public\.guest_forms add column if not exists (\w+)/g)].map((m) => m[1]);
}

function colonnesAccordees(texte, droit) {
  const m = texte.match(new RegExp(`grant ${droit} \\(([^)]+)\\)\\s+on public\\.guest_forms to authenticated`));
  return m ? m[1].split(",").map((c) => c.trim()) : [];
}

describe("droits de colonne de guest_forms", () => {
  const formulaire = sql("formulaire.sql");
  const ajoutees = [...new Set([...colonnesAjoutees(formulaire), ...colonnesAjoutees(sql("mails-lecons.sql"))])];

  it("trouve bien les listes de droits", () => {
    expect(colonnesAccordees(formulaire, "insert")).toContain("fields");
    expect(colonnesAccordees(formulaire, "update")).toContain("fields");
    expect(ajoutees).toContain("shared_at");
  });

  for (const droit of ["insert", "update"]) {
    it(`accorde ${droit} sur chaque colonne que l'éditeur renvoie`, () => {
      const accordees = colonnesAccordees(formulaire, droit);
      for (const col of ajoutees.filter((c) => !SERVEUR.includes(c))) expect(accordees, col).toContain(col);
    });
  }
});

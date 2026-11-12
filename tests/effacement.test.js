import { describe, expect, it } from "vitest";
import { effacerMariage, estOrganisateur, mariagesDuCompte, retirerMails } from "@/lib/server/effacement";

const W = "11111111-1111-4111-8111-111111111111";
const SEUL = "22222222-2222-4222-8222-222222222222";

// Fausse base : juste les appels que fait effacement.js, et le journal des écritures pour vérifier l'ordre
function fausseBase() {
  const tables = {
    weddings: [
      { id: W, partner1: "Léo", partner2: "Léa", created_by: "u1" },
      { id: SEUL, partner1: "Léo", partner2: null, created_by: "u1" },
    ],
    wedding_members: [
      { id: "m1", wedding_id: W, user_id: "u1", display_name: "Léo" },
      { id: "m2", wedding_id: W, user_id: "u2", display_name: "Léa" },
      { id: "m3", wedding_id: W, user_id: null, display_name: "Parents de Léa" },
      { id: "m4", wedding_id: SEUL, user_id: "u1", display_name: "Léo" },
    ],
    mail_sent: [{ key: `activite:2026-11-10:${W}:a@exemple.fr` }, { key: "nouveautes:1:a@exemple.fr" }, { key: "nouveautes:1:a@exemple.fr.autre" }, { key: "nouveautes:1:lea@exemple.fr" }],
  };
  const fichiers = { "merry-covers": { [W]: [{ id: "f1", name: "couverture-1.jpg" }] }, "merry-documents": { [W]: [{ id: null, name: "dossier" }], [`${W}/dossier`]: [{ id: "f2", name: "devis.pdf" }] } };
  const journal = [];
  const like = (motif, v, casse) => new RegExp(`^${motif.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".")}$`, casse ? "i" : "").test(v);

  const from = (table) => {
    const filtres = [];
    let suppression = false;
    const q = {
      select: () => q,
      delete: () => ((suppression = true), q),
      eq: (c, v) => (filtres.push((r) => r[c] === v), q),
      in: (c, vs) => (filtres.push((r) => vs.includes(r[c])), q),
      not: (c) => (filtres.push((r) => r[c] != null), q),
      like: (c, m) => (filtres.push((r) => like(m, r[c], false)), q),
      ilike: (c, m) => (filtres.push((r) => like(m, r[c], true)), q),
      then: (ok) => {
        const lignes = tables[table].filter((r) => filtres.every((f) => f(r)));
        if (suppression) {
          tables[table] = tables[table].filter((r) => !lignes.includes(r));
          journal.push(`${table} -${lignes.length}`);
        }
        return Promise.resolve({ data: lignes, error: null }).then(ok);
      },
    };
    return q;
  };
  const admin = {
    from,
    storage: {
      from: (bucket) => ({
        list: async (prefix) => ({ data: fichiers[bucket][prefix] || [], error: null }),
        remove: async (chemins) => (journal.push(`${bucket} ${chemins.join(",")}`), { error: null }),
      }),
    },
  };
  return { admin, tables, journal };
}

describe("effacement d'un mariage", () => {
  it("donne chaque mariage du compte avec les autres organisateurs qui y ont un compte", async () => {
    const { admin } = fausseBase();
    expect(await mariagesDuCompte(admin, "u1")).toEqual([
      { id: W, couple: "Léo et Léa", autres: ["Léa"] },
      { id: SEUL, couple: "Léo", autres: [] },
    ]);
    expect(await mariagesDuCompte(admin, "u9")).toEqual([]);
  });

  it("retire les fichiers et les mails du mariage, puis le mariage", async () => {
    const { admin, tables, journal } = fausseBase();
    expect(await effacerMariage(admin, W)).toEqual({ fichiers: 2, mails: 1 });
    expect(journal).toEqual([`merry-covers ${W}/couverture-1.jpg`, `merry-documents ${W}/dossier/devis.pdf`, "mail_sent -1", "weddings -1"]);
    expect(tables.weddings.map((w) => w.id)).toEqual([SEUL]);
  });

  it("retire les mails d'une adresse sans toucher à ceux qui finissent autrement", async () => {
    const { admin, tables } = fausseBase();
    expect(await retirerMails(admin, null, ["A@exemple.fr"])).toBe(2);
    expect(tables.mail_sent.map((m) => m.key)).toEqual(["nouveautes:1:a@exemple.fr.autre", "nouveautes:1:lea@exemple.fr"]);
  });

  it("n'accepte que les organisateurs du mariage", async () => {
    const { admin } = fausseBase();
    expect(await estOrganisateur(admin, "u2", W)).toBe(true);
    expect(await estOrganisateur(admin, "u2", SEUL)).toBe(false);
  });
});

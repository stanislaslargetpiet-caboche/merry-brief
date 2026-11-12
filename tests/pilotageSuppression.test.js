import { describe, expect, it } from "vitest";
import { clesMails, planSuppression, sortDesComptes, supprimerCouple } from "@/lib/server/pilotage/suppression";

const W = "11111111-1111-4111-8111-111111111111";
const AUTRE = "22222222-2222-4222-8222-222222222222";

describe("sortDesComptes", () => {
  it("garde les comptes du pilotage, ceux d'un autre mariage et ceux de l'espace prestataire", () => {
    const comptes = [
      { id: "a", email: "a@exemple.fr" },
      { id: "b", email: "Pilote@exemple.fr" },
      { id: "c", email: "c@exemple.fr" },
      { id: "d", email: "d@exemple.fr" },
    ];
    const sorts = sortDesComptes(comptes, { autres: new Map([["c", ["Emma et Hugo"]]]), pros: new Set(["d"]), pilotes: new Set(["pilote@exemple.fr"]) });
    expect(sorts.map((s) => s.garde)).toEqual([null, "accès au pilotage", "aussi dans Emma et Hugo", "espace prestataire"]);
  });
});

describe("clesMails", () => {
  it("prend les clés du mariage et celles qui finissent par une adresse supprimée, rien d'autre", () => {
    const keys = [`activite:2026-11-10:${W}:a@exemple.fr`, `formulaire:${W}:2026-11-11:garde@exemple.fr`, "nouveautes:1:a@exemple.fr", "nouveautes:1:a@exemple.fr.autre", "nouveautes:1:b@exemple.fr", `activite:2026-11-10:${AUTRE}:b@exemple.fr`];
    expect(clesMails(keys, W, ["A@exemple.fr"])).toEqual(keys.slice(0, 3));
  });
});

// Fausse base : juste les appels que fait suppression.js, et le journal des écritures pour vérifier l'ordre
function fausseBase() {
  const tables = {
    weddings: [
      { id: W, partner1: "Léo", partner2: "Léa", created_by: "u1" },
      { id: AUTRE, partner1: "Emma", partner2: "Hugo", created_by: "u3" },
    ],
    wedding_members: [
      { wedding_id: W, user_id: "u1" },
      { wedding_id: W, user_id: "u2" },
      { wedding_id: W, user_id: "u3" },
      { wedding_id: W, user_id: null },
      { wedding_id: AUTRE, user_id: "u3" },
    ],
    pro_members: [],
    mail_sent: [{ key: `activite:2026-11-10:${W}:a@exemple.fr` }, { key: "nouveautes:1:a@exemple.fr" }, { key: "nouveautes:1:emma@exemple.fr" }],
  };
  const users = { u1: "a@exemple.fr", u2: "pilote@exemple.fr", u3: "emma@exemple.fr" };
  const fichiers = { "merry-covers": { [W]: [{ id: "f1", name: "couverture-1.jpg" }] }, "merry-documents": { [W]: [{ id: null, name: "sans-dossier" }], [`${W}/sans-dossier`]: [{ id: "f2", name: "x-devis.pdf" }] } };
  const journal = [];
  const like = (motif, v, casse) => new RegExp(`^${motif.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".")}$`, casse ? "i" : "").test(v);

  const from = (table) => {
    const filtres = [];
    let suppression = false;
    const q = {
      select: () => q,
      delete: () => ((suppression = true), q),
      eq: (c, v) => (filtres.push((r) => r[c] === v), q),
      neq: (c, v) => (filtres.push((r) => r[c] !== v), q),
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
    auth: {
      admin: {
        getUserById: async (id) => ({ data: users[id] ? { user: { id, email: users[id] } } : { user: null }, error: null }),
        deleteUser: async (id) => (journal.push(`compte ${id}`), { error: null }),
      },
    },
  };
  return { admin, tables, journal };
}

describe("suppression d'un couple", () => {
  const pilotes = new Set(["pilote@exemple.fr"]);

  it("annonce les comptes supprimés et gardés, et les fichiers rangés dans les sous-dossiers", async () => {
    const { admin } = fausseBase();
    const plan = await planSuppression(admin, W, pilotes);
    expect(plan.couple).toBe("Léo et Léa");
    expect(plan.comptes).toEqual([
      { id: "u1", email: "a@exemple.fr", garde: null },
      { id: "u2", email: "pilote@exemple.fr", garde: "accès au pilotage" },
      { id: "u3", email: "emma@exemple.fr", garde: "aussi dans Emma et Hugo" },
    ]);
    expect(plan.fichiers.map((f) => f.chemin)).toEqual([`${W}/couverture-1.jpg`, `${W}/sans-dossier/x-devis.pdf`]);
  });

  it("retire fichiers, mails et comptes avant le mariage, qui part en dernier", async () => {
    const { admin, tables, journal } = fausseBase();
    const fait = await supprimerCouple(admin, W, pilotes);
    expect(journal).toEqual([`merry-covers ${W}/couverture-1.jpg`, `merry-documents ${W}/sans-dossier/x-devis.pdf`, "mail_sent -2", "compte u1", "weddings -1"]);
    expect(tables.mail_sent).toEqual([{ key: "nouveautes:1:emma@exemple.fr" }]);
    expect(fait).toEqual({ couple: "Léo et Léa", comptes: 1, gardes: [{ email: "pilote@exemple.fr", garde: "accès au pilotage" }, { email: "emma@exemple.fr", garde: "aussi dans Emma et Hugo" }], fichiers: 2, mails: 2 });
  });

  it("ne touche à rien quand le mariage n'existe plus", async () => {
    const { admin, journal } = fausseBase();
    expect(await supprimerCouple(admin, "33333333-3333-4333-8333-333333333333", pilotes)).toBeNull();
    expect(journal).toEqual([]);
  });
});

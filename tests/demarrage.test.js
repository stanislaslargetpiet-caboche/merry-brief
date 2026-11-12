import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demarrageMail, joinFr, memberLabel, stanMail } from "../lib/server/demarrageMail.js";
import { nextStep, planSteps, runDemarrage, soirsAVenir, weddingState } from "../lib/server/demarrageJob.js";
import { apercuCouple, historique } from "../lib/server/pilotage/demarrage.js";

const origin = "https://app.withmerry.com";
const unsub = "https://app.withmerry.com/desinscription?e=x&t=y&k=demarrage";
const couple = { id: "m1", role: "couple", user_id: "u1", display_name: "Léa" };
const thomas = { id: "m2", role: "couple", user_id: null, display_name: "Thomas", position: 1 };
const parentsLea = { id: "m3", role: "parents", user_id: null, display_name: "Parents de Léa", position: 2 };
const parentsThomas = { id: "m4", role: "parents", user_id: null, display_name: "Parents de Thomas", position: 3 };
const base = { origin, unsub, firstName: "Léa", partnerName: "Thomas", me: "m1", members: [couple, thomas, parentsLea, parentsThomas] };

describe("phrases", () => {
  it("assemble une liste à la française", () => {
    expect(joinFr(["Thomas"])).toBe("Thomas");
    expect(joinFr(["Thomas", "tes parents", "les parents de Thomas"])).toBe("Thomas, tes parents et les parents de Thomas");
  });
  it("nomme les parents selon le destinataire", () => {
    expect(memberLabel(parentsLea, "Léa")).toEqual({ label: "tes parents", plural: true });
    expect(memberLabel(parentsLea, "Thomas")).toEqual({ label: "les parents de Léa", plural: true });
    expect(memberLabel({ display_name: "Parents d'Inès" }, "Léa").label).toBe("les parents d’Inès");
    expect(memberLabel({ display_name: "Parents de Astrid" }, "Côme").label).toBe("les parents d’Astrid");
    expect(memberLabel({ display_name: "Parents de Élodie" }, "Côme").label).toBe("les parents d’Élodie");
    expect(memberLabel({ display_name: "Parents de Côme" }, "Côme").label).toBe("tes parents");
    expect(memberLabel(thomas, "Léa")).toEqual({ label: "Thomas", plural: false });
  });
});

describe("demarrageMail", () => {
  it("J+1 : reprend la fourchette d'invités, le partenaire et les parents", () => {
    const mail = demarrageMail("invites", { ...base, brief: { guests: "100-150" }, guestCount: 0 });
    expect(mail.subject).toBe("Fini les listes d’invités sur trois Excel différents");
    expect(mail.text).toContain("Bonjour Léa, tu prévois entre 100 et 150 invités et ta liste n’en compte encore aucun.");
    expect(mail.text).toContain("Si Thomas ou vos parents ont commencé la leur, importe-les aussi");
    expect(mail.text).toContain(`${origin}/dashboard/invites/importer?utm_source=mail&utm_medium=email&utm_campaign=demarrage-invites`);
    expect(mail.html).toContain("/mail/demarrage/invites.png");
    expect(mail.html).toContain("Ne plus recevoir ces conseils");
    expect(mail.html).toContain("telle quelle&nbsp;; une photo suffit");
  });

  it("J+1 : compte les invités déjà là, sans fourchette ni parents", () => {
    const mail = demarrageMail("invites", { ...base, members: [couple, thomas], brief: null, guestCount: 1 });
    expect(mail.text).toContain("ta liste ne compte encore qu’un invité.");
    expect(mail.text).toContain("Si Thomas a commencé la sienne, importe-la aussi : Merry réunit les deux listes");
    expect(demarrageMail("invites", { ...base, brief: { guests: ">200" }, guestCount: 4 }).text).toContain("plus de 200 invités et ta liste n’en compte encore que 4.");
  });

  it("J+2 : nomme chaque personne sans accès", () => {
    const mail = demarrageMail("equipe", { ...base, team: [thomas, parentsLea, parentsThomas] });
    expect(mail.subject).toBe("Fini les boucles WhatsApp à rallonge");
    expect(mail.preheader).toBe("Thomas, tes parents et les parents de Thomas n’ont pas encore accès à ton espace Merry.");
    expect(mail.text).toContain("tu as indiqué que Thomas, tes parents et les parents de Thomas participent à l’organisation du mariage, mais aucun d’eux n’a encore accès à ton espace.");
    expect(mail.text).toContain("Avec un accès, chacun peut ajouter ses propres invités");
    expect(mail.text).toContain("utm_campaign=demarrage-equipe#organisateurs");
  });

  it("J+2 : accorde avec une seule personne", () => {
    const one = demarrageMail("equipe", { ...base, team: [thomas] });
    expect(one.text).toContain("tu as indiqué que Thomas participe à l’organisation du mariage, mais n’a pas encore accès à ton espace.");
    expect(one.text).toContain("Avec un accès, Thomas peut ajouter ses propres invités");
    const parents = demarrageMail("equipe", { ...base, team: [parentsLea] });
    expect(parents.text).toContain("que tes parents participent à l’organisation du mariage, mais n’ont pas encore accès");
    expect(parents.text).toContain("Avec un accès, tes parents peuvent ajouter leurs propres invités");
  });

  it("J+3 : reprend le budget prévu et la part de chacun", () => {
    const mail = demarrageMail("budget", { ...base, budgetTotal: 25000 });
    expect(mail.subject).toBe("Fini le budget sur des bouts de papier");
    expect(mail.text).toContain("tu as prévu un budget de 25 000 €. Il reste à indiquer la part de chacun, la vôtre, celle de tes parents et celle des parents de Thomas, puis à ajouter tes premières dépenses");
    expect(mail.text).toContain("Tu vois ensuite, pour chacun, ce qui a déjà été payé");
    expect(mail.html).toContain("25&nbsp;000&nbsp;€");
  });

  it("J+3 : élide devant une voyelle", () => {
    const members = [{ id: "c1", role: "couple", display_name: "Côme" }, { id: "c2", role: "couple", display_name: "Astrid" }, { id: "c3", role: "parents", display_name: "Parents de Côme" }, { id: "c4", role: "parents", display_name: "Parents de Astrid" }];
    const mail = demarrageMail("budget", { ...base, firstName: "Côme", partnerName: "Astrid", me: "c1", members, budgetTotal: 25000 });
    expect(mail.text).toContain("la vôtre, celle de tes parents et celle des parents d’Astrid");
  });

  it("J+3 : sans montant prévu ni parents", () => {
    const mail = demarrageMail("budget", { ...base, members: [couple, thomas], budgetTotal: null });
    expect(mail.text).toContain("ton budget n’a pas encore de montant prévu. Il reste à le fixer, à indiquer ce que chacun de vous deux finance, puis à ajouter");
  });

  it("n'écrit pas de prénom vide", () => {
    expect(demarrageMail("invites", { ...base, firstName: "", guestCount: 0 }).text).toContain("Bonjour, ta liste d’invités est encore vide.");
  });
});

describe("stanMail", () => {
  const ctx = { ...base, createdAt: "2026-11-10T09:00:00Z", now: new Date("2026-11-13T19:05:00Z"), weddingDate: "2027-09-12" };
  it("écrit comme un mail personnel, sans lien de rendez-vous par défaut", () => {
    const mail = stanMail({ ...ctx, rdv: "" });
    expect(mail.subject).toBe("Ton mariage sur Merry");
    expect(mail.text).toContain("Tu as créé ton espace Merry mardi pour préparer ton mariage du 12 septembre 2027.");
    expect(mail.text).toContain("Bonne soirée,\nStan\nFondateur de Merry");
    expect(mail.text).not.toContain("quinze minutes");
    expect(mail.html).not.toContain("<img");
  });
  it("propose l'appel quand le lien existe", () => {
    const mail = stanMail({ ...ctx, rdv: "https://cal.example/stan" });
    expect(mail.text).toContain("réserver un appel de quinze minutes : https://cal.example/stan");
    expect(mail.html).toContain(">cal.example/stan</a>");
  });
});

describe("nextStep", () => {
  const all = { invites: true, equipe: true, budget: true };
  it("suit l'ordre invités, équipe, budget", () => {
    expect(nextStep([], all, true)).toBe("invites");
    expect(nextStep(["invites"], all, true)).toBe("equipe");
  });
  it("saute une étape déjà faite", () => {
    expect(nextStep([], { invites: false, equipe: true, budget: true }, false)).toBe("equipe");
    expect(nextStep(["invites"], { invites: true, equipe: false, budget: true }, false)).toBe("budget");
  });
  it("remplace le troisième mail par celui de Stan quand rien n'a bougé", () => {
    expect(nextStep(["invites", "equipe"], all, true)).toBe("stan");
    expect(nextStep(["invites", "equipe"], all, false)).toBe("budget");
  });
  it("s'arrête après le budget, le mot de Stan, trois mails ou tout fait", () => {
    expect(nextStep(["invites", "budget"], all, false)).toBeNull();
    expect(nextStep(["invites", "equipe", "stan"], all, true)).toBeNull();
    expect(nextStep([], { invites: false, equipe: false, budget: false }, false)).toBeNull();
  });
});

describe("weddingState", () => {
  const wedding = { created_at: "2026-11-12T10:00:00Z" };
  const seeded = { created_at: "2026-11-12T10:00:01Z", quote_amount: null };
  it("ne compte pas les postes créés avec le mariage", () => {
    const s = weddingState({ wedding, me: "m1", members: base.members, guestCount: 0, items: [seeded], payments: [] });
    expect(s.pending).toEqual({ invites: true, equipe: true, budget: true });
    expect(s.nothingMoved).toBe(true);
    expect(s.team.map((m) => m.id)).toEqual(["m2", "m3", "m4"]);
  });
  it("voit une part, un devis, un paiement ou une invitation", () => {
    const moved = (patch) => weddingState({ wedding, me: "m1", members: base.members, guestCount: 0, items: [seeded], payments: [], ...patch });
    expect(moved({ members: [couple, { ...thomas, contribution: 5000 }] }).pending.budget).toBe(false);
    expect(moved({ items: [{ ...seeded, quote_amount: 3000 }] }).pending.budget).toBe(false);
    expect(moved({ items: [{ created_at: "2026-11-12T18:00:00Z", quote_amount: null }] }).pending.budget).toBe(false);
    expect(moved({ payments: [{}] }).pending.budget).toBe(false);
    const invited = moved({ members: [couple, { ...thomas, invited_at: "2026-11-12T12:00:00Z" }] });
    expect(invited.pending.equipe).toBe(false);
    expect(invited.nothingMoved).toBe(false);
    expect(moved({ guestCount: 12 }).pending.invites).toBe(false);
  });
  it("ne relance pas l'équipe quand quelqu'un d'autre que le couple est déjà entré", () => {
    // Les parents de Thomas sont venus sous leurs prénoms ; la ligne « Parents de Léa » de l'onboarding reste vide
    const hubert = { id: "m5", role: "organisateur", user_id: "u5", display_name: "Hubert", invited_at: "2026-11-08T18:29:46Z" };
    const s = weddingState({ wedding, me: "m1", members: [couple, thomas, parentsLea, hubert], guestCount: 0, items: [seeded], payments: [] });
    expect(s.pending.equipe).toBe(false);
    // Le partenaire qui a son compte ne suffit pas : les parents restent à inviter
    const both = weddingState({ wedding, me: "m1", members: [couple, { ...thomas, user_id: "u2" }, parentsLea], guestCount: 0, items: [seeded], payments: [] });
    expect(both.pending.equipe).toBe(true);
    expect(both.team.map((m) => m.id)).toEqual(["m3"]);
  });
});

// Client Supabase de test : filtres eq, in, gte, lt, like, order, limit et comptage seul, comme les vraies requêtes
function fakeAdmin(tables, { optouts = [], sent = [] } = {}) {
  const mailSent = [...sent];
  const from = (table) => {
    if (table === "mail_sent") {
      let rows = mailSent;
      const chain = {
        insert: async ({ key }) => {
          if (mailSent.some((r) => r.key === key)) return { error: { code: "23505", message: "doublon" } };
          mailSent.push({ key, sent_at: new Date().toISOString() });
          return {};
        },
        delete: () => ({ eq: async (_c, key) => mailSent.splice(mailSent.findIndex((r) => r.key === key), 1) }),
        select: () => chain,
        like: (_c, pattern) => {
          const re = new RegExp(`^${pattern.split("%").map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*")}$`);
          rows = rows.filter((r) => re.test(r.key));
          return chain;
        },
        gte: (_c, v) => {
          rows = rows.filter((r) => r.sent_at >= v);
          return chain;
        },
        order: () => {
          rows = [...rows].sort((a, b) => (a.sent_at < b.sent_at ? -1 : 1));
          return chain;
        },
        limit: () => chain,
        then: (ok) => ok({ data: rows }),
      };
      return chain;
    }
    let rows = table === "mail_optouts" ? optouts.map((email) => ({ email })) : tables[table] || [];
    let head = false;
    const chain = {
      select: (_cols, opts) => {
        head = Boolean(opts?.head);
        return chain;
      },
      eq: (c, v) => {
        rows = rows.filter((r) => !(c in r) || r[c] === v);
        return chain;
      },
      in: (c, list) => {
        rows = rows.filter((r) => !(c in r) || list.includes(r[c]));
        return chain;
      },
      gte: (c, v) => {
        rows = rows.filter((r) => r[c] >= v);
        return chain;
      },
      lt: (c, v) => {
        rows = rows.filter((r) => r[c] < v);
        return chain;
      },
      then: (ok) => ok(head ? { count: rows.length } : { data: rows }),
    };
    return chain;
  };
  return { from, mailSent, auth: { admin: { getUserById: async () => ({ data: { user: { email: "lea.bernard@example.com" } } }) } } };
}

describe("runDemarrage", () => {
  let mails;
  beforeEach(() => {
    mails = [];
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service");
    vi.stubGlobal("fetch", async (_url, init) => {
      mails.push(JSON.parse(init.body));
      return { ok: true };
    });
  });

  const tables = {
    weddings: [{ id: "w1", created_at: "2026-11-12T10:00:00Z", created_by: "u1", brief_id: "b1", partner1: "Léa", partner2: "Thomas", wedding_date: "2027-09-12", budget_total: 25000 }],
    wedding_members: [
      { ...couple, wedding_id: "w1", email: "" },
      { ...thomas, wedding_id: "w1", email: null },
      { ...parentsLea, wedding_id: "w1", email: null },
    ],
    briefs: [{ id: "b1", guests: "100-150", first_name: "léa" }],
    budget_items: [{ wedding_id: "w1", created_at: "2026-11-12T10:00:01Z", quote_amount: null }],
    payments: [],
    guests: [],
  };
  const env = { MERRY_LIEN_RDV: "" };
  const evening = (day) => new Date(`2026-11-${day}T19:05:00Z`);

  it("n'écrit rien le soir même de l'inscription", async () => {
    const report = await runDemarrage(fakeAdmin(tables), origin, evening(12), { env });
    expect(report.envoyes).toBe(0);
    expect(mails).toHaveLength(0);
  });

  afterEach(() => vi.useRealTimers());

  it("envoie un mail par soir, puis le mot de Stan si rien n'a bougé", async () => {
    // L'heure de l'envoi date la ligne de mail_sent, comme en base
    vi.useFakeTimers({ toFake: ["Date"] });
    const run = (day) => {
      vi.setSystemTime(evening(day));
      return runDemarrage(admin, origin, evening(day), { env });
    };
    const admin = fakeAdmin(tables);
    expect((await run(13)).etapes).toEqual({ invites: 1 });
    expect(mails[0].to).toEqual(["lea.bernard@example.com"]);
    expect(mails[0].subject).toBe("Fini les listes d’invités sur trois Excel différents");
    expect(mails[0].headers["List-Unsubscribe"]).toContain("k=demarrage");
    // Second passage du même soir : un mail de démarrage est déjà parti aujourd'hui
    expect((await run(13)).envoyes).toBe(0);
    expect((await run(14)).etapes).toEqual({ equipe: 1 });
    expect(mails[1].html).toContain("Thomas et tes parents");
    expect((await run(15)).etapes).toEqual({ stan: 1 });
    expect(mails[2].from).toBe('"Stan de Merry" <onboarding@resend.dev>');
    expect(mails[2].reply_to).toBe("bonjour@withmerry.com");
    expect(mails[2].text).toContain("Tu as créé ton espace Merry jeudi");
    expect((await run(16)).envoyes).toBe(0);
    expect(mails).toHaveLength(3);
  });

  // Inscrit le 22 octobre, avant la séquence ; ses parents n'ont pas d'accès
  const ancien = {
    ...tables,
    weddings: [...tables.weddings, { id: "w0", created_at: "2026-10-22T10:00:00Z", created_by: "u9", brief_id: null, partner1: "Ana", partner2: "Bo", wedding_date: null, budget_total: null }],
    wedding_members: [
      ...tables.wedding_members,
      { id: "m9", wedding_id: "w0", role: "couple", user_id: "u9", display_name: "Ana", email: "ana@example.com" },
      { id: "m8", wedding_id: "w0", role: "parents", user_id: null, display_name: "Parents d'Ana", email: null, position: 2 },
    ],
  };

  it("écrit aussi aux couples inscrits avant la séquence", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const admin = fakeAdmin(ancien);
    const run = (day) => {
      vi.setSystemTime(evening(day));
      return runDemarrage(admin, origin, evening(day), { env });
    };
    expect((await run(13)).etapes).toEqual({ invites: 2 });
    expect(mails.map((m) => m.to[0]).sort()).toEqual(["ana@example.com", "lea.bernard@example.com"]);
    expect((await run(14)).etapes).toEqual({ equipe: 2 });
    expect((await run(15)).etapes).toEqual({ stan: 2 });
    expect(mails.find((m) => m.to[0] === "ana@example.com" && m.subject === "Ton mariage sur Merry").text).toContain("Tu as créé ton espace Merry le 22 octobre");
  });

  it("ne reprend plus les anciens couples sept jours après le premier mail de démarrage", async () => {
    const admin = fakeAdmin(ancien, { sent: [{ key: "demarrage:invites:w7:zoe@example.com", sent_at: "2026-11-05T19:05:00Z" }] });
    const report = await runDemarrage(admin, origin, evening(13), { env });
    expect(report.mariages).toBe(1);
    expect(mails.map((m) => m.to[0])).toEqual(["lea.bernard@example.com"]);
  });

  it("passe à l'étape suivante quand la liste d'invités est déjà là", async () => {
    const guests = Array.from({ length: 12 }, (_, i) => ({ id: `g${i}`, wedding_id: "w1" }));
    const report = await runDemarrage(fakeAdmin({ ...tables, guests }), origin, evening(13), { env });
    expect(report.etapes).toEqual({ equipe: 1 });
  });

  it("attend le lendemain quand un autre mail de Merry est parti ce jour-là", async () => {
    const admin = fakeAdmin(tables, { sent: [{ key: "activite:2026-11-13:w1:lea.bernard@example.com", sent_at: "2026-11-13T19:01:00Z" }] });
    const report = await runDemarrage(admin, origin, evening(13), { env });
    expect(report.envoyes).toBe(0);
    expect(report.ignores).toBe(1);
  });

  it("n'écrit ni aux désinscrits ni aux comptes de test", async () => {
    expect((await runDemarrage(fakeAdmin(tables, { optouts: ["lea.bernard@example.com"] }), origin, evening(13), { env })).envoyes).toBe(0);
    const test = { ...tables, wedding_members: tables.wedding_members.map((m) => (m.id === "m1" ? { ...m, email: "lea.test@example.com" } : m)) };
    expect((await runDemarrage(fakeAdmin(test), origin, evening(13), { env })).envoyes).toBe(0);
    // Une démo créée par un compte de test, où un vrai compte a été invité : rien non plus
    const demo = { ...test, wedding_members: test.wedding_members.map((m) => (m.id === "m2" ? { ...m, user_id: "u2", email: "thomas@example.com" } : m)) };
    expect((await runDemarrage(fakeAdmin(demo), origin, evening(13), { env })).envoyes).toBe(0);
    expect(mails).toHaveLength(0);
  });

  it("compte sans envoyer en essai", async () => {
    const admin = fakeAdmin(tables);
    const report = await runDemarrage(admin, origin, evening(13), { env, dry: true });
    expect(report.etapes).toEqual({ invites: 1 });
    expect(mails).toHaveLength(0);
    expect(admin.mailSent).toHaveLength(0);
  });

  // Couples › Funnel du pilotage (D-289) : couple sorti, mail retiré, planning
  it("n'écrit plus à un couple sorti des mails de démarrage", async () => {
    const report = await runDemarrage(fakeAdmin({ ...tables, demarrage_retraits: [{ wedding_id: "w1", etape: "tout" }] }), origin, evening(13), { env });
    expect(report.envoyes).toBe(0);
    expect(mails).toHaveLength(0);
  });

  it("saute un mail retiré depuis le pilotage", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const admin = fakeAdmin({ ...tables, demarrage_retraits: [{ wedding_id: "w1", etape: "equipe" }] });
    const run = (day) => {
      vi.setSystemTime(evening(day));
      return runDemarrage(admin, origin, evening(day), { env });
    };
    expect((await run(13)).etapes).toEqual({ invites: 1 });
    expect((await run(14)).etapes).toEqual({ budget: 1 });
    expect((await run(15)).envoyes).toBe(0);
  });

  it("donne au pilotage le planning d'un couple et ses mails déjà partis", async () => {
    const sent = [
      { key: "activite:2026-11-12:w1:lea.bernard@example.com", sent_at: "2026-11-12T19:01:00Z" },
      { key: "nouveautes:1:lea.bernard@example.com", sent_at: "2026-11-07T07:00:00Z" },
      { key: "formulaire:w2:2026-11-12:autre@example.com", sent_at: "2026-11-12T19:00:00Z" },
    ];
    const admin = fakeAdmin({ ...tables, demarrage_retraits: [{ wedding_id: "w1", etape: "equipe" }] }, { sent });
    const a = await apercuCouple(admin, "w1", origin, new Date("2026-11-12T12:00:00Z"), env);
    expect(a.couple).toBe("Léa et Thomas");
    expect(a.a_venir.map((m) => [m.etape, m.soir, m.a])).toEqual([
      ["invites", "2026-11-13T19:00:00.000Z", ["Léa"]],
      ["budget", "2026-11-14T19:00:00.000Z", ["Léa"]],
    ]);
    expect(a.a_venir[0].objet).toBe("Fini les listes d’invités sur trois Excel différents");
    expect(a.a_venir[0].html).toContain("Importe ta liste");
    expect(a.retires).toEqual([{ etape: "equipe", titre: "Invite les autres organisateurs" }]);
    expect(a.envoyes).toEqual([
      { libelle: "Mail de 20 h", at: "2026-11-12T19:01:00Z", a: "Léa" },
      { libelle: "Du nouveau sur Merry, n° 1", at: "2026-11-07T07:00:00Z", a: "Léa" },
    ]);
    const sorti = await apercuCouple(fakeAdmin({ ...tables, demarrage_retraits: [{ wedding_id: "w1", etape: "tout" }] }), "w1", origin, new Date("2026-11-12T12:00:00Z"), env);
    expect(sorti.sorti).toBe(true);
    expect(sorti.a_venir).toEqual([]);
    expect(await apercuCouple(fakeAdmin(tables), "w9", origin, new Date(), env)).toBeNull();
  });
});

describe("planning du pilotage", () => {
  const all = { invites: true, equipe: true, budget: true };
  it("saute les mails retirés ; le mail budget remplace le mot de Stan retiré", () => {
    expect(nextStep([], all, true, ["invites"])).toBe("equipe");
    expect(nextStep(["invites", "equipe"], all, true, ["stan"])).toBe("budget");
    expect(nextStep(["invites"], all, true, ["equipe", "budget"])).toBeNull();
  });
  it("projette un mail par soir tant que rien ne bouge", () => {
    const soirs = [13, 14, 15, 16].map((d) => new Date(`2026-11-${d}T19:00:00Z`));
    expect(planSteps([], all, true, [], soirs).map((p) => p.etape)).toEqual(["invites", "equipe", "stan"]);
    expect(planSteps(["invites"], all, false, ["equipe"], soirs)).toEqual([{ etape: "budget", soir: soirs[0] }]);
    expect(planSteps([], all, true, [], soirs.slice(0, 1)).map((p) => p.etape)).toEqual(["invites"]);
  });
  it("commence le soir qui suit l'inscription et s'arrête après sept jours", () => {
    const iso = (soirs) => soirs.map((d) => d.toISOString().slice(0, 16));
    // Inscrit le 12 à 11 h : rien ce soir-là, puis chaque soir jusqu'au septième jour après l'inscription
    const neuf = iso(soirsAVenir(new Date("2026-11-12T12:00:00Z"), "2026-11-12T10:00:00Z", null));
    expect(neuf[0]).toBe("2026-11-13T19:00");
    expect(neuf.at(-1)).toBe("2026-11-19T19:00");
    expect(neuf).toHaveLength(7);
    // Après 20 h, la tâche est passée : on part du lendemain
    expect(iso(soirsAVenir(new Date("2026-11-13T19:30:00Z"), "2026-11-10T10:00:00Z", null))[0]).toBe("2026-11-14T19:00");
    // Inscrit avant la séquence, sept jours après le premier envoi : plus rien
    expect(soirsAVenir(new Date("2026-11-13T12:00:00Z"), "2026-10-22T10:00:00Z", "2026-11-05T19:05:00Z")).toEqual([]);
  });
  it("nomme les mails déjà partis", () => {
    const rows = [
      { key: "demarrage:stan:w1:a@example.com", sent_at: "2026-11-15T19:00:00Z" },
      { key: "formulaire:w1:2026-11-14:a@example.com", sent_at: "2026-11-14T19:00:00Z" },
    ];
    expect(historique(rows, () => "Ana")).toEqual([
      { libelle: "Le mot de Stan", at: "2026-11-15T19:00:00Z", a: "Ana" },
      { libelle: "Réponses au formulaire", at: "2026-11-14T19:00:00Z", a: "Ana" },
    ]);
  });
});

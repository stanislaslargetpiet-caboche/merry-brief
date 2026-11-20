import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demarrageProMail } from "../lib/server/demarrageProMail.js";
import { ficheState, nextStep, runDemarragePro } from "../lib/server/demarrageProJob.js";

const origin = "https://app.withmerry.com";
const unsub = "https://app.withmerry.com/desinscription?e=x&t=y&k=demarrage_pro";
const base = { origin, unsub, vendorName: "Le Mas de la Source", category: "lieu" };

describe("demarrageProMail", () => {
  it("photos : compte les photos de la fiche", () => {
    const one = demarrageProMail("photos", { ...base, photoCount: 1 });
    expect(one.subject).toBe("Fini la fiche avec une seule photo");
    expect(one.text).toContain("Une fiche complète en trois photos");
    expect(one.text).toContain("Bonjour, ta fiche Le Mas de la Source n’a encore qu’une photo, et il en faut au moins trois");
    expect(one.text).toContain(`${origin}/pro/fiche?utm_source=mail&utm_medium=email&utm_campaign=demarrage-pro-photos#photos`);
    expect(one.html).toContain("/mail/demarrage/pro-photos.png");
    expect(one.html).toContain("tu gères la fiche Le Mas de la Source");
    expect(demarrageProMail("photos", { ...base, photoCount: 0 }).subject).toBe("Fini la fiche sans photo");
    expect(demarrageProMail("photos", { ...base, photoCount: 2 }).text).toContain("n’a encore que deux photos");
  });

  it("tarifs : l'option du lendemain seulement pour un lieu", () => {
    const lieu = demarrageProMail("tarifs", base);
    expect(lieu.subject).toBe("Fini le « c’est combien ? » en premier message");
    expect(lieu.text).toContain("Le prix le plus bas devient le « À partir de »");
    expect(lieu.text).toContain("brunch du lendemain");
    expect(lieu.html).toContain("«&nbsp;À partir de&nbsp;»");
    expect(demarrageProMail("tarifs", { ...base, category: "traiteur" }).text).not.toContain("brunch");
  });

  it("calendrier : renvoie vers Calendrier & Tarifs", () => {
    const mail = demarrageProMail("calendrier", base);
    expect(mail.subject).toBe("Fini les demandes pour une date déjà prise");
    expect(mail.text).toContain("Ton calendrier, lu à chaque demande");
    expect(mail.text).toContain(`${origin}/pro/tarifs?utm_source=mail&utm_medium=email&utm_campaign=demarrage-pro-calendrier`);
    expect(mail.text).toContain("Ne plus recevoir ces conseils : " + unsub);
  });
});

describe("étapes", () => {
  it("saute ce qui est fait, trois mails au plus", () => {
    expect(ficheState({ photos: 3, formules: 1, dates: 0 })).toEqual({ photos: false, tarifs: false, calendrier: true });
    const all = ficheState({});
    expect(nextStep([], all)).toBe("photos");
    expect(nextStep(["photos"], all)).toBe("tarifs");
    expect(nextStep(["photos", "tarifs"], all)).toBe("calendrier");
    expect(nextStep(["photos", "tarifs", "calendrier"], all)).toBeNull();
    expect(nextStep([], ficheState({ photos: 5, formules: 2, dates: 4 }))).toBeNull();
  });
});

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
    const chain = {
      select: () => chain,
      eq: (c, v) => {
        rows = rows.filter((r) => !(c in r) || r[c] === v);
        return chain;
      },
      in: (c, list) => {
        rows = rows.filter((r) => !(c in r) || list.includes(r[c]));
        return chain;
      },
      then: (ok) => ok({ data: rows }),
    };
    return chain;
  };
  return { from, schema: () => ({ from }), mailSent, auth: { admin: { getUserById: async () => ({ data: { user: { email: "claire@example.com" } } }) } } };
}

describe("runDemarragePro", () => {
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
  afterEach(() => vi.useRealTimers());

  const tables = {
    pro_vendors: [{ vendor_id: "v1", claimed_at: "2026-11-01T10:00:00Z", verified_at: "2026-11-20T10:00:00Z", verification: "validee" }],
    pro_members: [
      { vendor_id: "v1", user_id: "u1", email: null },
      { vendor_id: "v1", user_id: null, email: "invite@example.com" },
    ],
    pro_formulas: [],
    pro_options: [],
    pro_dates: [],
    vendors: [{ id: "v1", name: "Le Mas de la Source", primary_category: "lieu" }],
    vendor_photos: [{ vendor_id: "v1" }],
  };
  const env = {};
  const evening = (day) => new Date(`2026-11-${day}T19:05:00Z`);

  it("rien le soir de la validation, puis photos, tarifs, calendrier", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const admin = fakeAdmin(tables);
    const run = (day) => {
      vi.setSystemTime(evening(day));
      return runDemarragePro(admin, origin, evening(day), { env });
    };
    expect((await run(20)).envoyes).toBe(0);
    expect((await run(21)).etapes).toEqual({ photos: 1 });
    expect(mails[0].to).toEqual(["claire@example.com"]);
    expect(mails[0].from).toContain("Stan de Merry");
    expect(mails[0].reply_to).toBe("bonjour@withmerry.com");
    expect(mails[0].headers["List-Unsubscribe"]).toContain("k=demarrage_pro");
    expect((await run(21)).envoyes).toBe(0);
    expect((await run(22)).etapes).toEqual({ tarifs: 1 });
    expect((await run(23)).etapes).toEqual({ calendrier: 1 });
    expect((await run(24)).envoyes).toBe(0);
    expect(mails).toHaveLength(3);
  });

  it("saute les étapes faites", async () => {
    const done = { ...tables, vendor_photos: [1, 2, 3].map(() => ({ vendor_id: "v1" })), pro_options: [{ vendor_id: "v1" }] };
    const report = await runDemarragePro(fakeAdmin(done), origin, evening(21), { env });
    expect(report.etapes).toEqual({ calendrier: 1 });
  });

  it("n'écrit ni aux désinscrits, ni aux fiches de test, ni aux fiches en attente", async () => {
    expect((await runDemarragePro(fakeAdmin(tables, { optouts: ["claire@example.com"] }), origin, evening(21), { env })).envoyes).toBe(0);
    const test = { ...tables, vendors: [{ id: "v1", name: "Merry Test (ne pas réserver)", primary_category: "lieu" }] };
    expect((await runDemarragePro(fakeAdmin(test), origin, evening(21), { env })).envoyes).toBe(0);
    const attente = { ...tables, pro_vendors: [{ ...tables.pro_vendors[0], verification: "en_attente" }] };
    expect((await runDemarragePro(fakeAdmin(attente), origin, evening(21), { env })).envoyes).toBe(0);
  });

  it("attend le lendemain si un autre mail Merry est parti ce jour-là", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(evening(21));
    const admin = fakeAdmin(tables, { sent: [{ key: "relance:x:claire@example.com", sent_at: new Date("2026-11-21T09:00:00Z").toISOString() }] });
    const report = await runDemarragePro(admin, origin, evening(21), { env });
    expect(report.envoyes).toBe(0);
    expect(report.ignores).toBe(1);
  });

  it("dry : compte sans envoyer", async () => {
    const report = await runDemarragePro(fakeAdmin(tables), origin, evening(21), { env, dry: true });
    expect(report.envoyes).toBe(1);
    expect(mails).toHaveLength(0);
  });

  it("une fiche ancienne reçoit la séquence au lancement, pas une semaine après le premier envoi", async () => {
    const old = { ...tables, pro_vendors: [{ vendor_id: "v1", claimed_at: "2026-11-02T10:00:00Z", verified_at: null, verification: "validee" }] };
    expect((await runDemarragePro(fakeAdmin(old), origin, evening(21), { env })).envoyes).toBe(1);
    const later = fakeAdmin(old, { sent: [{ key: "demarrage-pro:photos:v9:a@example.com", sent_at: "2026-11-10T19:00:00.000Z" }] });
    expect((await runDemarragePro(later, origin, evening(21), { env })).fiches).toBe(0);
  });
});

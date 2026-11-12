import { afterEach, describe, expect, it, vi } from "vitest";
import { alignSeries, cleHeure, dayList, delta, exceptionTitle, fmtCle, fmtDuration, fmtHeure, heureList, replayUrl, splitSeries, sumBy, sumMesure, templatePath } from "@/lib/server/pilotage/shape";
import { allowedEmails } from "@/lib/server/pilotage/acces";
import { envoisAuto, readResend, sendsByDay } from "@/lib/server/pilotage/resend";
import { SUBJECT } from "@/lib/server/nouveautesMail";

describe("splitSeries", () => {
  it("sépare la période courante (fin) de la précédente", () => {
    const rows = [1, 2, 3, 4, 5, 6].map((n) => ({ jour: `2026-11-0${n}`, n }));
    const { current, previous } = splitSeries(rows, 3);
    expect(current.map((r) => r.n)).toEqual([4, 5, 6]);
    expect(previous.map((r) => r.n)).toEqual([1, 2, 3]);
  });
  it("tolère une série plus courte que deux périodes", () => {
    const rows = [1, 2, 3, 4].map((n) => ({ n }));
    const { current, previous } = splitSeries(rows, 3);
    expect(current.map((r) => r.n)).toEqual([2, 3, 4]);
    expect(previous.map((r) => r.n)).toEqual([1]);
  });
  it("renvoie deux listes vides sans données", () => {
    expect(splitSeries(null, 7)).toEqual({ current: [], previous: [] });
  });
});

describe("delta", () => {
  it("calcule la variation et son sens", () => {
    expect(delta(12, 10)).toEqual({ diff: 2, pct: 20, sens: "hausse" });
    expect(delta(5, 10)).toEqual({ diff: -5, pct: -50, sens: "baisse" });
    expect(delta(3, 3)).toEqual({ diff: 0, pct: 0, sens: "stable" });
  });
  it("ne divise pas par zéro", () => {
    expect(delta(4, 0)).toEqual({ diff: 4, pct: null, sens: "hausse" });
  });
});

describe("alignSeries", () => {
  it("cale des lignes PostHog éparses sur la liste des jours", () => {
    const out = alignSeries(["2026-11-01", "2026-11-02", "2026-11-03"], [["2026-11-01T00:00:00Z", 3, 9], ["2026-11-03", 1, 2]], ["visiteurs", "pages"]);
    expect(out).toEqual([
      { jour: "2026-11-01", visiteurs: 3, pages: 9 },
      { jour: "2026-11-02", visiteurs: 0, pages: 0 },
      { jour: "2026-11-03", visiteurs: 1, pages: 2 },
    ]);
  });
  it("supporte une source absente", () => {
    expect(alignSeries(["2026-11-01"], null, ["n"])).toEqual([{ jour: "2026-11-01", n: 0 }]);
  });
});

describe("séries par heure (filtre 24 h)", () => {
  it("donne l'heure de Paris d'un instant", () => {
    expect(cleHeure(Date.parse("2026-11-12T13:10:00Z"))).toBe("2026-11-12T14");
    expect(cleHeure(Date.parse("2026-11-12T23:30:00Z"))).toBe("2026-11-13T00");
  });
  it("liste les 48 dernières heures jusqu'à l'heure en cours", () => {
    const h = heureList(Date.parse("2026-11-12T13:10:00Z"));
    expect(h).toHaveLength(48);
    expect(h[47]).toBe("2026-11-12T14");
    expect(h[23]).toBe("2026-11-11T14");
    expect(h[0]).toBe("2026-11-10T15");
  });
  it("cale des lignes par heure sans les ramener au jour", () => {
    const out = alignSeries(["2026-11-12T13", "2026-11-12T14"], [["2026-11-12T14", 5]], ["visites"]);
    expect(out).toEqual([
      { jour: "2026-11-12T13", visites: 0 },
      { jour: "2026-11-12T14", visites: 5 },
    ]);
  });
  it("écrit une heure ou un jour sur l'axe", () => {
    expect(fmtCle("2026-11-12T09")).toBe("9 h");
    expect(fmtCle("2026-11-12")).toBe("12 nov.");
  });
});

describe("templatePath", () => {
  it("remplace les identifiants par un gabarit", () => {
    expect(templatePath("/dashboard/budget/prestataires/5f0c1d2e-1111-2222-3333-444455556666")).toBe("/dashboard/budget/prestataires/:id");
    expect(templatePath("/s/marie-et-florian/")).toBe("/s/:slug");
    expect(templatePath("/f/abc")).toBe("/f/:slug");
    expect(templatePath("/dashboard/")).toBe("/dashboard");
    expect(templatePath(null)).toBe("/");
  });
});

describe("replayUrl", () => {
  it("ouvre le replay au moment clé, en secondes", () => {
    expect(replayUrl("abc", 65400)).toBe("https://eu.posthog.com/project/321035/replay/abc?t=65");
  });
  it("ouvre le début du replay sans moment clé", () => {
    expect(replayUrl("abc", null)).toBe("https://eu.posthog.com/project/321035/replay/abc");
  });
});

describe("mise en forme", () => {
  it("durées lisibles", () => {
    expect(fmtDuration(42)).toBe("42 s");
    expect(fmtDuration(125)).toBe("2 min 05 s");
    expect(fmtDuration(180)).toBe("3 min");
    expect(fmtDuration(3900)).toBe("1 h 05");
  });
  it("heure d'un envoi, heure de Paris, avec le jour quand ce n'est pas aujourd'hui", () => {
    const now = Date.parse("2026-11-10T15:00:00Z");
    expect(fmtHeure("2026-11-10T13:32:00Z", now)).toBe("14 h 32");
    expect(fmtHeure("2026-11-09T23:30:00Z", now)).toBe("0 h 30");
    expect(fmtHeure("2026-11-09T17:05:00Z", now)).toBe("Hier à 18 h 05");
    expect(fmtHeure("2026-11-08T08:10:00Z", now)).toBe("8 nov. à 9 h 10");
    expect(fmtHeure(null, now)).toBe("–");
  });
  it("somme une clé en ignorant les valeurs absentes", () => {
    expect(sumBy([{ n: 2 }, { n: "3" }, {}], "n")).toBe(5);
  });
  it("titre d'une exception PostHog", () => {
    expect(exceptionTitle({ $exception_list: [{ type: "TypeError", value: "x is null" }] })).toBe("TypeError : x is null");
    expect(exceptionTitle({ $exception_list: '[{"type":"Error","value":"boom"}]' })).toBe("Error : boom");
    expect(exceptionTitle({ $exception_message: "ancien format" })).toBe("Erreur : ancien format");
    expect(exceptionTitle({})).toBe("Erreur");
  });
});

describe("allowedEmails", () => {
  it("prend les adresses de Stan par défaut, en minuscules", () => {
    const set = allowedEmails({});
    expect(set.has("stanislas.largetpiet@gmail.com")).toBe(true);
    expect(set.has("quelquun@exemple.fr")).toBe(false);
  });
  it("lit PILOTAGE_EMAILS", () => {
    const set = allowedEmails({ PILOTAGE_EMAILS: "A@b.fr, c@d.fr" });
    expect(set.has("a@b.fr")).toBe(true);
    expect(set.has("c@d.fr")).toBe(true);
    expect(set.has("stanislas.largetpiet@gmail.com")).toBe(false);
  });
});

describe("dayList", () => {
  it("donne 2 × days jours, du plus ancien au plus récent, en heure de Paris", () => {
    const now = Date.parse("2026-11-05T08:00:00Z");
    expect(dayList(2, now)).toEqual(["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05"]);
    // 23 h 30 UTC le 4 est déjà le 5 à Paris
    expect(dayList(1, Date.parse("2026-11-04T23:30:00Z"))).toEqual(["2026-11-04", "2026-11-05"]);
  });
});

import { generateKeyPairSync, createVerify } from "node:crypto";
import { parseServiceAccount, readServiceAccount, signedJwt } from "@/lib/server/pilotage/google";
import { auditHtml, sampleUrls, sectionOf } from "@/lib/server/pilotage/seo";

describe("compte de service Google", () => {
  it("lit la clé en JSON ou en base64, refuse le reste", () => {
    const json = JSON.stringify({ client_email: "a@b.iam.gserviceaccount.com", private_key: "-----BEGIN PRIVATE KEY-----\\nxx\\n-----END PRIVATE KEY-----\\n" });
    expect(readServiceAccount(json).email).toBe("a@b.iam.gserviceaccount.com");
    expect(readServiceAccount(Buffer.from(json).toString("base64")).key).toContain("\n");
    expect(readServiceAccount("")).toBe(null);
    expect(readServiceAccount("pas du json")).toBe(null);
    expect(readServiceAccount("{}")).toBe(null);
  });
  it("signe un jeton RS256 vérifiable", () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const jwt = signedJwt({ email: "a@b.iam.gserviceaccount.com", key: privateKey.export({ type: "pkcs8", format: "pem" }) }, 1000);
    const [h, c, sig] = jwt.split(".");
    const claims = JSON.parse(Buffer.from(c, "base64url").toString());
    expect(claims).toMatchObject({ iss: "a@b.iam.gserviceaccount.com", iat: 1000, exp: 4600 });
    const v = createVerify("RSA-SHA256");
    v.update(`${h}.${c}`);
    expect(v.verify(publicKey, Buffer.from(sig, "base64url"))).toBe(true);
  });
});

describe("santé du référencement", () => {
  const page = (extra = "") => `<html><head><title>Lieux de mariage en Provence | Merry</title><meta name="description" content="Des lieux."><link rel="canonical" href="https://www.withmerry.com/mariage/lieux/provence">${extra}</head><body><h1>Lieux</h1></body></html>`;
  it("ne trouve rien à redire à une page saine", () => {
    expect(auditHtml(page(), "https://www.withmerry.com/mariage/lieux/provence").problemes).toEqual([]);
  });
  it("relève noindex, canonique ailleurs, titre et h1 manquants", () => {
    expect(auditHtml(page('<meta name="robots" content="noindex, follow">'), "https://www.withmerry.com/mariage/lieux/provence").problemes).toContain("noindex");
    expect(auditHtml(page(), "https://www.withmerry.com/autre").problemes).toContain("canonique vers une autre adresse");
    expect(auditHtml("<html><head></head><body></body></html>", "https://x.fr/").problemes).toEqual(["pas de titre", "pas de description", "pas d'adresse canonique", "pas de h1"]);
  });
  it("échantillonne sans doublon, stable le même jour et différent le lendemain", () => {
    const urls = Array.from({ length: 100 }, (_, i) => `u${i}`);
    const a = sampleUrls(urls, 10, 5);
    expect(a).toHaveLength(10);
    expect(new Set(a).size).toBe(10);
    expect(sampleUrls(urls, 10, 5)).toEqual(a);
    expect(sampleUrls(urls, 10, 6)).not.toEqual(a);
    expect(sampleUrls(["a", "b"], 10, 3)).toEqual(["a", "b"]);
  });
  it("range les adresses par rubrique", () => {
    expect(sectionOf("https://www.withmerry.com/mariage/lieux/provence")).toBe("/mariage/lieux");
    expect(sectionOf("https://www.withmerry.com/partenaires")).toBe("/partenaires");
    expect(sectionOf("https://www.withmerry.com/")).toBe("/");
  });
});

describe("clé du compte de service, telle qu'on la colle", () => {
  const pem = "-----BEGIN PRIVATE KEY-----\nabc\ndef\n-----END PRIVATE KEY-----\n";
  const file = JSON.stringify({ type: "service_account", client_email: "a@b.iam.gserviceaccount.com", private_key: pem, client_id: "1" }, null, 2);
  const ok = { email: "a@b.iam.gserviceaccount.com", key: pem };
  it("lit le fichier tel quel, en base64, entre guillemets ou en chaîne JSON", () => {
    expect(parseServiceAccount(file)).toEqual(ok);
    expect(parseServiceAccount(Buffer.from(file).toString("base64"))).toEqual(ok);
    expect(parseServiceAccount(`'${file}'`)).toEqual(ok);
    expect(parseServiceAccount(JSON.stringify(file))).toEqual(ok);
  });
  it("lit une clé dont les \\n sont devenus de vrais retours à la ligne", () => {
    const broken = file.replace(/\\n/g, "\n");
    expect(() => JSON.parse(broken)).toThrow();
    expect(parseServiceAccount(broken)).toEqual(ok);
  });
  it("dit ce qui manque sans citer le contenu", () => {
    expect(parseServiceAccount("")).toEqual({ erreur: "absente" });
    expect(parseServiceAccount("bonjour").erreur).toMatch(/illisible : 7 caractères/);
    expect(parseServiceAccount('{"client_email":"a@b"}').erreur).toMatch(/private_key introuvable/);
    expect(parseServiceAccount('{"client_email":"a@b","private_key":"xx"}').erreur).toMatch(/BEGIN PRIVATE KEY/);
  });
});

import { isTimeout, readSupabase } from "@/lib/server/pilotage/supabase";

describe("lecture Supabase du pilotage", () => {
  const timeout = { data: null, error: { code: "57014", message: "canceling statement due to statement timeout" } };
  const ok = { data: { totaux: { comptes: 27 } }, error: null };
  const fake = (...answers) => {
    const calls = [];
    return { calls, rpc: async (fn, args) => (calls.push([fn, args]), answers[Math.min(calls.length, answers.length) - 1]) };
  };

  it("reconnaît un dépassement de délai", () => {
    expect(isTimeout(timeout.error)).toBe(true);
    expect(isTimeout({ code: "XX", message: "canceling statement due to statement timeout" })).toBe(true);
    expect(isTimeout({ code: "42883", message: "function does not exist" })).toBe(false);
    expect(isTimeout(null)).toBe(false);
  });
  it("réessaie après un dépassement et rend la lecture qui aboutit", async () => {
    const admin = fake(timeout, timeout, ok);
    expect(await readSupabase(admin, 7, { pause: 0 })).toEqual(ok.data);
    expect(admin.calls).toHaveLength(3);
    expect(admin.calls[0]).toEqual(["pilotage_stats", { days: 7 }]);
  });
  it("passe au repli léger après trois dépassements", async () => {
    const admin = fake(timeout);
    const lite = async (_, days) => ({ repli: true, jours: days, totaux: { comptes: 27 } });
    expect(await readSupabase(admin, 7, { pause: 0, lite })).toEqual({ repli: "delai", jours: 7, totaux: { comptes: 27 } });
    expect(admin.calls).toHaveLength(3);
  });
  it("ne réessaie pas une autre erreur", async () => {
    const admin = fake({ data: null, error: { code: "42501", message: "permission denied" } });
    await expect(readSupabase(admin, 7, { pause: 0 })).rejects.toThrow(/permission denied/);
    expect(admin.calls).toHaveLength(1);
  });
});

describe("sendsByDay", () => {
  it("compte les envois par jour, heure de Paris, au format des séries", () => {
    const rows = sendsByDay([{ quand: "2026-11-05T23:30:00Z" }, { quand: "2026-11-06T08:00:00Z" }, { quand: "2026-11-04T10:00:00Z" }]);
    expect(rows).toEqual(expect.arrayContaining([["2026-11-06", 2], ["2026-11-04", 1]]));
    expect(alignSeries(["2026-11-06"], rows, ["envois"])).toEqual([{ jour: "2026-11-06", envois: 2 }]);
  });
});

describe("envoisAuto", () => {
  it("compte les envois automatiques par jour, sans les campagnes ni les doublons, depuis le premier événement", () => {
    const envois = [
      { email_id: "a", subject: "Bienvenue sur Merry", occurred_at: "2026-11-07T09:00:00Z" },
      { email_id: "a", subject: "Bienvenue sur Merry", occurred_at: "2026-11-07T09:00:01Z" },
      { email_id: "b", subject: "Nouvelle demande de devis", occurred_at: "2026-11-06T23:30:00Z" },
      { email_id: "c", subject: SUBJECT, occurred_at: "2026-11-07T08:00:00Z" },
    ];
    const r = envoisAuto(envois, "2026-11-06T13:00:00Z");
    expect(r.depuis).toBe("2026-11-06");
    expect(r.par_jour).toEqual([["2026-11-07", 2]]);
    expect(envoisAuto([], null)).toBeNull();
  });
});

describe("readResend", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  it("garde les 15 derniers envois automatiques, du plus récent au plus ancien, sans les campagnes", async () => {
    vi.stubEnv("RESEND_READ_API_KEY", "re_test");
    const data = Array.from({ length: 40 }, (_, i) => ({
      id: `m${i}`,
      created_at: new Date(Date.parse("2026-11-10T15:00:00Z") - i * 60000).toISOString(),
      to: [`invite${i}@exemple.fr`],
      subject: i % 3 === 0 ? SUBJECT : "Ta réponse est bien arrivée",
      last_event: "delivered",
    }));
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ data }) })));
    const r = await readResend(7);
    const derniers = r.hors_campagnes.derniers;
    expect(derniers).toHaveLength(15);
    expect(derniers.some((m) => m.sujet === SUBJECT)).toBe(false);
    expect(derniers[0]).toMatchObject({ a: "invite1@exemple.fr", sujet: "Ta réponse est bien arrivée", quand: data[1].created_at });
    expect(derniers.map((m) => m.quand)).toEqual([...derniers.map((m) => m.quand)].sort().reverse());
  });
});

describe("sumMesure", () => {
  it("ne totalise qu'une période mesurée chaque jour", () => {
    expect(sumMesure([{ n: 2 }, { n: 0 }], "n")).toBe(2);
    expect(sumMesure([{ n: null }, { n: 3 }], "n")).toBeNull();
    expect(sumMesure([], "n")).toBeNull();
  });
});

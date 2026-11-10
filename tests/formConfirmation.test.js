import { beforeEach, describe, expect, it, vi } from "vitest";
import { answerRows, formConfirmationMail, formCouple } from "../lib/server/formConfirmationMail.js";

const form = {
  partner1: "léo",
  partner2: "Léa",
  wedding_date: "2027-06-12",
  venue: "Château de la Mothe",
  presence_mode: "events",
  fields: [
    { key: "presence", mode: "req" },
    { key: "plusun", mode: "opt" },
  ],
  events: [
    { id: "e1", name: "Mairie" },
    { id: "e2", name: "Dîner" },
    { id: "e3", name: "Brunch" },
  ],
};
const payload = {
  first_name: "philippe",
  last_name: "Martel",
  email: "philippe@gmail.com",
  answers: { e1: "oui", e2: "non" },
  plus_one: { first_name: "Jeanne", last_name: "Martel" },
  mot: "Vive les mariés http://exemple.com",
};
const link = "https://app.withmerry.com/f/leo-et-lea-c5r9";

describe("formConfirmationMail", () => {
  it("remercie l'invité et nomme le couple", () => {
    const mail = formConfirmationMail({ form, payload, link });
    expect(mail.subject).toBe("Ta réponse est bien arrivée chez Léo et Léa");
    expect(mail.html).toContain("Merci Philippe, c&#39;est noté.");
    expect(mail.text).toContain("Samedi 12 juin 2027 · Château de la Mothe");
    expect(mail.text).toContain(`Revoir le formulaire : ${link}`);
  });

  it("récapitule les moments répondus et l'accompagnant", () => {
    const mail = formConfirmationMail({ form, payload, link });
    expect(mail.text).toContain("Mairie : Oui\nDîner : Non");
    expect(mail.text).not.toContain("Brunch");
    expect(mail.text).toContain("Ton accompagnant : Jeanne Martel.");
  });

  it("ne recopie pas le mot laissé aux mariés", () => {
    const mail = formConfirmationMail({ form, payload, link });
    expect(mail.text).not.toContain("exemple.com");
    expect(mail.html).not.toContain("exemple.com");
  });

  it("tutoie l'invité et ne dit jamais vous", () => {
    const mail = formConfirmationMail({ form, payload, link });
    expect(mail.text).toContain("Pour changer ta réponse, renvoie simplement le formulaire");
    expect(mail.text).not.toMatch(/\b(vous|votre|vos)\b/i);
    expect(mail.html).not.toMatch(/\b(vous|votre|vos)\b/i);
  });

  it("une seule ligne quand la présence vaut pour tout le mariage", () => {
    const global = { ...form, presence_mode: "global" };
    expect(answerRows(global, { answers: { e1: "oui", e2: "oui", e3: "oui" } })).toEqual([{ name: "Ta présence", status: "Oui", ok: true }]);
  });

  it("aucune ligne si la présence n'est pas demandée", () => {
    expect(answerRows({ ...form, fields: [] }, payload)).toEqual([]);
  });

  it("échappe ce que l'invité a saisi", () => {
    const mail = formConfirmationMail({ form, payload: { ...payload, first_name: "<b>Phil</b>" }, link });
    expect(mail.html).toContain("&lt;b&gt;Phil&lt;/b&gt;");
    expect(mail.html).not.toContain("<b>Phil</b>");
  });

  it("se passe des prénoms du couple", () => {
    expect(formCouple({ title: "Notre mariage" })).toBe("Notre mariage");
    const mail = formConfirmationMail({ form: { events: [] }, payload: { first_name: "" }, link });
    expect(mail.subject).toBe("Ta réponse est bien arrivée");
    expect(mail.text).toContain("Ta réponse est arrivée chez les mariés.");
  });
});

let submitError;
let formData;
let allowed;
const sent = [];
const later = [];

vi.mock("next/server", () => ({ after: (fn) => later.push(fn) }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    rpc: async (name) => {
      if (name === "merry_form_submit") return { data: submitError ? null : { ok: true }, error: submitError };
      if (name === "merry_form_public") return { data: formData, error: null };
      if (name === "merry_throttle") return { data: allowed, error: null };
      return { data: null, error: null };
    },
  }),
}));
vi.mock("../lib/server/sendMail.js", () => ({ sendMail: async (m) => sent.push(m) || true }));

const { POST } = await import("../app/api/formulaire/repondre/route.js");

const call = (body) => POST(new Request("https://app.withmerry.com/api/formulaire/repondre", { method: "POST", body: JSON.stringify(body) }));
const flush = async () => {
  while (later.length) await later.shift()();
};

describe("route /api/formulaire/repondre", () => {
  beforeEach(() => {
    Object.assign(process.env, { RESEND_API_KEY: "k", NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "a", SUPABASE_SERVICE_ROLE_KEY: "s" });
    submitError = null;
    formData = form;
    allowed = true;
    sent.length = 0;
    later.length = 0;
  });

  it("enregistre la réponse puis envoie la confirmation à l'invité", async () => {
    const res = await call({ slug: "leo-et-lea-c5r9", payload });
    expect(res.status).toBe(200);
    expect(sent).toHaveLength(0);
    await flush();
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("philippe@gmail.com");
    expect(sent[0].fromName).toBe("Léo et Léa");
    expect(sent[0].text).toContain("https://app.withmerry.com/f/leo-et-lea-c5r9");
  });

  it("renvoie l'erreur de la base et n'envoie rien", async () => {
    submitError = { message: "Date limite dépassée" };
    const res = await call({ slug: "leo-et-lea-c5r9", payload });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Date limite dépassée");
    await flush();
    expect(sent).toHaveLength(0);
  });

  it("n'envoie rien au-delà de la limite", async () => {
    allowed = false;
    expect((await call({ slug: "leo-et-lea-c5r9", payload })).status).toBe(200);
    await flush();
    expect(sent).toHaveLength(0);
  });

  it("enregistre sans mail si l'adresse est invalide", async () => {
    expect((await call({ slug: "leo-et-lea-c5r9", payload: { ...payload, email: "philippe" } })).status).toBe(200);
    await flush();
    expect(sent).toHaveLength(0);
  });

  it("refuse un lien mal formé", async () => {
    expect((await call({ slug: "../x", payload })).status).toBe(400);
    expect((await call({ slug: "leo-et-lea-c5r9", payload: [] })).status).toBe(400);
  });

  it("répond 501 sans Supabase, pour que le navigateur envoie lui-même", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    expect((await call({ slug: "leo-et-lea-c5r9", payload })).status).toBe(501);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { answerRows, formConfirmationMail, formCouple } from "../lib/server/formConfirmationMail.js";
import { agendaEvent, googleAgendaUrl, icsFile, wantsIcs } from "../lib/server/formAgenda.js";

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
    expect(mail.text).toContain(`Modifier ma réponse : ${link}`);
  });

  it("prend les couleurs du formulaire du couple, plus le citron de Merry", () => {
    const mail = formConfirmationMail({ form: { ...form, theme: "rose" }, payload, link });
    expect(mail.html).toContain("background:#f8ece8");
    expect(mail.html).toContain("background:#8a4a3a");
    expect(mail.html.toLowerCase()).not.toContain("#fff700");
    expect(mail.html).toContain('src="https://app.withmerry.com/mail/merry.png"');
    expect(mail.html).toContain("https://withmerry.com/?source=mail-invites");
  });

  it("montre la photo d'en-tête recadrée, seulement quand le couple en a mis une", () => {
    expect(formConfirmationMail({ form, payload, link }).html).not.toContain("/photo-mail");
    const mail = formConfirmationMail({ form: { ...form, cover_url: "https://x.supabase.co/storage/v1/object/public/merry-covers/a.jpg" }, payload, link });
    expect(mail.html).toContain(`src="${link}/photo-mail"`);
  });

  it("résume la réponse et la date dans l'aperçu de la boîte de réception", () => {
    const mail = formConfirmationMail({ form, payload, link });
    expect(mail.html).toContain("Mairie : oui · Dîner : non. Rendez-vous le samedi 12 juin 2027.");
  });

  it("propose l'agenda à l'invité qui vient, pas à celui qui ne vient à rien", () => {
    expect(formConfirmationMail({ form, payload, link }).text).toContain(`Ajouter à mon agenda : ${link}/agenda`);
    const non = formConfirmationMail({ form, payload: { ...payload, answers: { e1: "non", e2: "non" } }, link });
    expect(non.text).not.toContain("agenda");
    expect(non.html).not.toContain("Rendez-vous");
    expect(formConfirmationMail({ form: { ...form, wedding_date: null }, payload, link }).text).not.toContain("agenda");
  });

  it("récapitule les moments répondus et l'accompagnant", () => {
    const mail = formConfirmationMail({ form, payload, link });
    expect(mail.text).toContain("Mairie : Oui\nDîner : Non");
    expect(mail.text).not.toContain("Brunch");
    expect(mail.text).toContain("Accompagnant : Jeanne Martel");
  });

  it("ne recopie pas le mot laissé aux mariés", () => {
    const mail = formConfirmationMail({ form, payload, link });
    expect(mail.text).not.toContain("exemple.com");
    expect(mail.html).not.toContain("exemple.com");
  });

  it("tutoie l'invité et ne dit jamais vous", () => {
    const mail = formConfirmationMail({ form, payload, link });
    expect(mail.text).toContain("Pour la changer, renvoie le formulaire avec les mêmes prénom et nom.");
    expect(mail.text).not.toMatch(/(?<!rendez-)\b(vous|votre|vos)\b/i);
    expect(mail.html).not.toMatch(/(?<!rendez-)\b(vous|votre|vos)\b/i);
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

describe("formAgenda", () => {
  const ev = agendaEvent({ ...form, venue: "Château de la Mothe, Vouvray" });

  it("fait du mariage un événement d'une journée", () => {
    expect(ev).toEqual({ start: "20270612", end: "20270613", title: "Mariage de Léo et Léa", venue: "Château de la Mothe, Vouvray" });
    expect(agendaEvent({ ...form, wedding_date: "2027-12-31" }).end).toBe("20280101");
    expect(agendaEvent({ ...form, wedding_date: null })).toBeNull();
  });

  it("préremplit Google Agenda", () => {
    const url = new URL(googleAgendaUrl(ev, "Formulaire des invités"));
    expect(url.searchParams.get("dates")).toBe("20270612/20270613");
    expect(url.searchParams.get("text")).toBe("Mariage de Léo et Léa");
    expect(url.searchParams.get("location")).toBe("Château de la Mothe, Vouvray");
  });

  it("écrit un fichier .ics valide, texte échappé et lignes repliées", () => {
    const ics = icsFile(ev, { uid: "leo-et-lea@withmerry.com", details: `Formulaire des invités : ${link}`, now: new Date("2026-11-10T12:00:00Z") });
    expect(ics).toContain("DTSTART;VALUE=DATE:20270612\r\nDTEND;VALUE=DATE:20270613");
    expect(ics).toContain("LOCATION:Château de la Mothe\\, Vouvray");
    expect(ics).toContain("DTSTAMP:20261110T120000Z");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });

  it("donne le fichier .ics aux appareils Apple", () => {
    expect(wantsIcs("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).toBe(true);
    expect(wantsIcs("Mozilla/5.0 (Linux; Android 14; Pixel 8)")).toBe(false);
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

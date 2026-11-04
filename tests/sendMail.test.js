import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { personalFrom, sendMail } from "../lib/server/sendMail.js";

const mail = { to: "a@b.fr", subject: "Objet", text: "t", html: "<p>h</p>", label: "test" };

function replies(...statuses) {
  const calls = [];
  vi.stubGlobal("fetch", async (_url, init) => {
    calls.push(JSON.parse(init.body));
    return new Response("{}", { status: statuses.shift() ?? 200 });
  });
  return calls;
}

describe("sendMail", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("réessaie après une limite de débit puis réussit", async () => {
    const calls = replies(429, 200);
    const sent = sendMail(mail);
    await vi.runAllTimersAsync();
    expect(await sent).toBe(true);
    expect(calls).toHaveLength(2);
  });

  it("abandonne après deux nouvelles tentatives", async () => {
    const calls = replies(500, 503, 500);
    const sent = sendMail(mail);
    await vi.runAllTimersAsync();
    expect(await sent).toBe(false);
    expect(calls).toHaveLength(3);
  });

  it("ne réessaie pas un refus définitif", async () => {
    const calls = replies(422);
    const sent = sendMail(mail);
    await vi.runAllTimersAsync();
    expect(await sent).toBe(false);
    expect(calls).toHaveLength(1);
  });

  it("personnalise l'expéditeur sans laisser passer de caractère dangereux", () => {
    process.env.MERRY_MAIL_FROM = "Merry <contact@withmerry.com>";
    expect(personalFrom("Emma et Lucas")).toBe('"Emma et Lucas via Merry" <contact@withmerry.com>');
    expect(personalFrom('A"<b@x.fr>\r\nBcc: z')).toBe('"Ab@x.frBcc: z via Merry" <contact@withmerry.com>');
    expect(personalFrom("")).toBe("Merry <contact@withmerry.com>");
    delete process.env.MERRY_MAIL_FROM;
  });

  it("donne un identifiant différent à chaque mail", async () => {
    const calls = replies(200, 200);
    await Promise.all([sendMail(mail), sendMail(mail)]);
    expect(calls[0].headers["X-Entity-Ref-ID"]).not.toBe(calls[1].headers["X-Entity-Ref-ID"]);
  });
});

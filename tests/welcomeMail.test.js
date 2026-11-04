import { describe, expect, it } from "vitest";
import { welcomeMail } from "../lib/server/welcomeMail.js";

const base = { link: "https://app.withmerry.com/dashboard", assets: "https://app.withmerry.com/mail" };

describe("welcomeMail", () => {
  it("s'adresse au couple par son prénom", () => {
    const mail = welcomeMail({ ...base, greeting: "Emma et Lucas" });
    expect(mail.subject).toBe("Emma et Lucas, la fête commence");
    expect(mail.html).toContain("Emma et Lucas, la fête commence.");
    expect(mail.text).toContain("Stan, fondateur de Merry");
  });

  it("fonctionne sans prénom", () => {
    expect(welcomeMail({ ...base, greeting: "" }).subject).toBe("La fête commence");
  });

  it("échappe le prénom et charge les images depuis l'appli", () => {
    const mail = welcomeMail({ ...base, greeting: "<b>Emma</b>" });
    expect(mail.html).toContain("&lt;b&gt;Emma&lt;/b&gt;");
    expect(mail.html).toContain('src="https://app.withmerry.com/mail/merry.png"');
    expect(mail.html).toContain('src="https://app.withmerry.com/mail/invites.png"');
  });

  it("tutoie et ne dit jamais vous", () => {
    expect(welcomeMail({ ...base, greeting: "Emma" }).text).not.toMatch(/\b(vous|votre|vos)\b/i);
  });
});

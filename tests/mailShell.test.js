import { describe, expect, it } from "vitest";
import { mailShell } from "../lib/server/mailShell.js";

describe("mailShell", () => {
  it("garde des marges autour du contenu, même dans un client sans marge par défaut", () => {
    const html = mailShell({ title: "Sujet", body: "<p>Bonjour</p>" });
    expect(html).toContain('style="padding:24px 16px"');
    expect(html.indexOf("padding:24px 16px")).toBeLessThan(html.indexOf("<p>Bonjour</p>"));
  });

  it("échappe le titre et l'aperçu, jamais le corps", () => {
    const html = mailShell({ title: "A & B", preheader: "<b>x</b>", body: "<p>corps</p>" });
    expect(html).toContain("<title>A &amp; B</title>");
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(html).toContain("<p>corps</p>");
  });
});

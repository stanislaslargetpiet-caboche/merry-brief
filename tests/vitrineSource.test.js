import { describe, expect, it } from "vitest";
import { LOGIN, SIGNUP, withSource } from "../lib/vitrine/routes.js";

describe("withSource", () => {
  it("ajoute la source au lien d'inscription", () => {
    expect(withSource(SIGNUP, "?source=meta-a")).toBe(`${SIGNUP}?source=meta-a`);
  });

  it("garde la source seule, sans les autres paramètres", () => {
    expect(withSource(SIGNUP, "?utm_medium=paid&source=meta-b&fbclid=abc")).toBe(`${SIGNUP}?source=meta-b`);
  });

  it("laisse les autres liens tels quels", () => {
    expect(withSource(LOGIN, "?source=meta-a")).toBe(LOGIN);
    expect(withSource("/partenaires", "?source=meta-a")).toBe("/partenaires");
  });

  it("ignore une adresse sans source ou une source invalide", () => {
    expect(withSource(SIGNUP, "")).toBe(SIGNUP);
    expect(withSource(SIGNUP, "?source=<script>")).toBe(SIGNUP);
    expect(withSource(SIGNUP, `?source=${"a".repeat(41)}`)).toBe(SIGNUP);
  });

  it("ne change rien à un lien déjà complété", () => {
    expect(withSource(`${SIGNUP}?source=meta-a`, "?source=meta-a")).toBe(`${SIGNUP}?source=meta-a`);
  });
});

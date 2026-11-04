import { beforeEach, describe, expect, it } from "vitest";
import { readUnsubLink, unsubLink } from "../lib/server/mailOptouts.js";

const parts = (href) => {
  const url = new URL(href);
  return [url.searchParams.get("e"), url.searchParams.get("t")];
};

describe("lien de désinscription", () => {
  beforeEach(() => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "secret";
  });

  it("retrouve l'adresse, en minuscules", () => {
    const [e, t] = parts(unsubLink("https://app.withmerry.com", "Contact@LeMas.fr"));
    expect(readUnsubLink(e, t)).toBe("contact@lemas.fr");
  });

  it("refuse une signature fausse ou prise sur une autre adresse", () => {
    const [e] = parts(unsubLink("https://app.withmerry.com", "a@lemas.fr"));
    const [, t] = parts(unsubLink("https://app.withmerry.com", "b@lemas.fr"));
    expect(readUnsubLink(e, t)).toBeNull();
    expect(readUnsubLink(e, "x")).toBeNull();
    expect(readUnsubLink("", "")).toBeNull();
  });

  it("refuse tout sans clé de signature", () => {
    const [e, t] = parts(unsubLink("https://app.withmerry.com", "a@lemas.fr"));
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(readUnsubLink(e, t)).toBeNull();
  });
});

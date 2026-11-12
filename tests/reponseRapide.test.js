import { beforeEach, describe, expect, it } from "vitest";
import { quickReplyLink, readQuickReplyLink } from "../lib/server/reponseRapide.js";

const parts = (href) => {
  const url = new URL(href);
  return [url.searchParams.get("c"), url.searchParams.get("r"), url.searchParams.get("t")];
};

describe("réponse en un clic (V56)", () => {
  beforeEach(() => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "secret";
  });

  it("retrouve le texte de la réponse pour un lien authentique", () => {
    const [c, r, t] = parts(quickReplyLink("https://app.withmerry.com", "c1", "interesse"));
    expect(readQuickReplyLink(c, r, t)).toBe("Ça m'intéresse, merci pour votre réponse !");
  });

  it("refuse une signature fausse ou prise sur un autre client ou un autre choix", () => {
    const [c1] = parts(quickReplyLink("https://app.withmerry.com", "c1", "interesse"));
    const [, , t2] = parts(quickReplyLink("https://app.withmerry.com", "c2", "interesse"));
    expect(readQuickReplyLink(c1, "interesse", t2)).toBeNull();
    const [, , tAutreChoix] = parts(quickReplyLink("https://app.withmerry.com", "c1", "non-merci"));
    expect(readQuickReplyLink(c1, "interesse", tAutreChoix)).toBeNull();
  });

  it("refuse un choix inconnu", () => {
    const [c, , t] = parts(quickReplyLink("https://app.withmerry.com", "c1", "interesse"));
    expect(readQuickReplyLink(c, "autre-chose", t)).toBeNull();
  });

  it("refuse tout sans clé de signature", () => {
    const [c, r, t] = parts(quickReplyLink("https://app.withmerry.com", "c1", "interesse"));
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(readQuickReplyLink(c, r, t)).toBeNull();
  });
});

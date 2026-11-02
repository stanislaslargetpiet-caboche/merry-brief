import { afterEach, describe, expect, it } from "vitest";
import { clientIp, publicOrigin } from "@/lib/server/origin";

const req = (headers) => ({ headers: { get: (k) => headers[k.toLowerCase()] ?? null } });

describe("adresse publique des liens envoyés par mail", () => {
  const saved = process.env.NEXT_PUBLIC_APP_URL;
  afterEach(() => {
    if (saved === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = saved;
  });
  it("ne suit jamais un hôte inconnu", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(publicOrigin(req({ host: "evil.example" }))).toBe("https://app.withmerry.com");
    expect(publicOrigin(req({ "x-forwarded-host": "evil.example, app.withmerry.com" }))).toBe("https://app.withmerry.com");
  });
  it("garde une prévisualisation Vercel et l'hôte de l'appli", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(publicOrigin(req({ host: "merry-abc123-stan.vercel.app" }))).toBe("https://merry-abc123-stan.vercel.app");
    expect(publicOrigin(req({ host: "app.withmerry.com" }))).toBe("https://app.withmerry.com");
  });
  it("préfère la variable d'environnement", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://staging.withmerry.com/";
    expect(publicOrigin(req({ host: "x.vercel.app" }))).toBe("https://staging.withmerry.com");
  });
  it("lit la première adresse IP transmise", () => {
    expect(clientIp(req({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
    expect(clientIp(req({}))).toBe("unknown");
  });
});

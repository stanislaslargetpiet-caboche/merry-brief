import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const later = [];
vi.mock("next/server", () => ({ after: (fn) => later.push(fn) }));

const CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15";

async function post(headers = {}) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
  const { POST } = await import("../app/api/compteur/route.js");
  const res = await POST(new Request("https://app.withmerry.com/api/compteur", { method: "POST", headers: { "user-agent": CHROME, host: "app.withmerry.com", ...headers }, body: JSON.stringify({ etape: "equipe", search: "?source=meta-a" }) }));
  await Promise.all(later.splice(0));
  return res;
}

describe("/api/compteur : écrans de l'onboarding", () => {
  let fetchMock;
  beforeEach(() => {
    fetchMock = vi.fn(() => Promise.resolve({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("compte l'écran vu par un visiteur", async () => {
    const res = await post();
    expect(res.status).toBe(204);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).properties).toMatchObject({ etape: "equipe", source: "meta-a" });
  });

  it("ne compte pas l'écran vu depuis un appareil de l'équipe", async () => {
    const res = await post({ cookie: "merry_interne=1" });
    expect(res.status).toBe(204);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

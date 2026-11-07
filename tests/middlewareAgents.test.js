import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const GPT = "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot";
const CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15";

async function run(url, userAgent) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
  const { middleware } = await import("../middleware.js");
  const waits = [];
  const res = middleware(new NextRequest(url, { headers: { "user-agent": userAgent, host: new URL(url).host } }), { waitUntil: (p) => waits.push(p) });
  await Promise.all(waits);
  return res;
}

describe("middleware : relevé des agents IA", () => {
  let fetchMock;
  beforeEach(() => {
    fetchMock = vi.fn(() => Promise.resolve({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("envoie un bot_hit pour GPTBot sur une page du site, sans profil de personne", async () => {
    await run("https://www.withmerry.com/mariage/lieux/yvelines", GPT);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.event).toBe("bot_hit");
    expect(body.properties).toMatchObject({ famille: "GPTBot", operateur: "OpenAI", type: "entrainement", site: "www.withmerry.com", chemin: "/mariage/lieux/yvelines", $process_person_profile: false });
    expect(body.properties.$host).toBeUndefined();
  });
  it("ne relève pas un navigateur ordinaire comme agent : il passe au compteur anonyme", async () => {
    await run("https://www.withmerry.com/?source=meta-c&fbclid=abc", CHROME);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.event).toBe("compteur");
    expect(body.properties).toMatchObject({ etape: "site", source: "meta-c", site: "www.withmerry.com", $process_person_profile: false, $ip: null });
    expect(body.distinct_id).toMatch(/^compteur:/);
  });
  it("compte l'ouverture de l'onboarding, pas les autres pages de l'appli", async () => {
    await run("https://app.withmerry.com/?source=meta-c", CHROME);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).properties).toMatchObject({ etape: "appli", source: "meta-c" });
    fetchMock.mockClear();
    await run("https://app.withmerry.com/dashboard", CHROME);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("ne compte pas un agent IA ni un aperçu de lien comme une visite", async () => {
    await run("https://www.withmerry.com/", GPT);
    expect(fetchMock.mock.calls.map((c) => JSON.parse(c[1].body).event)).toEqual(["bot_hit"]);
    fetchMock.mockClear();
    await run("https://www.withmerry.com/", "facebookexternalhit/1.1");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("ne compte pas une redirection (l'agent est compté là où il atterrit)", async () => {
    const res = await run("https://app.withmerry.com/mariage/lieux/yvelines", GPT);
    expect(res.status).toBe(308);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("ne relève rien en local", async () => {
    await run("http://localhost:3000/", GPT);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

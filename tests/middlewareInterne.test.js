import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15";
const NAVIGATEUR = { "sec-fetch-dest": "document", "sec-fetch-mode": "navigate", "accept-language": "fr-FR,fr;q=0.9" };

async function run(url, headers = {}) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
  const { middleware } = await import("../middleware.js");
  const waits = [];
  const res = middleware(new NextRequest(url, { headers: { "user-agent": CHROME, host: new URL(url).host, ...headers } }), { waitUntil: (p) => waits.push(p) });
  await Promise.all(waits);
  return res;
}

const evenements = (fetchMock) => fetchMock.mock.calls.map((c) => JSON.parse(c[1].body));

describe("middleware : appareils de l'équipe et allure des visites", () => {
  let fetchMock;
  beforeEach(() => {
    fetchMock = vi.fn(() => Promise.resolve({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("note l'allure de la requête sur chaque visite du site, sans rien d'autre sur la personne", async () => {
    await run("https://www.withmerry.com/", NAVIGATEUR);
    await run("https://www.withmerry.com/");
    const [complet, script] = evenements(fetchMock);
    expect(complet.properties).toMatchObject({ etape: "site", entetes: "complet", $process_person_profile: false, $ip: null });
    expect(script.properties.entetes).toBe("sans_sec_fetch");
    expect(complet.distinct_id).toMatch(/^compteur:/);
  });

  it("ne pose aucun repère chez un visiteur", async () => {
    const res = await run("https://www.withmerry.com/?source=meta-a", NAVIGATEUR);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("?interne=1 pose le repère sur tout withmerry.com pour un an, fermé au navigateur, et ne compte pas la visite", async () => {
    const res = await run("https://www.withmerry.com/?interne=1", NAVIGATEUR);
    const cookie = res.headers.get("set-cookie");
    expect(cookie).toMatch(/^merry_interne=1;/);
    expect(cookie).toMatch(/Domain=\.withmerry\.com/i);
    expect(cookie).toMatch(/Max-Age=31536000/i);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("?interne=1 marche aussi sur l'appli, et ?interne=0 retire le repère", async () => {
    const pose = await run("https://app.withmerry.com/?interne=1", NAVIGATEUR);
    expect(pose.headers.get("set-cookie")).toMatch(/^merry_interne=1;.*Domain=\.withmerry\.com/i);
    const retire = await run("https://www.withmerry.com/?interne=0", { ...NAVIGATEUR, cookie: "merry_interne=1" });
    expect(retire.headers.get("set-cookie")).toMatch(/Max-Age=0/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ne compte plus ni le site ni l'ouverture de l'appli depuis un appareil repéré", async () => {
    await run("https://www.withmerry.com/", { ...NAVIGATEUR, cookie: "merry_interne=1" });
    await run("https://app.withmerry.com/?source=meta-c", { ...NAVIGATEUR, cookie: "x=y; merry_interne=1" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("un repère ne change rien pour les robots : ils restent relevés à part", async () => {
    await run("https://www.withmerry.com/", { "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", cookie: "merry_interne=1" });
    expect(evenements(fetchMock).map((e) => e.event)).toEqual(["robot_hit"]);
  });

  it("ne pose rien en local", async () => {
    const res = await run("http://localhost:3000/?interne=1", NAVIGATEUR);
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});

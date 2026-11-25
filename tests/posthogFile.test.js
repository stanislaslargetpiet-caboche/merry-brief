import { describe, expect, it } from "vitest";
import { hogqlAvecReprise, limiteur, pause429 } from "@/lib/server/pilotage/posthog";

const reponse = (status, corps) => ({
  ok: status < 400,
  status,
  headers: { get: () => null },
  json: async () => corps,
  text: async () => (typeof corps === "string" ? corps : JSON.stringify(corps)),
});
const THROTTLED = '{"type":"throttled_error","code":"throttled","detail":"Too many queries are running right now — please try again in a moment. Expected available in 5 seconds."}';

describe("file des requêtes PostHog", () => {
  it("ne lance jamais plus de n tâches à la fois, et les termine toutes", async () => {
    const enFile = limiteur(4);
    let actifs = 0;
    let pic = 0;
    const taches = Array.from({ length: 50 }, (_, i) =>
      enFile(async () => {
        actifs++;
        pic = Math.max(pic, actifs);
        await new Promise((r) => setTimeout(r, 1));
        actifs--;
        return i;
      }),
    );
    const res = await Promise.all(taches);
    expect(pic).toBe(4);
    expect(res).toEqual(Array.from({ length: 50 }, (_, i) => i));
  });

  it("une tâche en échec libère sa place", async () => {
    const enFile = limiteur(1);
    await expect(enFile(async () => { throw new Error("x"); })).rejects.toThrow("x");
    await expect(enFile(async () => 2)).resolves.toBe(2);
  });

  it("retente un 429 après la pause annoncée, puis rend le résultat", async () => {
    const suite = [reponse(429, THROTTLED), reponse(429, THROTTLED), reponse(200, { results: [[1]] })];
    const pauses = [];
    const res = await hogqlAvecReprise(async () => suite.shift(), null, { dormir: async (ms) => pauses.push(ms) });
    expect(res).toEqual([[1]]);
    expect(pauses).toEqual([5000, 5000]);
  });

  it("abandonne après trois reprises, et ne retente pas les autres erreurs", async () => {
    await expect(hogqlAvecReprise(async () => reponse(429, THROTTLED), null, { dormir: async () => {} })).rejects.toThrow(/^posthog_429/);
    let n = 0;
    await expect(hogqlAvecReprise(async () => (n++, reponse(400, "bad query")), null, { dormir: async () => {} })).rejects.toThrow("posthog_400: bad query");
    expect(n).toBe(1);
  });

  it("borne la pause entre 1 et 8 secondes", () => {
    expect(pause429("30", "", 0)).toBe(8000);
    expect(pause429(null, "Expected available in 0.2 seconds.", 0)).toBe(1000);
    expect(pause429(null, "", 1)).toBe(4000);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { MOTIF_BRUIT_SQL, SANS_BRUIT_SQL, estBruitNavigateur, estExceptionDeBruit } from "@/lib/bruitNavigateur";
import { scrub } from "@/lib/analytics";
import { readPostHog } from "@/lib/server/pilotage/posthog";

// Alerte du 21 nov. 2026 : « 21 erreur(s) JavaScript sur 21 jours », toutes lancées par le navigateur ou par ce
// qu'il injecte dans la page, aucune par le code de Merry. Les trois messages de l'alerte, tels que PostHog les a.
const BRUIT = [
  ["Error", "Script error."],
  ["TypeError", `null is not an object (evaluating 'document.querySelector("meta[property='og:type']").content')`],
  ["Error", "Error invoking postMessage: Java object is gone"],
];
const VRAIES = [
  ["TypeError", "Cannot read properties of undefined (reading 'map')"],
  ["ChunkLoadError", "Loading chunk 512 failed"],
  ["Error", "Script error in table import"],
  ["TypeError", "null is not an object (evaluating 'a.content')"],
];
const exception = (...erreurs) => ({ event: "$exception", properties: { $current_url: "https://app.withmerry.com/dashboard/invites", $exception_list: erreurs.map(([type, value]) => ({ type, value })) } });

describe("bruit de navigateur", () => {
  it("reconnaît les trois messages de l'alerte et aucune vraie erreur", () => {
    BRUIT.forEach(([, m]) => expect(estBruitNavigateur(m), m).toBe(true));
    VRAIES.forEach(([, m]) => expect(estBruitNavigateur(m), m).toBe(false));
    expect(estBruitNavigateur(null)).toBe(false);
  });

  it("n'envoie plus ces erreurs à PostHog, et laisse partir tout le reste", () => {
    BRUIT.forEach((e) => expect(scrub(exception(e))).toBeNull());
    VRAIES.forEach((e) => expect(scrub(exception(e))).not.toBeNull());
    // Une vraie erreur enchaînée à du bruit part quand même
    expect(scrub(exception(BRUIT[0], VRAIES[0]))).not.toBeNull();
    expect(scrub({ event: "$exception", properties: { $exception_message: "Script error." } })).toBeNull();
    expect(scrub({ event: "$exception", properties: {} })).not.toBeNull();
    // Les autres événements ne sont jamais écartés, même avec un texte qui ressemble
    expect(scrub({ event: "$pageview", properties: { $exception_message: "Script error." } })).not.toBeNull();
    expect(estExceptionDeBruit(null)).toBe(false);
  });

  it("le motif lu par PostHog écarte les mêmes erreurs que le navigateur", () => {
    // Ce que la condition SQL compare : le JSON brut de la liste, l'ancien champ, puis un guillemet fermant
    const motif = new RegExp(MOTIF_BRUIT_SQL);
    const brut = (type, value) => `${JSON.stringify([{ type, value, mechanism: { handled: false } }])} "`;
    const ancien = (value) => ` ${value}"`;
    BRUIT.forEach(([t, m]) => {
      expect(motif.test(brut(t, m)), m).toBe(true);
      expect(motif.test(ancien(m)), m).toBe(true);
    });
    VRAIES.forEach(([t, m]) => {
      expect(motif.test(brut(t, m)), m).toBe(false);
      expect(motif.test(ancien(m)), m).toBe(false);
    });
    // Collé tel quel dans une chaîne HogQL entre apostrophes
    expect(MOTIF_BRUIT_SQL).not.toMatch(/['\\]/);
  });
});

describe("pilotage : erreurs comptées", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("le total par jour, le total par heure et la liste écartent le bruit de navigateur", async () => {
    vi.stubEnv("POSTHOG_PERSONAL_API_KEY", "phx_test");
    const requetes = [];
    vi.stubGlobal("fetch", async (_url, init) => {
      requetes.push(JSON.parse(init.body).query.query);
      return { ok: true, json: async () => ({ results: [] }) };
    });
    await readPostHog(1);
    const surExceptions = requetes.filter((q) => /event (= '\$exception'|IN \('\$exception')/.test(q.split("WHERE")[1] || ""));
    expect(surExceptions).toHaveLength(3);
    surExceptions.forEach((q) => expect(q).toContain(SANS_BRUIT_SQL));
  });
});

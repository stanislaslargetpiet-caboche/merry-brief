import { beforeEach, describe, expect, it, vi } from "vitest";

// Page Prestataires, 16 novembre 2026 vers 17 h 41 (heure de Paris), journaux Supabase : un couple passe de Lieux à
// Fleuristes, Photographes puis Autres en cinq secondes ; le stockage refuse deux signatures de photos sur quatre (429)
// et les cartes restent sans photo. Puis « ro », « rob », « robe » dans la recherche par nom dépassent le temps limite
// de la base (500). Un refus de signature est retenté une fois, les liens déjà signés sont gardés dans la page, et la
// recherche par nom n'interroge la base qu'à partir de trois lettres.

const sign = vi.fn();
const schema = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    storage: { from: () => ({ createSignedUrls: (...a) => sign(...a) }) },
    schema: (...a) => schema(...a),
  },
}));

const { signPhotos, searchCatalogByName, SEARCH_MIN } = await import("@/lib/dash/catalog");

const ok = (paths) => ({ data: paths.map((path) => ({ path, signedUrl: `https://x/${path}?token=t` })), error: null });
const refus = { data: null, error: { message: "Too Many Requests", statusCode: "429" } };

beforeEach(() => {
  sign.mockReset();
  schema.mockReset();
});

describe("signature des photos du catalogue", () => {
  it("retente une fois après un refus 429", async () => {
    sign.mockResolvedValueOnce(refus).mockImplementationOnce(async (paths) => ok(paths));
    const urls = await signPhotos(["a/1.webp", "b/1.webp"], { pauseMs: 0 });
    expect(sign).toHaveBeenCalledTimes(2);
    expect(urls.get("a/1.webp")).toContain("a/1.webp");
    expect(urls.get("b/1.webp")).toContain("b/1.webp");
  });

  it("ne redemande pas une photo déjà signée", async () => {
    sign.mockImplementation(async (paths) => ok(paths));
    await signPhotos(["c/1.webp"], { pauseMs: 0 });
    const urls = await signPhotos(["c/1.webp", "d/1.webp"], { pauseMs: 0 });
    expect(sign).toHaveBeenCalledTimes(2);
    expect(sign.mock.calls[1][0]).toEqual(["d/1.webp"]);
    expect(urls.size).toBe(2);
  });

  it("deux refus de suite : pas de lien, pas d'erreur, et la photo sera redemandée", async () => {
    sign.mockResolvedValue(refus);
    const urls = await signPhotos(["e/1.webp"], { pauseMs: 0 });
    expect(urls.size).toBe(0);
    expect(sign).toHaveBeenCalledTimes(2);
    sign.mockImplementation(async (paths) => ok(paths));
    expect((await signPhotos(["e/1.webp"], { pauseMs: 0 })).size).toBe(1);
  });
});

describe("recherche par nom dans le catalogue", () => {
  it("n'interroge pas la base avant trois lettres", async () => {
    expect(SEARCH_MIN).toBe(3);
    expect(await searchCatalogByName("live", "ro")).toEqual([]);
    expect(schema).not.toHaveBeenCalled();
  });
});

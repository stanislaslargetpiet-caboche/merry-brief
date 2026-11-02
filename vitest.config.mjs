import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests unitaires de la logique pure (lib/) : `npm test`. Les tests SQL vivent dans scripts/sql (voir la CI).
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: { include: ["tests/**/*.test.js"], environment: "node" },
});

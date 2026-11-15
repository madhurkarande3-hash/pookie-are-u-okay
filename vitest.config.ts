import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: { environment: "node", include: ["tests/**/*.test.ts"], exclude: ["tests/rules/**", "tests/e2e/**", "node_modules/**"] },
  resolve: {
    alias: {
      "@shared": fileURLToPath(new URL("./functions/src/shared", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { defineConfig } from "vitest/config";

const currentDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@shared": currentDir,
      "@": currentDir,
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: [resolve(currentDir, "test-utils/vitest-setup.ts")],
  },
});

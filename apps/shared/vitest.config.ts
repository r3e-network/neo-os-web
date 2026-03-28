import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

const currentDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [vue()],
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

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { defineConfig } from "vitest/config";

const currentDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: currentDir,
  resolve: {
    alias: {
      "@shared": currentDir,
      "@": currentDir,
    },
  },
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    exclude: ["**/node_modules/**", "**/.next/**", "**/dist/**"],
    environmentOptions: {
      jsdom: {
        url: "http://localhost/",
      },
    },
    setupFiles: [resolve(currentDir, "test-utils/vitest-setup.ts")],
  },
});

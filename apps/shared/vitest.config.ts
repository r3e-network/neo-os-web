import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { defineConfig } from "vitest/config";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(currentDir, "../..");

export default defineConfig({
  root: currentDir,
  resolve: {
    alias: {
      "@framework": resolve(repoRoot, "framework"),
      "@shared": currentDir,
      "@": currentDir,
      phaser: resolve(repoRoot, "node_modules/phaser/dist/phaser.esm.js"),
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
    server: {
      deps: {
        inline: [
          "@douyinfe/semi-icons",
          "@douyinfe/semi-ui",
          /@douyinfe\/semi-foundation/,
        ],
      },
    },
  },
});

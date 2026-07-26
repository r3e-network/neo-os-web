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
      // No "@" alias on purpose. Each app maps "@/*" to its OWN src (per-app
      // tsconfig, and `apps/vite.shared.react.ts` resolves it to appDir/src), so a
      // single mapping here cannot be correct for the sibling-app sources these
      // tests import by relative path. Aliasing "@" to this directory silently
      // bound those imports to apps/shared's modules instead — e.g. wallet-health's
      // `@/locale/messages` resolved to apps/shared/locale/messages, whose missing
      // keys made `t()` echo the key back and let assertions pass against the wrong
      // catalog. Without the alias such an import fails loudly instead.
      phaser: resolve(repoRoot, "node_modules/phaser/dist/phaser.esm.js"),
    },
  },
  test: {
    testTimeout: 30_000,
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

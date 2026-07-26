import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(currentDir, "..");

export default defineConfig({
  root: currentDir,
  resolve: {
    alias: {
      "@tests": currentDir,
      "@contracts": resolve(repoRoot, "contracts"),
      "@framework": resolve(repoRoot, "framework"),
      "@apps": resolve(repoRoot, "apps"),
    },
  },
  test: {
    environment: "node",
    include: ["validation/**/*.test.ts", "integration/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    setupFiles: [resolve(currentDir, "setup.ts")],
    testTimeout: 30000, // 30s for contract interactions
    hookTimeout: 10000,
  },
});

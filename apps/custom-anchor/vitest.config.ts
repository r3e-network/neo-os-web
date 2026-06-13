import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const currentDir = dirname(fileURLToPath(import.meta.url));
const sharedDir = resolve(currentDir, "..", "shared");

// Standalone vitest config for the custom-anchor miniapp. Resolves the @shared
// alias the same way the build config does and runs in jsdom so the PlayArea
// React component can be rendered with @testing-library/react.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@shared": sharedDir,
      "@": sharedDir,
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    environmentOptions: {
      jsdom: {
        url: "http://localhost/",
      },
    },
  },
});

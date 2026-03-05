/**
 * Vitest configuration for miniapps
 * Can be copied to other miniapps with minimal changes
 */

import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: [resolve(__dirname, "../../shared/test-utils/vitest-setup.ts")],
    include: ["**/__tests__/**/*.{test,spec}.{ts,js}", "**/__tests__/**/*.{test,spec}.{ts,js}x"],
    exclude: ["node_modules", "dist"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "dist/", "**/*.test.{ts,js}", "**/*.spec.{ts,js}", "**/types/"],
    },
    mockReset: true,
    restoreMocks: true,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "@shared": resolve(__dirname, "../../shared"),
      "@neo/uniapp-sdk": resolve(__dirname, "../../sdk/packages/@neo/uniapp-sdk/src"),
      "@neo/types": resolve(__dirname, "../../sdk/packages/@neo/types/src"),
    },
  },
});

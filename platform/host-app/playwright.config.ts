import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const auth0TestEnv = {
  AUTH0_SECRET: process.env.AUTH0_SECRET ?? "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  AUTH0_BASE_URL: process.env.AUTH0_BASE_URL ?? "http://127.0.0.1:3004",
  AUTH0_ISSUER_BASE_URL: process.env.AUTH0_ISSUER_BASE_URL ?? "https://example.auth0.com",
  AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID ?? "playwright-client",
  AUTH0_CLIENT_SECRET: process.env.AUTH0_CLIENT_SECRET ?? "playwright-secret",
  PLAYWRIGHT: "1",
  MINIAPP_CATALOG_SOURCE: process.env.MINIAPP_CATALOG_SOURCE ?? "local",
  MINIAPP_APPS_DIR: process.env.MINIAPP_APPS_DIR ?? path.resolve(__dirname, "..", "..", "apps"),
};

const localWorkerCount = Number.parseInt(
  process.env.PLAYWRIGHT_WORKERS ?? "4",
  10,
);
const safeLocalWorkers = Number.isFinite(localWorkerCount)
  ? Math.min(4, Math.max(1, localWorkerCount))
  : 1;
const systemChrome = process.env.PLAYWRIGHT_USE_SYSTEM_CHROME === "1";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : safeLocalWorkers,
  reporter: "html",
  use: {
    baseURL: "http://127.0.0.1:3004",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(systemChrome ? { channel: "chrome" } : {}),
      },
    },
  ],
  webServer: {
    // Wrap the standalone server so its stdout/stderr are preserved for post-mortem
    // when the process exits mid-suite (e.g. ERR_CONNECTION_REFUSED in tests).
    // NOTE: Avoid `bash -lc` here. The hourly validation runner is non-interactive and may
    // have shell init hooks that emit TUI warnings or otherwise interfere with Playwright's
    // server lifecycle management. Running Node directly is quieter and more reliable.
    //
    // We run the standalone server from its own directory so relative paths such as
    // `public/miniapp-definitions` resolve correctly regardless of the Playwright runner CWD.
    command:
      "node server.js",
    cwd: path.join(__dirname, ".playwright-standalone", "platform", "host-app"),
    env: {
      ...process.env,
      ...auth0TestEnv,
      // The standalone server expects production semantics; inheriting NODE_ENV=test from
      // the Playwright runner can break Next's build manifest resolution and lead to blank pages.
      NODE_ENV: "production",
      // The full-suite surface crawl can transiently spike memory in the standalone server.
      // Give it a higher ceiling to avoid mid-suite exits that surface as ERR_CONNECTION_REFUSED.
      NODE_OPTIONS: process.env.NODE_OPTIONS ?? "--max-old-space-size=4096",
      PORT: "3004",
    },
    url: "http://127.0.0.1:3004",
    reuseExistingServer: false,
    timeout: 120000,
  },
});

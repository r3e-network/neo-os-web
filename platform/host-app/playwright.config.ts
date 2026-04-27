import { defineConfig, devices } from "@playwright/test";

const auth0TestEnv = {
  AUTH0_SECRET: process.env.AUTH0_SECRET ?? "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  AUTH0_BASE_URL: process.env.AUTH0_BASE_URL ?? "http://localhost:3004",
  AUTH0_ISSUER_BASE_URL: process.env.AUTH0_ISSUER_BASE_URL ?? "https://example.auth0.com",
  AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID ?? "playwright-client",
  AUTH0_CLIENT_SECRET: process.env.AUTH0_CLIENT_SECRET ?? "playwright-secret",
  PLAYWRIGHT: "1",
  MINIAPP_CATALOG_SOURCE: process.env.MINIAPP_CATALOG_SOURCE ?? "local",
};

const localWorkerCount = Number.parseInt(
  process.env.PLAYWRIGHT_WORKERS ?? "4",
  10,
);
const safeLocalWorkers = Number.isFinite(localWorkerCount)
  ? Math.min(4, Math.max(1, localWorkerCount))
  : 4;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : safeLocalWorkers,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3004",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "node -e \"require('fs').rmSync('.next', { recursive: true, force: true })\" && npm run dev -- --port 3004",
    env: {
      ...process.env,
      ...auth0TestEnv,
    },
    url: "http://localhost:3004",
    reuseExistingServer: false,
    timeout: 120000,
  },
});

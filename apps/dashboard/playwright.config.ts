import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  retries: 0,
  workers: 1,
  timeout: 60_000,
  use: {
    baseURL: process.env.DASHBOARD_URL || "http://localhost:8081",
    headless: true,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4318";
const systemChrome = process.env.PLAYWRIGHT_USE_SYSTEM_CHROME === "1";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: Number.parseInt(process.env.PLAYWRIGHT_WORKERS || "2", 10),
  reporter: [["line"], ["html", { open: "never" }]],
  use: {
    baseURL,
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
    {
      name: "mobile-chrome",
      use: {
        ...devices["Pixel 7"],
        ...(systemChrome ? { channel: "chrome" } : {}),
      },
    },
  ],
});

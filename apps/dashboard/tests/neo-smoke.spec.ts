import { test, expect } from "@playwright/test";
import { stubNeoEndpoints } from "./support/neoStubs";

const API = process.env.API_URL || "http://localhost:8080";
const TOKEN = process.env.API_TOKEN || "dev-token";
const TENANT = process.env.API_TENANT || "";

test("deep link loads and NEO panel renders", async ({ page }) => {
  await stubNeoEndpoints(page, { apiBase: API });

  const qs = new URLSearchParams({
    api: API,
    token: TOKEN,
    tenant: TENANT,
  });
  await page.goto(`/?${qs.toString()}`);

  await expect(page.getByText("Dashboard bootstrap")).toBeVisible();

  // Settings fields should be prefilled from query params
  await expect(page.getByLabel("API base URL", { exact: false })).toHaveValue(API.replace(/\/$/, ""));
  await expect(page.getByLabel("Token", { exact: false })).toHaveValue(TOKEN);

  // Neo panel should render even if empty; errors should not be thrown.
  const neoPanel = page.getByRole("heading", { name: /NEO/i });
  await expect(neoPanel).toBeVisible();

  // Trigger a refresh to hit /neo/blocks and /neo/snapshots; ignore failures, just ensure no crash.
  const refresh = page.getByRole("button", { name: /Refresh/ });
  await refresh.click();

  // If a block list is present, open the first block and (optionally) load storage blobs.
  const blockTags = page.getByText(/^#\d+/, { exact: false });
  if ((await blockTags.count()) > 0) {
    await blockTags.first().click();
    const loadStorageBtn = page.getByRole("button", { name: /Load storage blobs/i });
    if (await loadStorageBtn.isVisible()) {
      await loadStorageBtn.click();
      // Wait for either a success tag or a storage section to render; tolerate empty data.
      await page.waitForTimeout(500);
    }
  }

  // System overview should load without the generic error banner.
  await expect(page.getByText("Failed to load", { exact: false })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /Accounts/i })).toBeVisible();

  // If a snapshot exists, attempt Verify to exercise hash/signature check.
  const verifyButtons = page.getByRole("button", { name: /Verify/ });
  const count = await verifyButtons.count();
  if (count > 0) {
    await verifyButtons.nth(0).click();
  }
});

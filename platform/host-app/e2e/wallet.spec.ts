import { test, expect } from "@playwright/test";

test.describe("Wallet Connection", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should display Connect Wallet button", async ({ page }) => {
    const connectButton = page.getByRole("button", { name: /connect wallet/i });
    await expect(connectButton).toBeVisible();
    await expect(connectButton).toHaveClass(/bg-green-600/);
  });

  test("should show wallet options on click", async ({ page }) => {
    const connectButton = page.getByRole("button", { name: /connect wallet/i });
    await connectButton.click();

    // Check wallet options appear
    await expect(page.getByText("Select Wallet")).toBeVisible();
    await expect(page.getByText("NeoLine")).toBeVisible();
    await expect(page.getByText("O3")).toBeVisible();
    await expect(page.getByText("OneGate")).toBeVisible();
  });

  test("should display wallet icons", async ({ page }) => {
    const connectButton = page.getByRole("button", { name: /connect wallet/i });
    await connectButton.click();

    // Check wallet icons are images
    const walletImages = page.locator('img[alt="NeoLine"], img[alt="O3"], img[alt="OneGate"]');
    await expect(walletImages).toHaveCount(3);
  });

  test("should toggle menu on button click", async ({ page }) => {
    const connectButton = page.getByRole("button", { name: /connect wallet/i });

    // First click - open menu
    await connectButton.click();
    await expect(page.getByText("Select Wallet")).toBeVisible();

    // Second click - close menu
    await connectButton.click();
    await expect(page.getByText("Select Wallet")).not.toBeVisible();

    // Third click - open again
    await connectButton.click();
    await expect(page.getByText("Select Wallet")).toBeVisible();
  });
});

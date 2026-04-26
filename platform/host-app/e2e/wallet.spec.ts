import { test, expect } from "@playwright/test";

test.describe("Wallet Connection", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should display login button", async ({ page }) => {
    const connectButton = page.getByRole("button", { name: /log in \/ sign up/i });
    await expect(connectButton).toBeVisible();
  });

  test("should show wallet and social options on click", async ({ page }) => {
    const connectButton = page.getByRole("button", { name: /log in \/ sign up/i });
    await connectButton.click();

    await expect(page.getByRole("heading", { name: "Welcome to R3E" })).toBeVisible();
    await expect(page.getByText("Email & Social")).toBeVisible();
    await expect(page.getByText("Neo Ecosystem")).toBeVisible();
    await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /continue with github/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "NeoLine" })).toBeVisible();
    await expect(page.getByRole("button", { name: "O3" })).toBeVisible();
    await expect(page.getByRole("button", { name: "OneGate" })).toBeVisible();
    await expect(page.getByText("Direct WIF Testing")).toBeVisible();
    await expect(page.getByLabel("Direct WIF")).toBeVisible();
  });

  test("should display wallet icons", async ({ page }) => {
    const connectButton = page.getByRole("button", { name: /log in \/ sign up/i });
    await connectButton.click();
    await expect(page.getByRole("heading", { name: "Welcome to R3E" })).toBeVisible();

    const walletImages = page.locator('img[alt="NeoLine"], img[alt="O3"], img[alt="OneGate"]');
    await expect(walletImages).toHaveCount(3);
  });

  test("should open and close login modal", async ({ page }) => {
    const connectButton = page.getByRole("button", { name: /log in \/ sign up/i });
    await connectButton.click();
    await expect(page.getByRole("heading", { name: "Welcome to R3E" })).toBeVisible();

    await page.getByRole("button", { name: /close login modal/i }).click();
    await expect(page.getByRole("heading", { name: "Welcome to R3E" })).not.toBeVisible();
  });

  test("should keep the direct WIF path local-only and show invalid input safely", async ({ page }) => {
    const connectButton = page.getByRole("button", { name: /log in \/ sign up/i });
    await connectButton.click();

    const wifInput = page.getByLabel("Direct WIF");
    const directConnect = page.getByRole("button", { name: "Connect" });
    await expect(directConnect).toBeDisabled();

    await wifInput.fill("not-a-valid-wif");
    await expect(directConnect).toBeEnabled();
    await directConnect.click();

    await expect(page.locator('div[role="alert"]')).toContainText("Invalid WIF");
    const localStorageDump = await page.evaluate(() => JSON.stringify(window.localStorage));
    expect(localStorageDump).not.toContain("not-a-valid-wif");
  });
});

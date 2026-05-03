import { test, expect } from "@playwright/test";

test.describe("MiniApps List", () => {
  test.beforeEach(async ({ page }) => {
    const catalogRequest = page.waitForResponse((response) => response.url().includes("/api/miniapps/catalog"));
    await Promise.all([catalogRequest, page.goto("/miniapps")]);
  });

  test("should display the complete catalog hero", async ({ page }) => {
    const networkLabel =
      String(process.env.NEXT_PUBLIC_NEO_TARGET_NETWORK || process.env.NEO_TARGET_NETWORK)
        .toLowerCase()
        .includes("testnet")
        ? "Neo N3 Testnet"
        : "Neo N3 Mainnet";
    await expect(page.getByText(networkLabel)).toBeVisible();
    await expect(page.getByRole("heading", { name: "MiniApps" })).toBeVisible();
    await expect(page.getByText("Browse supported miniapps. Pick one and start using it.")).toBeVisible();
  });

  test("should render every supported catalog card", async ({ page }) => {
    const catalog = await page.request.get("/api/miniapps/catalog");
    expect(catalog.ok()).toBeTruthy();
    const body = await catalog.json();
    const supportedApps = Array.isArray(body.apps)
      ? body.apps.filter((app: { status?: string }) => app.status !== "disabled")
      : [];
    const cards = page.locator('a[href^="/miniapps/miniapp-"]');
    expect(supportedApps.length).toBeGreaterThan(40);
    await expect(cards).toHaveCount(supportedApps.length);
    await expect(page.locator('a[href="/miniapps/miniapp-last-survivor"]')).toBeVisible();
    await expect(page.locator('a[href="/miniapps/miniapp-fogplay"]')).toBeVisible();
    await expect(page.locator('a[href="/miniapps/miniapp-neo-pay"]')).toBeVisible();
    await expect(page.locator('a[href="/miniapps/miniapp-profitanchor"]')).toBeVisible();
    await expect(page.locator('a[href="/miniapps/miniapp-trustanchor"]')).toBeVisible();
    await expect(page.locator('a[href="/miniapps/miniapp-flamingo"]')).toHaveCount(0);
    await expect(page.locator('a[href="/miniapps/miniapp-flaminggo"]')).toHaveCount(0);
    await expect(page.locator('a[href="/miniapps/miniapp-neoburger"]')).toHaveCount(0);
    await expect(page.locator('a[href="/miniapps/miniapp-neo-burger"]')).toHaveCount(0);
  });

  test("should link core cards to their detail pages", async ({ page }) => {
    await expect(page.locator('a[href="/miniapps/miniapp-last-survivor"]')).toHaveAttribute("href", "/miniapps/miniapp-last-survivor");
    await expect(page.locator('a[href="/miniapps/miniapp-redenvelope"]')).toHaveAttribute("href", "/miniapps/miniapp-redenvelope");
    await expect(page.locator('a[href="/miniapps/miniapp-self-loan"]')).toHaveAttribute("href", "/miniapps/miniapp-self-loan");
  });

  test("should show status and category metadata", async ({ page }) => {
    await expect(page.getByText("Live").first()).toBeVisible();
    await expect(page.getByText("gaming").first()).toBeVisible();
    await expect(page.getByText("social").first()).toBeVisible();
    await expect(page.getByText("defi").first()).toBeVisible();
  });
});

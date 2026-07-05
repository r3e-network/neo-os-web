import { test, expect, type Page } from "@playwright/test";

function marketRowLocator(page: Page, appId: string) {
  return page.locator(
    `[data-testid="miniapp-market-row"][href^="/miniapps/${appId}?network="]`,
  );
}

test.describe("MiniApps List", () => {
  test.beforeEach(async ({ page }) => {
    const catalogRequest = page.waitForResponse(
      (response) => response.url().includes("/api/miniapps/catalog"),
      { timeout: 90_000 },
    );
    await Promise.all([catalogRequest, page.goto("/miniapps", { waitUntil: "domcontentloaded" })]);
  });

  test("should display the complete catalog hero", async ({ page }) => {
    await expect(
      page
        .getByTestId("miniapps-market-shell")
        .locator("section")
        .first()
        .getByText(/Neo N3 (Mainnet|Testnet)/),
    ).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Neo Miniapps/i);
    await expect(
      page.getByText(
        "Browse small, focused MiniApps for Neo N3. Pick one, open the play area, and operate from the shared action console.",
      ),
    ).toBeVisible();
  });

  test("should render every supported catalog card", async ({ page }) => {
    const catalog = await page.request.get("/api/miniapps/catalog?scope=all");
    expect(catalog.ok()).toBeTruthy();
    const body = await catalog.json();
    const supportedApps = Array.isArray(body.apps)
      ? body.apps.filter((app: { status?: string }) => app.status !== "disabled")
      : [];
    const cards = page.getByTestId("miniapp-market-row");
    expect(supportedApps.length).toBeGreaterThan(30);
    await expect(cards).toHaveCount(supportedApps.length);
    await expect(marketRowLocator(page, "miniapp-last-survivor")).toBeVisible();
    await expect(marketRowLocator(page, "miniapp-fogplay")).toBeVisible();
    await expect(marketRowLocator(page, "miniapp-neo-pay")).toBeVisible();
    await expect(marketRowLocator(page, "miniapp-profitanchor")).toBeVisible();
    await expect(marketRowLocator(page, "miniapp-trustanchor")).toBeVisible();
    await expect(page.locator('a[href="/miniapps/miniapp-flamingo"]')).toHaveCount(0);
    await expect(page.locator('a[href="/miniapps/miniapp-flaminggo"]')).toHaveCount(0);
    await expect(page.locator('a[href="/miniapps/miniapp-neoburger"]')).toHaveCount(0);
    await expect(page.locator('a[href="/miniapps/miniapp-neo-burger"]')).toHaveCount(0);
  });

  test("should link core cards to their detail pages", async ({ page }) => {
    await expect(marketRowLocator(page, "miniapp-last-survivor")).toHaveAttribute(
      "href",
      /^\/miniapps\/miniapp-last-survivor\?network=/,
    );
    await expect(marketRowLocator(page, "miniapp-redenvelope")).toHaveAttribute(
      "href",
      /^\/miniapps\/miniapp-redenvelope\?network=/,
    );
    await expect(marketRowLocator(page, "miniapp-self-loan")).toHaveAttribute(
      "href",
      /^\/miniapps\/miniapp-self-loan\?network=/,
    );
  });

  test("should show status and category metadata", async ({ page }) => {
    await expect(page.getByText("Live").first()).toBeVisible();
    await expect(page.getByText("gaming").first()).toBeVisible();
    await expect(page.getByText("social").first()).toBeVisible();
    await expect(page.getByText("defi").first()).toBeVisible();
  });
});

import { test, expect, type Page } from "@playwright/test";

const FLAGSHIP_APPS = [
  {
    id: "miniapp-last-survivor",
    name: "LastSurvivor",
    category: "gaming",
  },
  {
    id: "miniapp-fogplay",
    name: "FogPlay",
    category: "gaming",
  },
  {
    id: "miniapp-gasbox",
    name: "GASBOX",
    category: "gaming",
  },
  {
    id: "miniapp-redenvelope",
    name: "Red Envelope",
    category: "social",
  },
  {
    id: "miniapp-dailycheckin",
    name: "Daily Check-in",
    category: "gaming",
  },
  {
    id: "miniapp-self-loan",
    name: "SelfLoan",
    category: "defi",
  },
  {
    id: "miniapp-profitanchor",
    name: "ProfitAnchor",
    category: "defi",
  },
  {
    id: "miniapp-trustanchor",
    name: "TrustAnchor",
    category: "governance",
  },
  {
    id: "miniapp-neo-pay",
    name: "NeoPay",
    category: "defi",
  },
] as const;

async function expectNoPageCrash(page: Page) {
  await expect(page.locator("body")).not.toContainText("Unhandled Runtime Error");
  await expect(page.locator("body")).not.toContainText("Application error");
  await expect(page.locator("body")).not.toContainText("TypeError:");
}

async function exerciseRenderedTabs(page: Page) {
  const tabs = page.getByRole("tab");
  await expect(tabs.first()).toBeVisible();
  const tabCount = await tabs.count();
  expect(tabCount).toBeGreaterThan(0);

  for (let index = 0; index < tabCount; index += 1) {
    const tabButton = tabs.nth(index);
    await expect(tabButton).toBeVisible();
    await tabButton.click();
    await expect(tabButton).toHaveAttribute("aria-selected", "true");
  }
}

async function expectOperationSurface(page: Page) {
  const operationSurface = page.getByRole("complementary").first();
  await expect(operationSurface).toBeVisible();
  await expect(operationSurface.getByRole("heading").first()).toBeVisible();
  await expect(operationSurface).toContainText("Connect wallet from the top navigation");

  const buttons = operationSurface.getByRole("button");
  if ((await buttons.count()) > 0) {
    await expect(buttons.first()).toBeVisible();
  }
}

test.describe("Flagship MiniApp frontend workflows", () => {
  for (const app of FLAGSHIP_APPS) {
    test(`${app.name} renders navigation, tabs, and operation surface`, async ({ page }) => {
      await page.goto(`/miniapps/${app.id}`);

      await expectNoPageCrash(page);
      await expect(page.getByRole("heading", { name: app.name, level: 1 })).toBeVisible();
      await expect(page.getByText(app.category).first()).toBeVisible();
      await expect(page.getByRole("button", { name: /log in \/ sign up/i })).toBeVisible();
      await expect(page.getByText("App ID:")).toBeVisible();
      await expect(page.getByText(app.id, { exact: true })).toBeVisible();

      await exerciseRenderedTabs(page);
      await expectOperationSurface(page);
    });
  }

  test("catalog cards and detail pages stay in sync for every flagship", async ({ page }) => {
    await page.goto("/miniapps");

    for (const app of FLAGSHIP_APPS) {
      const card = page.locator(`a[href="/miniapps/${app.id}"]`);
      await expect(card).toBeVisible();
      await expect(card).toContainText(app.name);
      await expect(card).toContainText(app.category);
    }
  });
});

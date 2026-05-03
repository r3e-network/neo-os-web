import { test, expect } from "@playwright/test";

test.describe("Homepage", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should load homepage", async ({ page }) => {
    await expect(page).toHaveTitle(/R3E Network|Neo/i);
  });

  test("should display navigation", async ({ page }) => {
    await expect(page.getByRole("navigation")).toBeVisible();
  });

  test("should have login button", async ({ page }) => {
    const connectBtn = page.getByRole("button", { name: /log in \/ sign up/i });
    await expect(connectBtn).toBeVisible();
  });

  test("should navigate to MiniApps page", async ({ page }) => {
    const nav = page.getByRole("navigation", { name: "Main navigation" });
    const isDesktop = (page.viewportSize()?.width ?? 1280) >= 768;
    let miniappsLink = isDesktop
      ? nav.getByRole("link", { name: "MiniApps" })
      : page
          .getByRole("navigation", { name: "Mobile navigation" })
          .getByRole("link", { name: "MiniApps" });

    if (!isDesktop) {
      await page.getByRole("button", { name: "Toggle navigation menu" }).click();
      miniappsLink = page
        .getByRole("navigation", { name: "Mobile navigation" })
        .getByRole("link", { name: "MiniApps" });
    }
    await expect(miniappsLink).toBeVisible();
    await expect(miniappsLink).toHaveAttribute("href", "/miniapps");
    await miniappsLink.click();
    await expect(page).toHaveURL(/\/miniapps(\/|$)/, { timeout: 15000 });
  });
});

import { test, expect } from "@playwright/test";

test.describe("Platform Pages", () => {
  test("should load docs and developer pages with unified hero copy", async ({ page }) => {
    await page.goto("/docs");
    await expect(page.getByRole("heading", { name: "Documentation" })).toBeVisible();
    const docsSearch = page.getByRole("textbox", { name: /search documentation/i });
    await expect(docsSearch).toBeVisible();
    await docsSearch.fill("oracle");
    await expect(page.getByRole("button", { name: "Platform Services" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Getting Started" })).toHaveCount(0);

    await page.goto("/developer");
    await expect(page.getByRole("heading", { name: "Developer Portal" })).toBeVisible();
    const openBuilder = page.getByRole("button", { name: /open builder/i });
    await expect(openBuilder).toBeVisible();
    await openBuilder.click();
    await expect(page.getByRole("dialog", { name: "Template Builder" })).toBeVisible();
    await expect(page.getByLabel("App ID")).toBeVisible();
    await expect(page.getByRole("button", { name: "JSON" })).toBeVisible();
    await expect(page.getByRole("button", { name: "YAML" })).toBeVisible();
  });

  test("should load explorer and leaderboard shells", async ({ page }) => {
    await page.goto("/explorer");
    await expect(page.getByRole("heading", { name: "Neo N3 Explorer" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /search by transaction hash, address, or contract/i })).toBeVisible();

    await page.goto("/leaderboard");
    await expect(page.getByRole("heading", { name: "Community Leaderboard" })).toBeVisible();
  });

  test("should load analytics and stats placeholder notices", async ({ page }) => {
    await page.goto("/analytics");
    await expect(page.getByRole("heading", { name: "Analytics Are Temporarily Unavailable" })).toBeVisible();
    await expect(page.getByRole("link", { name: /back to miniapps/i })).toBeVisible();

    await page.goto("/stats");
    await expect(page.getByRole("heading", { name: "Statistics Are Temporarily Unavailable" })).toBeVisible();
    await expect(page.getByRole("link", { name: /browse miniapps/i })).toBeVisible();
  });
});

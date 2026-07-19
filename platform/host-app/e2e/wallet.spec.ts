import { test, expect } from "@playwright/test";

const loginButtonName = /log in(?: \/ sign up)?/i;

test.describe("Wallet Connection", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/miniapps");
  });

  test("should display login button", async ({ page }) => {
    const connectButton = page.getByRole("button", { name: loginButtonName });
    await expect(connectButton).toBeVisible();
  });

  test("should show wallet and social options on click", async ({ page }) => {
    const connectButton = page.getByRole("button", { name: loginButtonName });
    await connectButton.click();

    await expect(page.getByRole("heading", { name: "Welcome to Neo" })).toBeVisible();
    await expect(page.getByText("Email & Social")).toBeVisible();
    await expect(page.getByText("Neo Ecosystem")).toBeVisible();
    await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /continue with github/i })).toBeVisible();
    await expect(page.getByTestId("wallet-option-onegate")).toBeVisible();
    await expect(page.getByTestId("wallet-option-neoline")).toBeVisible();
    await expect(page.getByTestId("wallet-option-nep21")).toHaveCount(0);
    await expect(page.getByTestId("wallet-option-o3")).toHaveCount(0);
    await expect(page.getByText("Developer key")).toHaveCount(0);
    await expect(page.getByLabel("Developer key")).toHaveCount(0);
  });

  test("should display wallet option buttons", async ({ page }) => {
    const connectButton = page.getByRole("button", { name: loginButtonName });
    await connectButton.click();
    await expect(page.getByRole("heading", { name: "Welcome to Neo" })).toBeVisible();

    await expect(page.getByTestId("wallet-option-onegate")).toBeVisible();
    await expect(page.getByTestId("wallet-option-neoline")).toBeVisible();
    await expect(page.getByTestId("wallet-option-nep21")).toHaveCount(0);
    await expect(page.getByTestId("wallet-option-o3")).toHaveCount(0);
  });

  test("should open and close login modal", async ({ page }) => {
    const connectButton = page.getByRole("button", { name: loginButtonName });
    await connectButton.click();
    await expect(page.getByRole("heading", { name: "Welcome to Neo" })).toBeVisible();

    await page.getByRole("button", { name: /close login modal/i }).click();
    await expect(page.getByRole("heading", { name: "Welcome to Neo" })).not.toBeVisible();
  });

  test("should render login modal as a full viewport overlay above navigation", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/miniapps");

    await page.getByRole("button", { name: loginButtonName }).click();
    await expect(page.getByRole("dialog", { name: /connect wallet/i })).toBeVisible();

    const metrics = await page.getByTestId("login-modal-root").evaluate((root) => {
      const rootRect = root.getBoundingClientRect();
      const navRect = document.querySelector("nav")?.getBoundingClientRect();
      const styles = getComputedStyle(root);

      return {
        parentIsBody: root.parentElement === document.body,
        rootHeight: rootRect.height,
        rootWidth: rootRect.width,
        navHeight: navRect?.height ?? 0,
        viewportHeight: window.innerHeight,
        // globals.css sets `scrollbar-gutter: stable` with a 6px custom
        // scrollbar, so the browser reserves a 6px inline gutter that shrinks
        // the layout area (while window.innerWidth still reports the full
        // viewport). document.body spans the gutter-reduced layout area, so it
        // is the reference width a full-viewport fixed overlay must cover.
        layoutWidth: document.body.getBoundingClientRect().width,
        zIndex: styles.zIndex,
        bodyOverflow: getComputedStyle(document.body).overflow,
      };
    });

    expect(metrics.parentIsBody).toBe(true);
    expect(metrics.rootHeight).toBeGreaterThan(metrics.viewportHeight - 2);
    expect(metrics.rootWidth).toBeGreaterThan(metrics.layoutWidth - 2);
    expect(metrics.rootHeight).toBeGreaterThan(metrics.navHeight * 5);
    expect(Number(metrics.zIndex)).toBeGreaterThan(100);
    expect(metrics.bodyOverflow).toBe("hidden");

    await page.getByRole("button", { name: /close login modal/i }).click();
    await expect(page.getByTestId("login-modal-root")).toHaveCount(0);
  });

  test("should keep the developer key path hidden by default", async ({ page }) => {
    const connectButton = page.getByRole("button", { name: loginButtonName });
    await connectButton.click();

    await expect(page.getByText("Developer key")).toHaveCount(0);
    await expect(page.getByLabel("Developer key")).toHaveCount(0);
  });
});

import { test, expect } from "@playwright/test";

test.describe("MiniApp Detail", () => {
  test("should load LastSurvivor miniapp", async ({ page }) => {
    await page.goto("/miniapps/miniapp-last-survivor");
    await expect(page.locator("body")).toBeVisible();
  });

  test("should load FogPlay miniapp", async ({ page }) => {
    await page.goto("/miniapps/miniapp-fogplay");
    await expect(page.locator("body")).toBeVisible();
  });

  test("should show app info", async ({ page }) => {
    await page.goto("/miniapps/miniapp-last-survivor");
    await page.waitForTimeout(1000);
    // Check for any content loaded
    const content = await page.content();
    expect(content.length).toBeGreaterThan(1000);
  });

  test("should resolve shared-mode runtime and invoke shared module operations with a mocked NeoLine wallet", async ({ page }) => {
    await page.addInitScript(() => {
      const calls: Array<Record<string, unknown>> = [];
      (window as any).__sharedInvokeCalls = calls;
      (window as any).NEOLineN3 = {
        Init: function MockNeoLine() {
          return {
            async getAccount() {
              return { address: "NTmHjwiadq4g3VHpJ5FQigQcD4fF5m8TyX", label: "Mock Account" };
            },
            async getPublicKey() {
              return {
                address: "NTmHjwiadq4g3VHpJ5FQigQcD4fF5m8TyX",
                publicKey: "03407c24a382011c16be1597699cd6460f54e49c25098d4943fdf0192c80cb6917",
              };
            },
            async getBalance() {
              return [
                {
                  contract: "0xd2a4cff31913016155e38e474a2c06d08be276cf",
                  symbol: "GAS",
                  amount: "123.45",
                },
                {
                  contract: "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5",
                  symbol: "NEO",
                  amount: "42",
                },
              ];
            },
            async signMessage(params: { message: string }) {
              return {
                publicKey: "03407c24a382011c16be1597699cd6460f54e49c25098d4943fdf0192c80cb6917",
                data: "mock-signature",
                salt: "mock-salt",
                message: params.message,
              };
            },
            async invoke(params: Record<string, unknown>) {
              calls.push(params);
              return { txid: "0xsharedtesttx", nodeUrl: "https://testnet2.neo.coz.io:443" };
            },
          };
        },
      };
    });

    await page.route("**/auth-wallet-nonce", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          nonce: "shared-mode-nonce",
          message: "Sign this shared-mode login challenge",
        }),
      });
    });

    await page.route("**/auth-wallet", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: "playwright-wallet-token",
          user: { id: "wallet-user-1" },
        }),
      });
    });

    await page.goto("/miniapps/miniapp-neo-pay-shared-example");

    await expect(page.getByText("Shared Runtime")).toBeVisible();
    await expect(page.getByText("recipe.payment_streams.v1@1.0.0")).toBeVisible();
    await expect(page.getByText("module.stream_vesting@1.0.0")).toBeVisible();

    await page.getByRole("button", { name: /log in \/ sign up/i }).click();
    await page.getByRole("button", { name: "NeoLine" }).click();

    await expect(page.getByText(/123.45 GAS/i)).toBeVisible();

    await page.getByLabel("Beneficiary Address").fill("NTmHjwiadq4g3VHpJ5FQigQcD4fF5m8TyX");
    await page.getByLabel("Total Amount").fill("20");
    await page.getByLabel("Release Per Interval").fill("1.5");
    await page.getByLabel("Stream Name").fill("Monthly payroll stream");
    await page.getByLabel("Notes").fill("Optional context");

    await page.locator("button.w-full").filter({ hasText: "Create Stream" }).click();

    await page.waitForFunction(() => Array.isArray((window as any).__sharedInvokeCalls) && (window as any).__sharedInvokeCalls.length === 1);

    const calls = await page.evaluate(() => (window as any).__sharedInvokeCalls);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      scriptHash: "0x4fa6544b133457b561e4f9db0248483eca3d33cf",
      operation: "createStream",
    });
  });
});

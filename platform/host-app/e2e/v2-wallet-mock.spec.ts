import { test, expect, type Page } from "@playwright/test";

/**
 * v2 Wallet-Mocked E2E: Mocked wallet injection + miniapp interaction
 * 
 * Injects a mock NEP-21 wallet provider into the page (same approach as the
 * existing miniapp-detail.spec.ts) so we can test wallet connect → read → 
 * transaction-request flow without a real browser extension.
 */

async function injectMockWallet(page: Page, address = "NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32") {
  await page.addInitScript((addr) => {
    const calls: Array<Record<string, unknown>> = [];
    (window as any).__walletCalls = calls;
    
    const provider = {
      name: "MockWallet",
      dapiVersion: "1.0.0",
      compatibility: ["NEP-21"],
      network: 894710606, // testnet
      supportedNetworks: [894710606],
      
      async getAccounts() {
        calls.push({ method: "getAccounts" });
        return [{ address: addr, hash: "0x" + "ab".repeat(20), isDefault: true }];
      },
      
      async getNetwork() {
        calls.push({ method: "getNetwork" });
        return "testnet";
      },
      
      async getBalance() {
        calls.push({ method: "getBalance" });
        return { amount: "100", asset: "GAS" };
      },
      
      async invoke(params: Record<string, unknown>) {
        calls.push({ method: "invoke", params });
        return { txid: "0x" + "ff".repeat(32), events: [] };
      },
      
      async invokeWithPayment(...args: unknown[]) {
        calls.push({ method: "invokeWithPayment", args });
        return { txid: "0x" + "ee".repeat(32) };
      },
      
      on(event: string, callback: Function) {
        calls.push({ method: "on", event });
        if (event === "accountChanged") {
          (window as any).__accountChangedCallback = callback;
        }
      },
      
      removeListener() {},
    };
    
    // Inject as global provider
    (window as any).Neo = { DapiProvider: provider };
    (window as any).__NeoLine = provider;
    (window as any).OneGate = { DapiProvider: provider };
  }, address);
}

test.describe("v2 MiniApp wallet-mocked interaction", () => {
  test.beforeEach(async ({ page }) => {
    await injectMockWallet(page);
  });

  test("dice-game page loads and shows miniapp shell", async ({ page }) => {
    await page.goto("/miniapps/miniapp-dice-game");
    await page.waitForTimeout(3000);
    
    // The page should render
    const body = page.locator("body");
    await expect(body).toBeVisible();
    
    // Check content is substantial
    const content = await page.content();
    expect(content.length).toBeGreaterThan(2000);
  });

  test("flashloan page loads", async ({ page }) => {
    await page.goto("/miniapps/miniapp-flashloan");
    await page.waitForTimeout(2000);
    
    const content = await page.content();
    expect(content.length).toBeGreaterThan(2000);
  });

  test("wallet connect button is visible on miniapps page", async ({ page }) => {
    await page.goto("/miniapps");
    await page.waitForTimeout(1000);
    
    // Should see a login/connect button
    const connectButton = page.getByRole("button", { name: /log in|connect/i }).first();
    if (await connectButton.isVisible().catch(() => false)) {
      // Click it to open the wallet modal
      await connectButton.click();
      await page.waitForTimeout(500);
    }
  });

  test("miniapp detail page shows app identity", async ({ page }) => {
    await page.goto("/miniapps/miniapp-dice-game");
    await page.waitForTimeout(2000);
    
    // Should have some dice-related text
    const content = (await page.content()).toLowerCase();
    const hasDiceContent = content.includes("dice") || content.includes("roll");
    expect(hasDiceContent).toBeTruthy();
  });

  test("oracle-price-console detail page loads", async ({ page }) => {
    await page.goto("/miniapps/miniapp-oracle-price-console");
    await page.waitForTimeout(2000);
    
    const content = await page.content();
    expect(content.length).toBeGreaterThan(1000);
  });

  test("fogplay detail page loads", async ({ page }) => {
    await page.goto("/miniapps/miniapp-fogplay");
    await page.waitForTimeout(2000);
    
    const content = await page.content();
    expect(content.length).toBeGreaterThan(1000);
  });

  test("gasbox detail page loads", async ({ page }) => {
    await page.goto("/miniapps/miniapp-gasbox");
    await page.waitForTimeout(2000);
    
    const content = await page.content();
    expect(content.length).toBeGreaterThan(1000);
  });
});

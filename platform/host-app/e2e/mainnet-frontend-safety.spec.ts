import * as fs from "node:fs";
import * as path from "node:path";
import { expect, test, type Page } from "@playwright/test";

type CatalogApp = {
  app_id?: string;
  name?: string;
  status?: string;
  contract_hash?: string;
  contractHash?: string;
};

type ButtonInfo = {
  index: number;
  label: string;
  disabled: boolean;
  navigation: boolean;
};

const READ_ONLY_POST_ENDPOINTS = new Set(["/api/rpc/neo-read"]);
const AUTH_OR_EXTERNAL_BUTTON =
  /\b(log in|sign up|continue with google|continue with github|continue with twitter|neoline|o3|onegate|nep-21|connect|direct wif|open builder|download|upload|import|export)\b/i;
const MUTATING_APP_BUTTON =
  /\b(stake|claim|create|request|finalize|repay|withdraw|add collateral|sync|issue|swap|sign|bridge|send|vote|buy|check in|open box|sponsor|mint|burn|register|approve|deploy|publish|delete|rollback|submit|verify email|send email)\b/i;
const ALWAYS_SAFE_BUTTON =
  /\b(notifications|switch language|search|close|dismiss|cancel|overview|reviews|forum|news|health|governance|membership|guardians|proof flow|json|yaml|grid view|list view|flip reading|shuffle|reveal|new reading|copy)\b/i;

const repoRoot = path.resolve(__dirname, "../../..");
const appsDir = path.join(repoRoot, "apps");

test.setTimeout(240_000);
const mainnetVisibleAppIds = readMainnetVisibleAppIds();
const mainnetContractAppIds = new Set(readMainnetContractAppIds());

function readManifestBackedApps() {
  return fs
    .readdirSync(appsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "shared")
    .map((entry) => path.join(appsDir, entry.name, "neo-manifest.json"))
    .filter((manifestPath) => fs.existsSync(manifestPath))
    .map((manifestPath) => JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
      id?: string;
      contracts?: Record<string, string>;
      default_network?: string;
    })
    .map((manifest) => ({
      id: String(manifest.id || "").trim(),
      hasMainnetContract: Boolean(String(manifest.contracts?.["neo-n3-mainnet"] || "").trim()),
      defaultNetwork: String(manifest.default_network || ""),
      supportedNetworks: Array.isArray((manifest as { supported_networks?: unknown }).supported_networks)
        ? ((manifest as { supported_networks: unknown[] }).supported_networks).map(String)
        : [],
    }))
    .filter((app) => app.id)
    .filter((app) => !["miniapp-flamingo", "miniapp-flaminggo", "miniapp-neoburger", "miniapp-neo-burger"].includes(app.id))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function readMainnetVisibleAppIds() {
  return readManifestBackedApps()
    .filter((app) =>
      app.defaultNetwork === "neo-n3-mainnet"
      || app.hasMainnetContract
      || app.supportedNetworks.includes("neo-n3-mainnet")
    )
    .map((app) => app.id);
}

function readMainnetContractAppIds() {
  return readManifestBackedApps()
    .filter((app) => app.hasMainnetContract)
    .map((app) => app.id);
}

function readTestnetOnlyAppIds() {
  return readManifestBackedApps()
    .filter((app) =>
      app.defaultNetwork === "neo-n3-testnet"
      && !app.hasMainnetContract
      && !app.supportedNetworks.includes("neo-n3-mainnet")
    )
    .map((app) => app.id);
}

async function captureUnsafeFrontendRequests(page: Page, failures: string[]) {
  page.on("request", (request) => {
    const method = request.method().toUpperCase();
    if (["GET", "HEAD", "OPTIONS"].includes(method)) return;

    const requestUrl = new URL(request.url());
    const pageUrl = new URL(page.url());
    if (requestUrl.origin !== pageUrl.origin) return;

    const allowedReadOnlyPost = method === "POST" && READ_ONLY_POST_ENDPOINTS.has(requestUrl.pathname);
    if (!allowedReadOnlyPost) {
      failures.push(`unexpected mutating request ${method} ${requestUrl.pathname}`);
    }
  });

  page.on("requestfailed", (request) => {
    const failure = request.failure();
    const errorText = String(failure?.errorText || "").trim();
    if (!errorText) return;
    if (errorText.includes("net::ERR_ABORTED")) return;
    if (!/ERR_CONNECTION_REFUSED|ERR_CONNECTION_RESET|ERR_NAME_NOT_RESOLVED|ERR_TIMED_OUT/i.test(errorText)) {
      return;
    }

    try {
      const requestUrl = new URL(request.url());
      const safeUrl = `${requestUrl.origin}${requestUrl.pathname}`;
      failures.push(`request failed: ${errorText} ${request.method().toUpperCase()} ${safeUrl}`);
    } catch {
      failures.push(`request failed: ${errorText} ${request.method().toUpperCase()}`);
    }
  });

  page.on("pageerror", (error) => {
    failures.push(`pageerror: ${error.message}`);
  });

  page.on("console", (message) => {
    if (message.type() === "error") {
      failures.push(`console error: ${message.text()}`);
    }
  });
}

async function expectHealthy(page: Page, route: string) {
  await expect(page.locator("body"), `${route} body should render`).toBeVisible();
  await expect(page.locator("body"), `${route} should not crash`).not.toContainText("Application error");
  await expect(page.locator("body"), `${route} should not show runtime errors`).not.toContainText("Runtime Error");
  await expect(page.locator("body"), `${route} should not leak TypeErrors`).not.toContainText("TypeError:");
  await expect(page.locator("body"), `${route} should be mainnet-scoped`).toContainText(/Neo N3 Mainnet|mainnet/i);
}

async function gotoHealthy(page: Page, route: string) {
  const response = await page.goto(route, { waitUntil: "domcontentloaded" });
  expect(response?.status(), `${route} should return a non-error status`).toBeLessThan(400);
  await page.waitForLoadState("networkidle", { timeout: 6_000 }).catch(() => undefined);
  await expectHealthy(page, route);
}

async function collectVisibleButtons(page: Page): Promise<ButtonInfo[]> {
  return page.evaluate(() => {
    const visible = (element: Element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };

    return Array.from(document.querySelectorAll("button"))
      .filter(visible)
      .map((button, index) => ({
        index,
        label: (
          button.getAttribute("aria-label") ||
          button.getAttribute("title") ||
          button.textContent ||
          `button-${index}`
        ).replace(/\s+/g, " ").trim(),
        disabled: button.hasAttribute("disabled") || button.getAttribute("aria-disabled") === "true",
        navigation: Boolean(button.closest("a[href]")),
      }));
  });
}

async function assertImagesLoaded(page: Page, route: string) {
  await page.evaluate(async () => {
    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const maxY = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
    );
    for (const y of [0, Math.floor(maxY / 2), maxY]) {
      window.scrollTo(0, y);
      await delay(120);
    }
  });
  // Avoid hanging indefinitely on slow/broken remote images. We only need a bounded
  // check that images either load or fail deterministically.
  await page.evaluate(async () => {
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const withTimeout = async (promise: Promise<unknown>, timeoutMs: number) =>
      Promise.race([promise, sleep(timeoutMs)]);

    const images = Array.from(document.querySelectorAll("img"))
      .filter((image) => Boolean(image.currentSrc || image.getAttribute("src")));

    await Promise.all(
      images.map(async (image) => {
        if (!image.complete) {
          await withTimeout(
            new Promise<void>((resolve) => {
              const done = () => {
                image.removeEventListener("load", done);
                image.removeEventListener("error", done);
                resolve();
              };
              image.addEventListener("load", done, { once: true });
              image.addEventListener("error", done, { once: true });
            }),
            2_500,
          );
        }

        if (typeof image.decode === "function") {
          await withTimeout(image.decode().catch(() => undefined), 2_500);
        }
      }),
    );
  });
  const broken = await page.evaluate(() =>
    Array.from(document.querySelectorAll("img"))
      .filter((image) => {
        const hasSource = Boolean(image.currentSrc || image.getAttribute("src"));
        return hasSource && image.complete && image.naturalWidth === 0;
      })
      .map((image) => image.currentSrc || image.getAttribute("src") || image.getAttribute("alt") || "unknown image"),
  );
  expect(broken, `${route} should not contain broken rendered images`).toEqual([]);
}

async function clickIndexedVisibleButton(page: Page, index: number) {
  return page.evaluate((buttonIndex) => {
    const visible = (element: Element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const buttons = Array.from(document.querySelectorAll("button")).filter(visible);
    const button = buttons[buttonIndex];
    if (!(button instanceof HTMLButtonElement) || button.disabled || button.getAttribute("aria-disabled") === "true") {
      return false;
    }
    button.click();
    return true;
  }, index);
}

async function closeTransientUi(page: Page) {
  const closeButtons = page.getByRole("button", { name: /close|dismiss|cancel/i });
  const count = await closeButtons.count();
  if (count > 0) {
    await closeButtons.first().click().catch(() => undefined);
  }
  await page.keyboard.press("Escape").catch(() => undefined);
}

async function exerciseButtonsWithoutWallet(page: Page, route: string) {
  const failures: string[] = [];
  const initialUrl = page.url();
  const buttons = await collectVisibleButtons(page);

  expect(buttons.length, `${route} should expose visible controls`).toBeGreaterThan(0);
  for (const button of buttons) {
    expect(button.label, `${route} button ${button.index} should have an accessible label`).toBeTruthy();
    if (button.disabled || button.navigation || AUTH_OR_EXTERNAL_BUTTON.test(button.label)) continue;

    const safeToClick = ALWAYS_SAFE_BUTTON.test(button.label);
    const mustBeWalletGuarded = MUTATING_APP_BUTTON.test(button.label);
    if (!safeToClick && !mustBeWalletGuarded) continue;

    const beforeFailures = failures.length;
    await clickIndexedVisibleButton(page, button.index).catch((error: unknown) => {
      failures.push(`${button.label}: ${error instanceof Error ? error.message : String(error)}`);
    });
    await page.waitForTimeout(150);
    await expectHealthy(page, route).catch((error: unknown) => {
      failures.push(`${button.label}: unhealthy after click: ${error instanceof Error ? error.message : String(error)}`);
    });
    if (mustBeWalletGuarded) {
      expect(failures.slice(beforeFailures), `${route} ${button.label} should be guarded before wallet signing`).toEqual([]);
    }
    await closeTransientUi(page);
    if (page.url() !== initialUrl) {
      await gotoHealthy(page, route);
    }
  }

  expect(failures, `${route} safe and guarded buttons should not break the page`).toEqual([]);
}

test.describe("Mainnet frontend safety surface", () => {
  test("mainnet catalog and public services are healthy", async ({ page, request }) => {
    const requestFailures: string[] = [];
    await captureUnsafeFrontendRequests(page, requestFailures);

    await gotoHealthy(page, "/miniapps");
    const response = await request.get("/api/miniapps/catalog?network=mainnet");
    expect(response.ok(), "mainnet catalog API should be healthy").toBeTruthy();
    const catalog = (await response.json()) as { apps?: CatalogApp[] };
    const apps = catalog.apps || [];
    const expectedMainnetIds = mainnetVisibleAppIds;
    expect(apps.length, "mainnet catalog should expose every mainnet-visible miniapp").toBe(expectedMainnetIds.length);

    const ids = new Set(apps.map((app) => app.app_id));
    for (const expectedId of expectedMainnetIds) {
      expect(ids.has(expectedId), `${expectedId} should be visible in the mainnet catalog`).toBe(true);
    }
    for (const testnetOnlyId of readTestnetOnlyAppIds()) {
      expect(ids.has(testnetOnlyId), `${testnetOnlyId} should stay out of the mainnet catalog`).toBe(false);
    }
    expect(ids.has("miniapp-flamingo")).toBe(false);
    expect(ids.has("miniapp-flaminggo")).toBe(false);
    expect(ids.has("miniapp-neoburger")).toBe(false);
    expect(ids.has("miniapp-neo-burger")).toBe(false);

    for (const endpoint of [
      "/api/health",
      "/api/chain/health?network=mainnet",
      "/api/explorer/stats",
      "/api/morpheus/neodid/providers?network=mainnet",
      "/api/morpheus/oracle/public-key?network=mainnet",
    ]) {
      const service = await request.get(endpoint, { timeout: 20_000 });
      expect(service.status(), `${endpoint} should not return a server error`).toBeLessThan(500);
    }

    expect(requestFailures, "catalog and service checks should not emit mutating requests").toEqual([]);
  });

  test("mainnet wallet modal exposes NEP-21 and OneGate without submitting data", async ({ page }) => {
    const requestFailures: string[] = [];
    await captureUnsafeFrontendRequests(page, requestFailures);

    await gotoHealthy(page, "/miniapps");
    await page.getByRole("button", { name: /log in \/ sign up/i }).click();
    await expect(page.getByRole("heading", { name: "Welcome to R3E" })).toBeVisible({ timeout: 10_000 });

    const labels = await page.locator("button").evaluateAll((buttons) =>
      buttons.map((button) => (
        button.getAttribute("aria-label") ||
        button.getAttribute("title") ||
        button.textContent ||
        ""
      ).replace(/\s+/g, " ").trim()),
    );
    for (const wallet of ["NEP-21", "NeoLine", "O3", "OneGate"]) {
      expect(labels.some((label) => label.includes(wallet)), `${wallet} should be available in the wallet modal`).toBe(true);
    }
    expect(requestFailures, "opening the wallet modal should not submit data").toEqual([]);
  });

  for (const appId of mainnetVisibleAppIds) {
    test(`mainnet miniapp ${appId} renders native layout and guarded controls`, async ({ page }) => {
      const route = `/miniapps/${appId}`;
      const requestFailures: string[] = [];
      await captureUnsafeFrontendRequests(page, requestFailures);

      await gotoHealthy(page, route);
      await expect(page.getByTestId("miniapp-detail-layout"), `${appId} should use the unified detail layout`).toBeVisible();
      await expect(page.getByTestId("miniapp-list-rail"), `${appId} should show the shared left rail`).toBeVisible();
      await expect(page.getByTestId("miniapp-playarea"), `${appId} should show a native playarea`).toBeVisible();
      await expect(page.getByTestId("miniapp-info"), `${appId} should show shared app info`).toBeVisible();
      await expect(page.getByTestId("miniapp-actions"), `${appId} should show the operation panel`).toBeVisible();
      await expect(page.getByTestId("miniapp-actions"), `${appId} operation panel should identify the app`).toContainText(appId);
      if (mainnetContractAppIds.has(appId)) {
        await expect(page.getByTestId("miniapp-actions"), `${appId} mainnet contract app should not be disabled by stale runtime metadata`).not.toContainText(/not configured for this network|runtime not deployed/i);
      }
      await expect(page.getByTestId("miniapp-list-rail").locator(`a[href="/miniapps/${appId}"]`)).toHaveCount(1);
      await assertImagesLoaded(page, route);
      await exerciseButtonsWithoutWallet(page, route);
      expect(requestFailures, `${appId} should not emit mutating frontend requests before wallet signing`).toEqual([]);
    });
  }
});

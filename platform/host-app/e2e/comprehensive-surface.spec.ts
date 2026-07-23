import * as fs from "node:fs";
import * as path from "node:path";
import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { isReadOnlyPostRequest } from "./read-only-request";

type MiniAppManifest = {
  id?: string;
  name?: string;
};

type CatalogResponse = {
  apps?: Array<{
    app_id?: string;
  }>;
};

type ButtonSnapshot = {
  index: number;
  label: string;
  disabled: boolean;
  navigation: boolean;
};

const repoRoot = path.resolve(__dirname, "../../..");
const appsDir = path.join(repoRoot, "apps");

const PLATFORM_ROUTES = [
  "/",
  "/home",
  "/miniapps",
  "/docs",
  "/developer",
  "/explorer",
  "/leaderboard",
  "/account",
  "/analytics",
  "/stats",
  "/secrets",
  "/login",
  "/privacy",
  "/terms",
  "/test",
];

const SAFE_SURFACE_BUTTON =
  /^(notifications|switch language|search|close|dismiss|cancel|overview|reviews|forum|news|health|governance|membership|guardians|proof flow)$/i;

const MUTATING_OR_EXTERNAL_BUTTON =
  /\b(log in|sign up|continue with google|continue with github|continue with twitter|neoline|onegate|connect|disconnect|delete|remove|rollback|publish|deploy|upload|import|export|download|submit miniapp|send email|verify email|performance monitor|monitoring dashboard|open builder|go back|stake|swap|claim|create|verify|request|finalize|repay|withdraw|add collateral|sync|issue)\b/i;

const ARCHIVED_MINIAPP_IDS = new Set([
  "miniapp-neoburger",
  "miniapp-neo-burger",
  "miniapp-flamingo",
  "miniapp-flaminggo",
]);
const NON_STANDARD_MINIAPP_DETAIL_LAYOUT = new Set([
  // These miniapps intentionally render a specialized flow page rather than the
  // standard catalog/detail layout (rail + playarea + info + actions).
  "miniapp-gas-lucky-pool",
]);
const SURFACE_LOGS_ENABLED = process.env.SURFACE_LOGS === "1";
const EXPECTED_ACTIVE_MINIAPP_COUNT = 77;
const DEV_TIPPING_CONTRACT =
  "0x6fdcf2ff29bde658cdcd9fddd082fe1813dd21ec";
const PRIVATE_TRANSFER_ORACLE_CONTRACT =
  "0xf54d8584ef82315c1800373272ab08ae0db2d5ef";
const TEST_ORACLE_PUBLIC_KEY =
  "BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=";

function devTippingContractState() {
  const method = (
    name: string,
    parameters: string[],
    returntype: string,
    safe: boolean,
  ) => ({
    name,
    parameters: parameters.map((type, index) => ({
      name: `arg${index}`,
      type,
    })),
    returntype,
    safe,
  });
  const event = (name: string, parameters: string[]) => ({
    name,
    parameters: parameters.map((type, index) => ({
      name: `arg${index}`,
      type,
    })),
  });

  return {
    hash: DEV_TIPPING_CONTRACT,
    updatecounter: 0,
    nef: { checksum: 2_483_335_541 },
    manifest: {
      name: "MiniAppTipJar",
      abi: {
        methods: [
          method(
            "onNEP17Payment",
            ["Hash160", "Integer", "Any"],
            "Void",
            false,
          ),
          method(
            "registerDeveloper",
            ["Hash160", "String", "String"],
            "Integer",
            false,
          ),
          method(
            "tip",
            ["Hash160", "Integer", "Integer", "Boolean"],
            "Integer",
            false,
          ),
          method("withdrawTips", ["Integer"], "Integer", false),
          method("withdraw", ["Hash160"], "Integer", false),
          method("totalDevelopers", [], "Integer", true),
          method("totalDonated", [], "Integer", true),
          method("tipsCount", [], "Integer", true),
          method("minTip", [], "Integer", true),
          method("creditOf", ["Hash160"], "Integer", true),
          method("developerIdOf", ["Hash160"], "Integer", true),
          method("getDeveloper", ["Integer"], "Map", true),
        ],
        events: [
          event("Credited", ["Hash160", "Integer", "Integer"]),
          event("DeveloperRegistered", [
            "Integer",
            "Hash160",
            "String",
          ]),
          event("Tipped", [
            "Integer",
            "Integer",
            "Hash160",
            "Integer",
            "Boolean",
          ]),
          event("TipsWithdrawn", ["Integer", "Hash160", "Integer"]),
          event("CreditWithdrawn", ["Hash160", "Integer"]),
        ],
      },
    },
  };
}

function readMiniApps() {
  const apps: Array<{ id: string; name: string; slug: string }> = [];
  for (const entry of fs.readdirSync(appsDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "shared") continue;

    const manifestPath = path.join(appsDir, entry.name, "neo-manifest.json");
    if (!fs.existsSync(manifestPath)) continue;

    const manifest = JSON.parse(
      fs.readFileSync(manifestPath, "utf8"),
    ) as MiniAppManifest;
    const id = String(manifest.id || "").trim();
    if (!id) continue;
    if (ARCHIVED_MINIAPP_IDS.has(id)) continue;

    apps.push({
      id,
      name: String(manifest.name || id).trim(),
      slug: entry.name,
    });
  }

  return apps.sort((a, b) => a.id.localeCompare(b.id));
}

async function expectHealthyPage(page: Page, route: string) {
  await expect(
    page.locator("body"),
    `${route} body should render`,
  ).toBeVisible();
  await expect(
    page.locator("body"),
    `${route} should not show the Next.js runtime error shell`,
  ).not.toContainText("Runtime Error");
  await expect(
    page.locator("body"),
    `${route} should not show a generic app crash`,
  ).not.toContainText("Application error");
  await expect(
    page.locator("body"),
    `${route} should not expose an unhandled TypeError`,
  ).not.toContainText("TypeError:");

  const bodyTextLength = await page
    .locator("body")
    .innerText()
    .then((value) => value.trim().length);
  expect(
    bodyTextLength,
    `${route} should have visible content`,
  ).toBeGreaterThan(20);
}

async function expectNoHorizontalOverflow(page: Page, route: string) {
  const failures: string[] = [];
  for (const frame of page.frames()) {
    const metrics = await frame
      .evaluate(() => ({
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body?.scrollWidth ?? 0,
      }))
      .catch(() => null);
    if (!metrics || metrics.viewportWidth <= 0) continue;
    const contentWidth = Math.max(metrics.documentWidth, metrics.bodyWidth);
    const overflow = contentWidth - metrics.viewportWidth;
    if (overflow > 2) {
      failures.push(
        `${frame.url() || "about:blank"}: ${contentWidth}px content in ${metrics.viewportWidth}px viewport`,
      );
    }
  }
  expect(failures, `${route} should not overflow horizontally`).toEqual([]);
}

async function expectEmbeddedDappReady(page: Page, route: string) {
  const playArea = page.getByTestId("miniapp-playarea");
  const iframes = playArea.locator("iframe[data-wallet-bridge]");
  const count = await iframes.count();
  for (let index = 0; index < count; index += 1) {
    const iframe = iframes.nth(index);
    await expect(iframe).toHaveAttribute("src", /.+/);
    const sandbox = await iframe.getAttribute("sandbox");
    expect(sandbox, `${route} iframe should stay sandboxed`).toBeTruthy();
    expect(sandbox, `${route} iframe must keep an opaque origin`).not.toContain(
      "allow-same-origin",
    );

    const frameBody = iframe.contentFrame().locator("body");
    await expect(frameBody).toBeVisible({ timeout: 20_000 });
    const content = await frameBody.evaluate((body) => ({
      textLength: (body.textContent ?? "").trim().length,
      visualNodes: body.querySelectorAll("canvas, svg, img, video").length,
    }));
    expect(
      content.textLength + content.visualNodes,
      `${route} iframe should render meaningful content`,
    ).toBeGreaterThan(0);
    await expect(frameBody).not.toContainText("Runtime Error");
    await expect(frameBody).not.toContainText("Application error");
    await expect(frameBody).not.toContainText("TypeError:");
  }

  await expect(
    playArea.locator('[data-testid$="-load-error"]'),
    `${route} should not expose the embedded-app recovery shell`,
  ).toHaveCount(0);
}

async function disableMotion(page: Page) {
  await page
    .addStyleTag({
      content: `
      *, *::before, *::after {
        animation-duration: 0.001ms !important;
        animation-iteration-count: 1 !important;
        scroll-behavior: auto !important;
        transition-duration: 0.001ms !important;
      }
    `,
    })
    .catch(() => undefined);
}

async function stubVolatileApiFeeds(page: Page) {
  if (SURFACE_LOGS_ENABLED) {
    page.context().on("request", (request) => {
      if (request.method().toUpperCase() !== "GET") {
        console.log(
          `[surface] context request ${request.method().toUpperCase()} ${request.url()}`,
        );
      }
    });
  }
  await page.context().route("**/api/rpc/neo", async (route) => {
    let body: { method?: unknown; params?: unknown[] } = {};
    try {
      body = route.request().postDataJSON() as typeof body;
    } catch {
      await route.continue();
      return;
    }
    const params = Array.isArray(body.params) ? body.params : [];
    const contract = String(params[0] || "").toLowerCase();
    const operation = String(params[1] || "");
    if (SURFACE_LOGS_ENABLED && contract === DEV_TIPPING_CONTRACT) {
      console.log(`[surface] Tip Jar bridge read ${operation || "<missing>"}`);
    }
    if (
      body.method !== "invokefunction" ||
      contract !== DEV_TIPPING_CONTRACT
    ) {
      await route.continue();
      return;
    }
    const value =
      operation === "minTip"
        ? "100000"
        : ["totalDevelopers", "totalDonated", "tipsCount"].includes(operation)
          ? "0"
          : null;
    if (value === null) {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        result: {
          state: "HALT",
          gasconsumed: "0",
          stack: [{ type: "Integer", value }],
        },
      }),
    });
  });
  await page.context().route("https://api.n3index.dev/testnet", async (route) => {
    let body: { method?: unknown; params?: unknown[] } = {};
    try {
      body = route.request().postDataJSON() as typeof body;
    } catch {
      await route.continue();
      return;
    }
    const contract = String(body.params?.[0] || "").toLowerCase();
    if (SURFACE_LOGS_ENABLED) {
      console.log(
        `[surface] external RPC ${String(body.method || "<missing>")} ${contract || "<missing>"}`,
      );
    }
    if (
      body.method !== "getcontractstate" ||
      contract !== DEV_TIPPING_CONTRACT
    ) {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        result: devTippingContractState(),
      }),
    });
  });
  await page.route("**/api/morpheus/oracle/public-key?network=testnet", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        network: "testnet",
        source: "neo_n3_contract",
        contract: PRIVATE_TRANSFER_ORACLE_CONTRACT,
        rpc_url: "https://api.n3index.dev/testnet",
        algorithm: "X25519-HKDF-SHA256-AES-256-GCM",
        public_key: TEST_ORACLE_PUBLIC_KEY,
        public_key_format: "raw",
      }),
    }),
  );
  await page.route("**/api/activity/events**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ events: [], total: 0 }),
    }),
  );
  await page.route("**/api/activity/transactions**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ transactions: [], total: 0 }),
    }),
  );
  await page.route("**/api/app/*/news**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [], total: 0 }),
    }),
  );
  await page.route("**/api/miniapps/*/forum/threads**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ threads: [], hasMore: false, total: 0 }),
    }),
  );
}

function isConnectionRefused(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("ECONNREFUSED") ||
    message.includes("ERR_CONNECTION_REFUSED") ||
    message.includes("net::ERR_CONNECTION_REFUSED")
  );
}

async function withConnectionRetry<T>(
  label: string,
  task: () => Promise<T>,
  { attempts = 4, backoffMs = 750 }: { attempts?: number; backoffMs?: number } = {},
) {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (!isConnectionRefused(error) || attempt === attempts - 1) {
        throw error;
      }
      const delayMs = backoffMs * (attempt + 1);
      if (SURFACE_LOGS_ENABLED) {
        console.log(`[surface] ${label} connection refused; retrying in ${delayMs}ms...`);
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function gotoHealthy(page: Page, route: string) {
  if (SURFACE_LOGS_ENABLED) console.log(`[surface] goto ${route}`);
  const response = await withConnectionRetry(
    `goto:${route}`,
    () => page.goto(route, { waitUntil: "domcontentloaded" }),
    { attempts: 5, backoffMs: 600 },
  );
  await disableMotion(page);
  expect(
    response?.status(),
    `${route} should return a non-error response`,
  ).toBeLessThan(400);
  await page
    .waitForLoadState("networkidle", { timeout: 5_000 })
    .catch(() => undefined);
  await expectHealthyPage(page, route);
}

async function collectInternalLinks(page: Page) {
  return page.locator("a[href]").evaluateAll((links) => {
    const origin = window.location.origin;
    return Array.from(
      new Set(
        links
          .map((link) => link.getAttribute("href") || "")
          .map((href) => {
            try {
              return new URL(href, window.location.href);
            } catch {
              return null;
            }
          })
          .filter((url): url is URL => Boolean(url))
          .filter((url) => url.origin === origin)
          .filter(
            (url) => url.pathname !== window.location.pathname || url.search,
          )
          .filter((url) => !url.pathname.startsWith("/api/auth/"))
          .filter((url) => !url.pathname.startsWith("/api/"))
          .map((url) => `${url.pathname}${url.search}`),
      ),
    ).sort();
  });
}

async function expectInternalLinksResolve(
  request: APIRequestContext,
  route: string,
  links: string[],
) {
  const failures: string[] = [];
  for (const href of links) {
    let lastStatus = 0;

    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        const response = await withConnectionRetry(
          `request:${href}`,
          () => request.get(href, { timeout: 15_000 }),
          { attempts: 4, backoffMs: 500 },
        );
        lastStatus = response.status();
      } catch (error) {
        if (isConnectionRefused(error)) {
          lastStatus = 0;
          continue;
        }
        throw error;
      }

      if (lastStatus < 500) {
        break;
      }
    }

    if (lastStatus >= 400 && lastStatus !== 401 && lastStatus !== 403) {
      failures.push(`${href} -> ${lastStatus}`);
    }
  }
  expect(failures, `${route} internal links should resolve`).toEqual([]);
}

async function collectButtons(page: Page): Promise<ButtonSnapshot[]> {
  return page.evaluate(() => {
    const isVisible = (element: Element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity || "1") > 0 &&
        rect.width > 0 &&
        rect.height > 0
      );
    };

    return Array.from(document.querySelectorAll("button"))
      .filter(isVisible)
      .map((button, index) => {
        const anchor = button.closest("a[href]");
        const href = anchor?.getAttribute("href") || "";
        const navigation = Boolean(href);
        const label =
          button.getAttribute("aria-label") ||
          button.getAttribute("title") ||
          button.textContent ||
          "";
        return {
          index,
          label: label.replace(/\s+/g, " ").trim() || `button-${index}`,
          disabled:
            button.hasAttribute("disabled") ||
            button.getAttribute("aria-disabled") === "true",
          navigation,
        };
      });
  });
}

async function populateVisibleInputs(page: Page) {
  await page.evaluate(() => {
    const isVisible = (element: Element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        rect.width > 0 &&
        rect.height > 0
      );
    };

    for (const input of Array.from(
      document.querySelectorAll("input, textarea"),
    )) {
      if (
        !(
          input instanceof HTMLInputElement ||
          input instanceof HTMLTextAreaElement
        )
      )
        continue;
      if (!isVisible(input) || input.disabled || input.readOnly) continue;

      input.value =
        input instanceof HTMLInputElement && input.type === "number"
          ? "1"
          : "test";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
}

async function closeAnyDialog(page: Page) {
  const closeButton = page
    .getByRole("button", { name: /close|dismiss|cancel/i })
    .first();
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click().catch(() => undefined);
  }
  await page.keyboard.press("Escape").catch(() => undefined);
}

async function exerciseTabs(page: Page, route: string) {
  const tabs = await page.getByRole("tab").all();
  for (const tab of tabs) {
    if (!(await tab.isVisible().catch(() => false))) continue;
    await tab.click();
    await expectHealthyPage(page, route);
  }
}

async function exerciseVisibleButtons(page: Page, route: string) {
  await populateVisibleInputs(page);

  const buttons = (await collectButtons(page)).filter(
    (button) =>
      !button.disabled &&
      !button.navigation &&
      SAFE_SURFACE_BUTTON.test(button.label) &&
      !MUTATING_OR_EXTERNAL_BUTTON.test(button.label),
  );
  const failures: string[] = [];

  for (const button of buttons) {
    if (SURFACE_LOGS_ENABLED) console.log(`[surface] click ${route} :: ${button.label}`);
    await populateVisibleInputs(page);
    const clicked = await page
      .evaluate((buttonIndex) => {
        const isVisible = (element: Element) => {
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            Number(style.opacity || "1") > 0 &&
            rect.width > 0 &&
            rect.height > 0
          );
        };
        const buttons = Array.from(document.querySelectorAll("button")).filter(
          isVisible,
        );
        const button = buttons[buttonIndex];
        if (
          !(button instanceof HTMLButtonElement) ||
          button.disabled ||
          button.getAttribute("aria-disabled") === "true"
        ) {
          return false;
        }
        button.click();
        return true;
      }, button.index)
      .catch((error: unknown) => {
        failures.push(
          `${button.label}: ${error instanceof Error ? error.message : String(error)}`,
        );
        return false;
      });
    if (!clicked) continue;
    await page.waitForTimeout(150);
    await closeAnyDialog(page);
    await expectHealthyPage(page, route).catch((error: unknown) => {
      failures.push(
        `${button.label}: page became unhealthy: ${error instanceof Error ? error.message : String(error)}`,
      );
    });

    const currentUrl = new URL(page.url());
    if (`${currentUrl.pathname}${currentUrl.search}` !== route) {
      await gotoHealthy(page, route);
      await populateVisibleInputs(page);
    }
  }

  expect(failures, `${route} safe buttons should be clickable`).toEqual([]);
}

async function assertImagesLoad(page: Page, route: string) {
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
  await page.waitForFunction(
    () =>
      Array.from(document.querySelectorAll("img")).every((image) => {
        const hasSource = Boolean(image.currentSrc || image.getAttribute("src"));
        return !hasSource || (image.complete && image.naturalWidth > 0);
      }),
    undefined,
    { timeout: 5_000 },
  ).catch(() => undefined);
  // Avoid calling `HTMLImageElement.decode()` here: some SVG/remote assets can
  // keep decode Promises pending long enough to trip the Playwright test timeout.
  // Broken images are asserted via naturalWidth below instead.
  await page.waitForTimeout(250);
  const brokenImages = await page.evaluate(async () => {
    const images = Array.from(document.querySelectorAll("img"));
    const candidates = images.filter((image) => {
      const hasSource = Boolean(image.currentSrc || image.getAttribute("src"));
      if (!hasSource || !image.complete) return false;
      // NOTE: naturalWidth/naturalHeight can be reported as 0 for valid SVGs that only
      // specify a viewBox (no explicit width/height). Treat SVGs as broken only when
      // the network request itself fails.
      return image.naturalWidth === 0;
    });

    const uniqueSrcs = Array.from(
      new Set(
        candidates
          .map((image) => image.currentSrc || image.getAttribute("src") || "")
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    );

    const failures: string[] = [];
    for (const src of uniqueSrcs) {
      try {
        const url = new URL(src, window.location.href);
        // For SVGs, validate via a lightweight fetch rather than naturalWidth.
        if (url.pathname.toLowerCase().endsWith(".svg")) {
          const response = await fetch(url.toString(), { method: "HEAD" });
          if (!response.ok) failures.push(`${url.toString()} -> ${response.status}`);
          continue;
        }
      } catch {
        // Ignore URL parse errors; they will be reported below as-is.
      }

      // Non-SVG: keep the original naturalWidth heuristic.
      failures.push(src);
    }

    return failures;
  });
  expect(brokenImages, `${route} should not render broken images`).toEqual([]);
}

async function expectFocusModeDetailLayout(page: Page, appId: string) {
  const layout = page.getByTestId("miniapp-detail-layout");
  const playArea = page.getByTestId("miniapp-playarea");
  const actionRail = page.getByTestId("miniapp-actions");
  const mobileActionDock = page.getByTestId("mobile-action-dock");

  await expect(layout).toBeVisible();
  await expect(playArea).toBeVisible();
  await expect(page.getByTestId("miniapp-list-rail")).toHaveCount(0);

  const actionRailState = await layout.getAttribute("data-action-rail");
  expect(
    actionRailState,
    `${appId} should declare whether its focus action rail is available`,
  ).toMatch(/^(visible|hidden)$/);
  const hasActionRail = actionRailState === "visible";
  await expect(layout).toHaveJSProperty(
    "children.length",
    hasActionRail ? 2 : 1,
  );

  const desktop = (page.viewportSize()?.width ?? 0) >= 1280;
  if (hasActionRail) {
    if (desktop) {
      await expect(actionRail).toBeVisible();
      await expect(mobileActionDock).toBeHidden();
    } else {
      await expect(actionRail).toBeHidden();
      await expect(mobileActionDock).toBeVisible();
    }
  } else {
    await expect(actionRail).toHaveCount(0);
    await expect(mobileActionDock).toHaveCount(0);
  }

  const referenceSummary = page
    .locator("summary")
    .filter({ hasText: "Reference and diagnostics" });
  await expect(referenceSummary).toBeVisible();
  await referenceSummary.click();
  await expect(page.getByTestId("miniapp-info")).toBeVisible();
}

function attachErrorCapture(page: Page, failures: string[]) {
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") {
      const location = message.location();
      if (
        location.url &&
        !location.url.startsWith("http://127.0.0.1:3004") &&
        /net::ERR_(TIMED_OUT|NAME_NOT_RESOLVED|CONNECTION_RESET|CONNECTION_REFUSED)/i.test(
          message.text(),
        )
      ) {
        return;
      }
      failures.push(
        `console error: ${message.text()}${location.url ? ` @ ${location.url}` : ""}`,
      );
    }
  });
  page.on("request", (request) => {
    const method = request.method().toUpperCase();
    if (SURFACE_LOGS_ENABLED && method !== "GET") {
      console.log(`[surface] request ${method} ${request.url()}`);
    }
    if (["GET", "HEAD", "OPTIONS"].includes(method)) return;

    try {
      const currentUrl = new URL(page.url());
      const requestUrl = new URL(request.url());
      if (requestUrl.origin === currentUrl.origin) {
        if (!isReadOnlyPostRequest(request)) {
          failures.push(`mutating request ${method}: ${requestUrl.pathname}`);
        }
      }
    } catch {
      // Ignore requests emitted before the page has a navigable URL.
    }
  });
  page.on("response", (response) => {
    const status = response.status();
    if (status < 400) return;
    const url = new URL(response.url());
    if (url.origin !== new URL(page.url()).origin) return;
    failures.push(`response ${status}: ${url.pathname}${url.search}`);
  });
}

test.setTimeout(180_000);

const manifestBackedMiniApps = readMiniApps();

test.describe("Comprehensive frontend surface", () => {
  test("repo and catalog API expose the exact active manifest-backed miniapp set", async ({
    request,
  }) => {
    expect(manifestBackedMiniApps.length).toBe(EXPECTED_ACTIVE_MINIAPP_COUNT);
    const manifestIds = manifestBackedMiniApps.map((app) => app.id).sort();
    expect(new Set(manifestIds).size).toBe(EXPECTED_ACTIVE_MINIAPP_COUNT);

    const response = await request.get("/api/miniapps/catalog?scope=all");
    expect(response.ok()).toBe(true);
    const catalog = (await response.json()) as CatalogResponse;
    const catalogIds = (catalog.apps ?? [])
      .map((app) => String(app.app_id ?? "").trim())
      .filter(Boolean)
      .sort();
    expect(catalogIds).toEqual(manifestIds);
  });

  for (const route of PLATFORM_ROUTES) {
    test(`platform route ${route} loads, links resolve, and safe controls work`, async ({
      page,
      request,
    }) => {
      const runtimeFailures: string[] = [];
      await stubVolatileApiFeeds(page);
      attachErrorCapture(page, runtimeFailures);

      await gotoHealthy(page, route);
      await exerciseTabs(page, route);
      await assertImagesLoad(page, route);
      await expectNoHorizontalOverflow(page, route);
      await expectInternalLinksResolve(
        request,
        route,
        await collectInternalLinks(page),
      );
      await exerciseVisibleButtons(page, route);

      expect(
        runtimeFailures,
        `${route} should not emit browser runtime errors`,
      ).toEqual([]);
    });
  }

  for (const app of manifestBackedMiniApps) {
    test(`miniapp ${app.id} loads, links resolve, and safe controls work`, async ({
      page,
      request,
    }) => {
      const runtimeFailures: string[] = [];
      await stubVolatileApiFeeds(page);
      attachErrorCapture(page, runtimeFailures);

      const route = `/miniapps/${app.id}`;
      await gotoHealthy(page, route);
      if (!NON_STANDARD_MINIAPP_DETAIL_LAYOUT.has(app.id)) {
        await expectFocusModeDetailLayout(page, app.id);
      }
      await expect(
        page.locator("body"),
        `${app.id} should render its display name`,
      ).toContainText(app.name);
      await expectEmbeddedDappReady(page, route);
      await exerciseTabs(page, route);
      await assertImagesLoad(page, route);
      await expectNoHorizontalOverflow(page, route);
      await expectInternalLinksResolve(
        request,
        route,
        await collectInternalLinks(page),
      );
      await exerciseVisibleButtons(page, route);

      expect(
        runtimeFailures,
        `${app.id} should not emit browser runtime errors`,
      ).toEqual([]);
    });
  }
});

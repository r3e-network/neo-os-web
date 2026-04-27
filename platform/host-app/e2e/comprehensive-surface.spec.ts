import * as fs from "node:fs";
import * as path from "node:path";
import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

type MiniAppManifest = {
  id?: string;
  name?: string;
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
  "/federated",
  "/secrets",
  "/login",
  "/privacy",
  "/terms",
  "/test",
];

const SAFE_SURFACE_BUTTON =
  /^(notifications|switch language|search|close|dismiss|cancel|overview|reviews|forum|news|health|governance|membership|guardians|proof flow)$/i;

const MUTATING_OR_EXTERNAL_BUTTON =
  /\b(log in|sign up|continue with google|continue with github|continue with twitter|neoline|onegate|o3|connect|disconnect|delete|remove|rollback|publish|deploy|upload|import|export|download|submit miniapp|send email|verify email|performance monitor|monitoring dashboard|open builder|go back|stake|swap|claim|create|verify|request|finalize|repay|withdraw|add collateral|sync|issue)\b/i;

const READ_ONLY_POST_ENDPOINTS = new Set(["/api/rpc/neo-read"]);

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

async function gotoHealthy(page: Page, route: string) {
  console.log(`[surface] goto ${route}`);
  const response = await page.goto(route, { waitUntil: "domcontentloaded" });
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

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await request.get(href, { timeout: 15_000 });
      lastStatus = response.status();

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
    console.log(`[surface] click ${route} :: ${button.label}`);
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
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(250);
  const brokenImages = await page.evaluate(() =>
    Array.from(document.querySelectorAll("img"))
      .filter((image) => image.complete && image.naturalWidth === 0)
      .map(
        (image) =>
          image.getAttribute("src") ||
          image.getAttribute("alt") ||
          "unknown image",
      ),
  );
  expect(brokenImages, `${route} should not render broken images`).toEqual([]);
}

function attachErrorCapture(page: Page, failures: string[]) {
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") {
      const location = message.location();
      failures.push(
        `console error: ${message.text()}${location.url ? ` @ ${location.url}` : ""}`,
      );
    }
  });
  page.on("request", (request) => {
    const method = request.method().toUpperCase();
    if (["GET", "HEAD", "OPTIONS"].includes(method)) return;

    try {
      const currentUrl = new URL(page.url());
      const requestUrl = new URL(request.url());
      if (requestUrl.origin === currentUrl.origin) {
        const isReadOnlyPost = method === "POST" && READ_ONLY_POST_ENDPOINTS.has(requestUrl.pathname);
        if (!isReadOnlyPost) {
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
  test("repo exposes the expected manifest-backed miniapp catalog", () => {
    expect(
      manifestBackedMiniApps.length,
      "repo should expose all manifest-backed miniapps",
    ).toBeGreaterThanOrEqual(49);
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
      await expect(
        page.locator("body"),
        `${app.id} should render its display name`,
      ).toContainText(app.name);
      await exerciseTabs(page, route);
      await assertImagesLoad(page, route);
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

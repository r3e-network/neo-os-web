import { test, expect, type Page } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

type MiniAppManifest = {
  id?: string;
  name?: string;
  supported_networks?: string[];
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
  "/privacy",
  "/terms",
  "/test",
];

const FLAGSHIP_MINIAPP_IDS = new Set([
  "miniapp-self-loan",
  "miniapp-redenvelope",
  "miniapp-fogplay",
  "miniapp-dailycheckin",
  "miniapp-last-survivor",
  "miniapp-neo-pay",
  "miniapp-gasbox",
]);

const OPERATOR_TOOL_IDS = new Set([
  "miniapp-aa-account-lab",
  "miniapp-aa-permissions-lab",
  "miniapp-aa-market-hub",
  "miniapp-aa-relay-console",
  "miniapp-aa-session-key-lab",
  "miniapp-oracle-price-console",
  "miniapp-oracle-vrf-console",
]);

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, "");
}

function safeFileName(input: string) {
  return input.replace(/[^a-z0-9_-]+/gi, "_").replace(/^_+|_+$/g, "");
}

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
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
  { attempts = 6, backoffMs = 550 }: { attempts?: number; backoffMs?: number } = {},
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
      // eslint-disable-next-line no-console
      console.warn(`[screenshots] ${label} connection refused; retrying in ${delayMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function readTestnetMiniApps() {
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

    const supportedNetworks = Array.isArray(manifest.supported_networks)
      ? manifest.supported_networks
      : [];
    if (!supportedNetworks.includes("neo-n3-testnet")) continue;

    apps.push({
      id,
      name: String(manifest.name || id).trim(),
      slug: entry.name,
    });
  }

  return apps.sort((a, b) => a.id.localeCompare(b.id));
}

async function gotoReady(page: Page, route: string) {
  await withConnectionRetry(
    `goto:${route}`,
    () => page.goto(route, { waitUntil: "domcontentloaded", timeout: 60_000 }),
  );
  await expect(page.locator("body"), `${route} body should render`).toBeVisible();
  await expect(page.locator("body"), `${route} should not show Runtime Error`).not.toContainText(
    "Runtime Error",
  );
  await expect(page.locator("body"), `${route} should not show Application error`).not.toContainText(
    "Application error",
  );
}

async function captureViewport(
  page: Page,
  args: { route: string; outputPath: string; viewport: { width: number; height: number } },
) {
  await page.setViewportSize(args.viewport);
  await gotoReady(page, args.route);
  await page.waitForTimeout(250);
  await page.screenshot({ path: args.outputPath, fullPage: true });
}

test.describe("UI screenshots (host-app)", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(15 * 60_000);

  test("captures platform and miniapp screenshots (desktop + mobile)", async ({ page }, testInfo) => {
    const baseDir =
      process.env.SCREENSHOT_DIR ||
      path.join(testInfo.outputDir, "screenshots", `host-app-${nowStamp()}`);
    ensureDir(baseDir);
    const mobileMode = String(process.env.SCREENSHOT_MOBILE_MODE || "all").toLowerCase();
    const miniappMode = String(process.env.SCREENSHOT_MINIAPP_MODE || "all").toLowerCase();
    const explicitMiniappTargets = new Set(
      String(process.env.SCREENSHOT_MINIAPP_TARGETS || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    );

    const index: Array<{
      kind: "platform" | "miniapp";
      id: string;
      route: string;
      desktop: string;
      mobile: string;
      ts: string;
    }> = [];

    for (const route of PLATFORM_ROUTES) {
      const stem = safeFileName(route === "/" ? "root" : route.slice(1));
      const desktop = path.join(baseDir, `platform__${stem}__desktop.png`);
      const mobile = path.join(baseDir, `platform__${stem}__mobile.png`);

      await captureViewport(page, {
        route,
        outputPath: desktop,
        viewport: { width: 1365, height: 768 },
      });
      await captureViewport(page, {
        route,
        outputPath: mobile,
        viewport: { width: 390, height: 844 },
      });

      index.push({
        kind: "platform",
        id: stem,
        route,
        desktop: path.relative(baseDir, desktop),
        mobile: path.relative(baseDir, mobile),
        ts: new Date().toISOString(),
      });
    }

    const miniapps = readTestnetMiniApps().filter((miniapp) => {
      if (explicitMiniappTargets.size > 0) return explicitMiniappTargets.has(miniapp.id);
      if (miniappMode === "flagship") return FLAGSHIP_MINIAPP_IDS.has(miniapp.id);
      if (miniappMode === "flagship+tools") {
        return FLAGSHIP_MINIAPP_IDS.has(miniapp.id) || OPERATOR_TOOL_IDS.has(miniapp.id);
      }
      return true;
    });
    for (const miniapp of miniapps) {
      const route = `/miniapps/${miniapp.id}`;
      const stem = safeFileName(miniapp.id);
      const desktop = path.join(baseDir, `miniapp__${stem}__desktop.png`);
      const mobile = path.join(baseDir, `miniapp__${stem}__mobile.png`);

      await captureViewport(page, {
        route,
        outputPath: desktop,
        viewport: { width: 1365, height: 768 },
      });
      await page.waitForTimeout(150);

      const shouldCaptureMobile =
        mobileMode === "all" ||
        FLAGSHIP_MINIAPP_IDS.has(miniapp.id) ||
        OPERATOR_TOOL_IDS.has(miniapp.id);
      if (shouldCaptureMobile) {
        await captureViewport(page, {
          route,
          outputPath: mobile,
          viewport: { width: 390, height: 844 },
        });
      }

      index.push({
        kind: "miniapp",
        id: miniapp.id,
        route,
        desktop: path.relative(baseDir, desktop),
        mobile: path.relative(baseDir, mobile),
        ts: new Date().toISOString(),
      });
    }

    fs.writeFileSync(path.join(baseDir, "index.json"), JSON.stringify(index, null, 2));
  });
});

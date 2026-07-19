#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const catalogPath = path.join(
  repoRoot,
  "platform",
  "host-app",
  "public",
  "miniapps",
  "catalog.json",
);
const onegateCatalogPath = path.join(
  repoRoot,
  "platform",
  "host-app",
  "public",
  "miniapps",
  "onegate-catalog.json",
);

const DEFAULT_BASE_URL = "https://neomini.app";
const MOCK_ADDRESS = "NWMjW2tnPKSuSdHme5uYk86vFm8hyoHeJ3";
const MOCK_HASH = "0x1111111111111111111111111111111111111111";
const MOCK_TXID = `0x${"a".repeat(64)}`;
const MOCK_ORACLE_PUBLIC_KEY = "e+NHmFyX5PhEHPWNXbnB7GqaWc6dxEzwkHyT6oCa8gU=";
const MAINNET_MAGIC = 860833102;
const TESTNET_MAGIC = 894710606;

const CONNECT_TEXT_RE =
  /\b(connect|wallet|login|sign in)\b|连接|钱包|登录|登入|ウォレット|接続/i;
const DISCONNECT_TEXT_RE = /\bdisconnect|logout|log out\b|断开|退出/i;
const CRITICAL_RESOURCE_TYPES = new Set([
  "document",
  "script",
  "stylesheet",
  "image",
  "font",
]);

function parseArgs(argv) {
  const options = {
    baseUrl: DEFAULT_BASE_URL,
    network: "testnet",
    timeoutMs: 12_000,
    settleMs: 2_000,
    limit: 0,
    only: new Set(),
    headed: false,
    skipConnect: false,
    failOnWarning: false,
    mockPlatformApis: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`${arg} requires a value`);
      return argv[index];
    };
    if (arg === "--base-url") options.baseUrl = next();
    else if (arg === "--network") options.network = next();
    else if (arg === "--timeout-ms") options.timeoutMs = Number(next());
    else if (arg === "--settle-ms") options.settleMs = Number(next());
    else if (arg === "--limit") options.limit = Number(next());
    else if (arg === "--only") {
      for (const value of next().split(",")) {
        const trimmed = value.trim();
        if (trimmed) options.only.add(trimmed);
      }
    } else if (arg === "--headed") options.headed = true;
    else if (arg === "--skip-connect") options.skipConnect = true;
    else if (arg === "--fail-on-warning") options.failOnWarning = true;
    else if (arg === "--mock-platform-apis") options.mockPlatformApis = true;
    else if (arg === "--no-mock-platform-apis")
      options.mockPlatformApis = false;
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new Error("--timeout-ms must be a positive number");
  }
  if (!Number.isFinite(options.settleMs) || options.settleMs < 0) {
    throw new Error("--settle-ms must be a non-negative number");
  }
  if (!Number.isFinite(options.limit) || options.limit < 0) {
    throw new Error("--limit must be a non-negative number");
  }
  options.baseUrl = normalizeBaseUrl(options.baseUrl);
  options.mockPlatformApis ??= isLocalBaseUrl(options.baseUrl);
  return options;
}

function printHelp() {
  console.log(`Usage: node scripts/verify-onegate-miniapp-loads.mjs [options]

Validates standalone miniapp URLs in a mocked OneGate environment.

Options:
  --base-url <url>       Base URL to test (default: ${DEFAULT_BASE_URL})
  --network <network>    mainnet or testnet query param (default: testnet)
  --only <slugs>         Comma-separated slugs or app_ids to test
  --limit <n>            Test first n entries after filtering
  --skip-connect         Do not click a visible wallet/connect button
  --fail-on-warning      Treat console warnings as failures
  --mock-platform-apis   Mock local platform API endpoints during browser validation
  --no-mock-platform-apis Disable automatic platform API mocks for localhost
  --headed               Run Chromium headed
  --timeout-ms <ms>      Per-page navigation timeout (default: 12000)
  --settle-ms <ms>       Post-load settle wait (default: 2000)
`);
}

function isLocalBaseUrl(value) {
  const hostname = new URL(value).hostname;
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "::1"
  );
}

function normalizeBaseUrl(value) {
  const raw = String(value || DEFAULT_BASE_URL)
    .trim()
    .replace(/\/+$/, "");
  try {
    return new URL(raw).toString().replace(/\/+$/, "");
  } catch {
    throw new Error(`invalid --base-url: ${value}`);
  }
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function asString(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function safeName(raw) {
  const value = asString(raw);
  if (!value) return "";
  try {
    const parsed = JSON.parse(value);
    return asString(parsed.en || parsed.zh || parsed.ja || value);
  } catch {
    return value;
  }
}

function appendLaunchParams(entryUrl, entry, options) {
  const baseUrl = new URL(options.baseUrl);
  const url = new URL(entryUrl, `${baseUrl.origin}/`);
  url.protocol = baseUrl.protocol;
  url.host = baseUrl.host;
  url.searchParams.set("source", "onegate");
  url.searchParams.set("appId", entry.appId);
  url.searchParams.set("onegateAppId", String(entry.onegateId));
  url.searchParams.set("network", options.network);
  url.searchParams.set("mockOneGate", "1");
  return url.toString();
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function loadEntries(options) {
  const catalog = await readJson(catalogPath);
  const onegateCatalog = await readJson(onegateCatalogPath);
  const bySlugOrAppId = new Map();
  for (const app of asArray(catalog.apps)) {
    const slug = asString(app.slug);
    const appId = asString(app.app_id);
    if (!slug || !appId) continue;
    bySlugOrAppId.set(slug, app);
    bySlugOrAppId.set(appId, app);
  }

  let entries = asArray(onegateCatalog.dapps).map((dapp) => {
    const rawUrl = asString(dapp.url);
    const parsed = new URL(rawUrl);
    const slug =
      parsed.pathname.match(/^\/miniapps\/([^/]+)\/index\.html$/)?.[1] || "";
    const catalogApp = bySlugOrAppId.get(slug) || {};
    const appId = asString(catalogApp.app_id) || `miniapp-${slug}`;
    return {
      appId,
      slug,
      name: safeName(dapp.name) || asString(catalogApp.name) || appId,
      onegateId: dapp.id,
      url: appendLaunchParams(rawUrl, { appId, onegateId: dapp.id }, options),
    };
  });

  if (options.only.size > 0) {
    entries = entries.filter(
      (entry) => options.only.has(entry.slug) || options.only.has(entry.appId),
    );
  }
  if (options.limit > 0) entries = entries.slice(0, options.limit);
  return entries;
}

function installOneGateMock({
  network,
  mainnetMagic,
  testnetMagic,
  address,
  accountHash,
  txid,
}) {
  const magic = network === "mainnet" ? mainnetMagic : testnetMagic;
  const calls = [];
  const record = (method, payload) => {
    calls.push({
      method,
      payload,
      at: Date.now(),
    });
  };
  const account = {
    hash: accountHash,
    address,
    label: "OneGate Mock",
    isDefault: true,
  };
  const provider = {
    name: "OneGate Mock",
    dapiVersion: "1.0.0",
    version: "1.0.0",
    compatibility: ["NEP-21"],
    network: magic,
    supportedNetworks: [mainnetMagic, testnetMagic],
    getAccounts: async () => {
      record("getAccounts");
      return [account];
    },
    authenticate: async (payload) => {
      record("authenticate", payload);
      return {
        network: magic,
        address,
        nonce: String(payload?.nonce ?? payload?.Nonce ?? "mock"),
        pubkey: `03${"1".repeat(64)}`,
        signature: `0x${"b".repeat(128)}`,
      };
    },
    getBalance: async (asset, accountArg) => {
      record("getBalance", { asset, account: accountArg });
      return {
        asset,
        amount: "1000000000",
        balance: "10",
        decimals: 8,
        symbol: String(asset || "GAS").includes("cf76") ? "NEO" : "GAS",
      };
    },
    call: async (invocation) => {
      record("call", invocation);
      return {
        state: "HALT",
        gasconsumed: "0",
        exception: null,
        stack: [{ type: "Integer", value: "0" }],
      };
    },
    invoke: async (invocations, signers, suggestedSystemFee) => {
      record("invoke", { invocations, signers, suggestedSystemFee });
      return { txid, hash: txid };
    },
    send: async (asset, from, to, amount, data) => {
      record("send", { asset, from, to, amount, data });
      return { txid, hash: txid };
    },
    signMessage: async (message, accountArg) => {
      record("signMessage", { message, account: accountArg });
      return {
        account: accountArg || accountHash,
        message,
        pubkey: `03${"1".repeat(64)}`,
        signature: `0x${"c".repeat(128)}`,
        data: `0x${"c".repeat(128)}`,
      };
    },
  };

  Object.defineProperty(window, "__mockOneGateCalls", {
    configurable: true,
    value: calls,
  });
  window.NEP21Provider = provider;
  window.NEP21Providers = { OneGate: provider };
  window.OneGateDapiProvider = provider;
  window.Neo = { ...(window.Neo || {}), DapiProvider: provider };
  window.neoDapiProvider = provider;
  window.neoDapi = provider;
  window.__OneGateBridge = {
    invoke: async (raw) => {
      record("__OneGateBridge.invoke", raw);
      let request = raw;
      try {
        request = typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch {
        // Keep the raw payload recorded above.
      }
      const method = String(request?.method || "").toLowerCase();
      let result = null;
      if (method.includes("account")) result = [account];
      else if (method.includes("balance")) result = { GAS: "10", NEO: "10" };
      else if (method.includes("invoke") || method.includes("send")) {
        result = { txid, hash: txid };
      } else if (method.includes("sign")) {
        result = {
          signature: `0x${"d".repeat(128)}`,
          publicKey: `03${"1".repeat(64)}`,
        };
      } else if (method.includes("auth")) {
        result = {
          address,
          network: magic,
          signature: `0x${"e".repeat(128)}`,
        };
      }
      return { jsonrpc: "2.0", id: request?.id ?? 1, result };
    },
  };
  window.webkit = {
    ...(window.webkit || {}),
    messageHandlers: {
      ...(window.webkit?.messageHandlers || {}),
      OneGateBridge: {
        postMessage: (message) =>
          record("webkit.OneGateBridge.postMessage", message),
      },
    },
  };
  window.dispatchEvent(
    new CustomEvent("Neo.DapiProvider.ready", { detail: provider }),
  );
  window.dispatchEvent(
    new CustomEvent("OneGateDapiProvider.ready", { detail: provider }),
  );
  setTimeout(() => {
    window.dispatchEvent(
      new CustomEvent("Neo.DapiProvider.ready", { detail: provider }),
    );
    window.dispatchEvent(
      new CustomEvent("OneGateDapiProvider.ready", { detail: provider }),
    );
  }, 25);
}

function mockCouncilGovernanceResponse(network) {
  return {
    source: "onegate-validation-mock",
    network,
    candidates: [
      {
        id: "candidate-1",
        candidate:
          "020000000000000000000000000000000000000000000000000000000000000000",
        displayName: "Neo Council",
        logoUrl: "",
        rank: 1,
        status: "council",
        votes: 21_000_000,
      },
    ],
    proposals: [
      {
        id: "proposal-mock-1",
        number: 1,
        title: "Mock council upgrade",
        description:
          "Validation proposal supplied by the OneGate load harness.",
        status: "active",
        type: "policy",
        createdAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
        endTime: new Date("2026-01-08T00:00:00.000Z").toISOString(),
        proposerName: "Neo Council",
        councilVotes: { for: 9, against: 1, neutral: 1 },
        communityVotes: { for: 2, against: 0, neutral: 0 },
        messageCount: 0,
      },
    ],
  };
}

function edgeMockData(endpoint) {
  if (endpoint.endsWith("-get") || endpoint.endsWith("-read-shared"))
    return null;
  if (endpoint.endsWith("-list")) return {};
  if (endpoint.endsWith("-set"))
    return { stored: true, txid: MOCK_TXID, state: "mocked" };
  if (endpoint.endsWith("-delete"))
    return { deleted: true, txid: MOCK_TXID, state: "mocked" };
  return { txid: MOCK_TXID, state: "mocked" };
}

async function installPlatformApiMocks(context, options) {
  if (!options.mockPlatformApis) return;
  await context.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const json = (body, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
        body: JSON.stringify(body),
      });

    if (url.pathname.startsWith("/api/edge/")) {
      const endpoint = decodeURIComponent(url.pathname.split("/").pop() || "");
      return json({
        ok: true,
        data: edgeMockData(endpoint),
        meta: {
          endpoint,
          state: "onegate_validation_mock",
        },
      });
    }

    if (url.pathname === "/api/explorer/council-governance") {
      return json(
        mockCouncilGovernanceResponse(
          url.searchParams.get("network") || options.network,
        ),
      );
    }

    if (url.pathname === "/api/morpheus/oracle/public-key") {
      const network = url.searchParams.get("network") || options.network;
      return json({
        network,
        source: "onegate_validation_mock",
        contract: "0xf54d8584ef82315c1800373272ab08ae0db2d5ef",
        rpc_url: "mock://onegate-validation",
        algorithm: "X25519-HKDF-SHA256-AES-256-GCM",
        public_key: MOCK_ORACLE_PUBLIC_KEY,
        public_key_format: "raw",
      });
    }

    if (url.pathname === "/api/morpheus/confidential/store") {
      return json({
        ok: true,
        store_available: true,
        secret_ref: "mock-secret-ref-onegate-validation",
        id: "mock-secret-ref-onegate-validation",
        ref: "mock-secret-ref-onegate-validation",
      });
    }

    return route.continue();
  });
}

async function clickConnectIfPresent(page) {
  return page.evaluate(
    ({ connectSource, disconnectSource }) => {
      const connectRe = new RegExp(connectSource, "i");
      const disconnectRe = new RegExp(disconnectSource, "i");
      const candidates = Array.from(
        document.querySelectorAll("button, a, [role='button']"),
      )
        .map((element) => ({
          element,
          text: (
            element.textContent ||
            element.getAttribute("aria-label") ||
            ""
          )
            .replace(/\s+/g, " ")
            .trim(),
        }))
        .filter(({ element, text }) => {
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return (
            text &&
            connectRe.test(text) &&
            !disconnectRe.test(text) &&
            !element.hasAttribute("disabled") &&
            element.getAttribute("aria-disabled") !== "true" &&
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            rect.width > 0 &&
            rect.height > 0
          );
        });
      const target = candidates[0];
      if (!target) return { clicked: false, text: "" };
      target.element.click();
      return { clicked: true, text: target.text };
    },
    {
      connectSource: CONNECT_TEXT_RE.source,
      disconnectSource: DISCONNECT_TEXT_RE.source,
    },
  );
}

function relevantConsoleEntries(entries, options) {
  return entries.filter((entry) => {
    if (entry.type === "warning" || entry.type === "warn") {
      return options.failOnWarning;
    }
    return entry.type === "error";
  });
}

async function validateEntry(browser, entry, options, index, total) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1 OneGateMock/1.0",
  });
  await context.addInitScript(installOneGateMock, {
    network: options.network,
    mainnetMagic: MAINNET_MAGIC,
    testnetMagic: TESTNET_MAGIC,
    address: MOCK_ADDRESS,
    accountHash: MOCK_HASH,
    txid: MOCK_TXID,
  });
  await installPlatformApiMocks(context, options);
  const page = await context.newPage();
  const consoleEntries = [];
  const pageErrors = [];
  const failedRequests = [];
  const httpErrors = [];
  page.on("console", (message) => {
    const type = message.type();
    if (["error", "warning", "warn"].includes(type)) {
      consoleEntries.push({ type, text: message.text().slice(0, 500) });
    }
  });
  page.on("pageerror", (error) => {
    pageErrors.push(String(error?.message || error).slice(0, 500));
  });
  page.on("requestfailed", (request) => {
    if (!CRITICAL_RESOURCE_TYPES.has(request.resourceType())) return;
    failedRequests.push({
      type: request.resourceType(),
      url: request.url(),
      error: request.failure()?.errorText || "request failed",
    });
  });
  page.on("response", (response) => {
    if (response.status() < 400) return;
    const request = response.request();
    httpErrors.push({
      status: response.status(),
      method: request.method(),
      type: request.resourceType(),
      url: response.url(),
    });
  });

  let responseStatus = 0;
  let connectClick = { clicked: false, text: "" };
  try {
    const response = await page.goto(entry.url, {
      waitUntil: "domcontentloaded",
      timeout: options.timeoutMs,
    });
    responseStatus = response?.status() || 0;
    await page.waitForTimeout(options.settleMs);
    if (!options.skipConnect) {
      connectClick = await clickConnectIfPresent(page);
      if (connectClick.clicked) await page.waitForTimeout(800);
    }
    const state = await page.evaluate(() => {
      const text = (document.body?.innerText || "").replace(/\s+/g, " ").trim();
      const interactiveCount = document.querySelectorAll(
        "button, a, input, select, textarea, [role='button']",
      ).length;
      const root = document.querySelector("#root, #app, main, body");
      const overlayText = text.toLowerCase();
      return {
        finalUrl: location.href,
        title: document.title,
        textLength: text.length,
        textSample: text.slice(0, 260),
        interactiveCount,
        hasRootContent: Boolean(root && root.children.length > 0),
        hasHostLayout: Boolean(
          document.querySelector("[data-testid='miniapp-detail-layout']"),
        ),
        hasHostNav:
          Boolean(document.querySelector("header nav, nav[aria-label]")) ||
          text.includes("Yiwu 小程序"),
        hasYiwuText: text.includes("Yiwu"),
        hasFrameworkOverlay:
          Boolean(
            document.querySelector("vite-error-overlay, nextjs-portal"),
          ) ||
          overlayText.includes("runtime error") ||
          overlayText.includes("hydration failed") ||
          overlayText.includes("webpack") ||
          overlayText.includes("vite error"),
        mockCalls: Array.isArray(window.__mockOneGateCalls)
          ? window.__mockOneGateCalls.map((call) => call.method)
          : [],
      };
    });
    const relevantConsole = relevantConsoleEntries(consoleEntries, options);
    const issues = [];
    if (responseStatus >= 400 || responseStatus === 0) {
      issues.push(`document status ${responseStatus || "unknown"}`);
    }
    if (state.textLength < 40 && state.interactiveCount < 2)
      issues.push("blank or too little content");
    if (!state.hasRootContent) issues.push("missing root content");
    if (state.hasHostLayout || state.hasHostNav || state.hasYiwuText) {
      issues.push("host shell leaked into standalone OneGate surface");
    }
    if (state.hasFrameworkOverlay)
      issues.push("framework error overlay visible");
    if (pageErrors.length > 0) issues.push("pageerror");
    if (relevantConsole.length > 0) issues.push("console error");
    if (failedRequests.length > 0) issues.push("critical request failed");
    if (httpErrors.length > 0) issues.push("http error response");

    const result = {
      slug: entry.slug,
      appId: entry.appId,
      name: entry.name,
      url: entry.url,
      status: issues.length ? "fail" : "pass",
      issues,
      responseStatus,
      finalUrl: state.finalUrl,
      title: state.title,
      textLength: state.textLength,
      textSample: state.textSample,
      connectClick,
      mockCalls: state.mockCalls,
      consoleEntries,
      pageErrors,
      failedRequests,
      httpErrors,
    };
    const marker = result.status === "pass" ? "ok" : "FAIL";
    console.log(
      `[onegate-mock] ${index + 1}/${total} ${marker} ${entry.slug} body=${state.textLength} calls=${state.mockCalls.length}${connectClick.clicked ? ` connect="${connectClick.text}"` : ""}`,
    );
    return result;
  } catch (error) {
    console.log(
      `[onegate-mock] ${index + 1}/${total} FAIL ${entry.slug} ${error instanceof Error ? error.message : String(error)}`,
    );
    return {
      slug: entry.slug,
      appId: entry.appId,
      name: entry.name,
      url: entry.url,
      status: "fail",
      issues: ["navigation or validation exception"],
      responseStatus,
      finalUrl: page.url(),
      title: await page.title().catch(() => ""),
      textLength: 0,
      textSample: "",
      connectClick,
      mockCalls: [],
      consoleEntries,
      pageErrors,
      failedRequests,
      httpErrors,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await context.close();
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const entries = await loadEntries(options);
  if (entries.length === 0)
    throw new Error("no miniapps matched the requested filters");

  console.log(
    `[onegate-mock] validating ${entries.length} miniapp(s) base=${options.baseUrl} network=${options.network} platformApiMock=${options.mockPlatformApis ? "on" : "off"}`,
  );
  const browser = await chromium.launch({ headless: !options.headed });
  const results = [];
  try {
    for (let index = 0; index < entries.length; index += 1) {
      results.push(
        await validateEntry(
          browser,
          entries[index],
          options,
          index,
          entries.length,
        ),
      );
    }
  } finally {
    await browser.close();
  }

  const failures = results.filter((result) => result.status !== "pass");
  const walletInteractionCount = results.filter(
    (result) => result.connectClick.clicked,
  ).length;
  const mockCallCount = results.reduce(
    (total, result) => total + result.mockCalls.length,
    0,
  );
  const summary = {
    checked_count: results.length,
    pass_count: results.length - failures.length,
    failure_count: failures.length,
    wallet_interaction_count: walletInteractionCount,
    mock_call_count: mockCallCount,
    failures: failures.map((failure) => ({
      slug: failure.slug,
      appId: failure.appId,
      name: failure.name,
      issues: failure.issues,
      url: failure.url,
      finalUrl: failure.finalUrl,
      title: failure.title,
      textSample: failure.textSample,
      consoleEntries: failure.consoleEntries.slice(0, 5),
      pageErrors: failure.pageErrors.slice(0, 5),
      failedRequests: failure.failedRequests.slice(0, 5),
      httpErrors: failure.httpErrors.slice(0, 5),
      error: failure.error,
    })),
  };
  console.log(JSON.stringify(summary, null, 2));
  if (failures.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});

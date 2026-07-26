#!/usr/bin/env node

const fs = require("fs");
const http = require("http");
const net = require("net");
const path = require("path");
const { spawn } = require("child_process");

const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "../../..");
const PUBLIC_ROOT = path.join(ROOT, "platform/host-app/public");
const HOST_APP_ROOT = path.join(ROOT, "platform/host-app");
const STANDALONE_SERVER_ROOT = path.join(
  HOST_APP_ROOT,
  ".next/standalone/platform/host-app",
);
const STANDALONE_SERVER_PATH = path.join(STANDALONE_SERVER_ROOT, "server.js");
const CATALOG_PATH = path.join(PUBLIC_ROOT, "miniapps/catalog.json");
const REPORT_DIR = path.join(ROOT, "docs/reports");
const JSON_REPORT = path.join(REPORT_DIR, "miniapp-runtime-ui-latest.json");
const MD_REPORT = path.join(REPORT_DIR, "miniapp-runtime-ui-latest.md");
const DEFAULT_SCREENSHOT_DIR = path.join(REPORT_DIR, "miniapp-runtime-ui-screenshots");

const DEFAULT_MIN_TEXT_LENGTH = 50;
const DEFAULT_VIEWPORTS = [
  { label: "desktop", width: 1440, height: 1000 },
  { label: "mobile", width: 390, height: 844 },
];
const DEFAULT_RENDER_TIMEOUT_MS = 30000;
const DEFAULT_NAV_TIMEOUT_MS = 10000;
const DEFAULT_LOW_TEXT_WARNING_LENGTH = 100;

const OVERLAY_PATTERN =
  /Unhandled Runtime Error|Build Error|Next\.js.*error|Webpack.*(?:Error|Overlay)|\bVite\b.*(?:Error|Overlay|Internal server error)|vite-error-overlay|Hydration failed/i;
const RESOURCE_TIMEOUT_PATTERN = /Failed to load resource: net::ERR_TIMED_OUT/i;

const IGNORED_CONSOLE_PATTERNS = [
  /favicon\.ico/i,
  /NO_COLOR/i,
  /net::ERR_CONNECTION_CLOSED/i,
  /Failed to load resource: the server responded with a status of 404 \(Not Found\)/i,
  /OS service error \([^)]+\): Not Found/i,
];

const SENSITIVE_PATTERNS = [
  /(phak_[A-Za-z0-9_-]+)/g,
  /(sk-[A-Za-z0-9_-]+)/g,
  /(sk-proj-[A-Za-z0-9_-]+)/g,
  /((?:WIF|PRIVATE_KEY|TOKEN|SECRET|API_KEY)[=:]\s*)[A-Za-z0-9_./+=-]+/gi,
];

const CONTENT_TYPES = {
  ".avif": "image/avif",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function parseArgs(argv) {
  const options = {
    baseUrl: process.env.MINIAPP_RUNTIME_AUDIT_BASE_URL || "",
    minTextLength: Number(process.env.MINIAPP_RUNTIME_AUDIT_MIN_TEXT_LENGTH || DEFAULT_MIN_TEXT_LENGTH),
    navTimeoutMs: Number(process.env.MINIAPP_RUNTIME_AUDIT_NAV_TIMEOUT_MS || DEFAULT_NAV_TIMEOUT_MS),
    renderTimeoutMs: Number(process.env.MINIAPP_RUNTIME_AUDIT_RENDER_TIMEOUT_MS || DEFAULT_RENDER_TIMEOUT_MS),
    viewports: process.env.MINIAPP_RUNTIME_AUDIT_VIEWPORTS || "desktop,mobile",
    viewportWidth: process.env.MINIAPP_RUNTIME_AUDIT_VIEWPORT_WIDTH
      ? Number(process.env.MINIAPP_RUNTIME_AUDIT_VIEWPORT_WIDTH)
      : null,
    viewportHeight: process.env.MINIAPP_RUNTIME_AUDIT_VIEWPORT_HEIGHT
      ? Number(process.env.MINIAPP_RUNTIME_AUDIT_VIEWPORT_HEIGHT)
      : null,
    serveStatic: process.env.MINIAPP_RUNTIME_AUDIT_SERVE_STATIC === "1",
    screenshots: process.env.MINIAPP_RUNTIME_AUDIT_SCREENSHOTS === "1",
    screenshotDir: process.env.MINIAPP_RUNTIME_AUDIT_SCREENSHOT_DIR || DEFAULT_SCREENSHOT_DIR,
    slugs: process.env.MINIAPP_RUNTIME_AUDIT_SLUGS || "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[index];
    };

    if (arg === "--base-url") options.baseUrl = next();
    else if (arg === "--min-text-length") options.minTextLength = Number(next());
    else if (arg === "--nav-timeout-ms") options.navTimeoutMs = Number(next());
    else if (arg === "--render-timeout-ms") options.renderTimeoutMs = Number(next());
    else if (arg === "--viewports") options.viewports = next();
    else if (arg === "--viewport-width") options.viewportWidth = Number(next());
    else if (arg === "--viewport-height") options.viewportHeight = Number(next());
    else if (arg === "--serve-static") options.serveStatic = true;
    else if (arg === "--screenshots") options.screenshots = true;
    else if (arg === "--screenshot-dir") options.screenshotDir = path.resolve(next());
    else if (arg === "--slugs") options.slugs = next();
    else if (arg === "--help" || arg === "-h") {
      console.log([
        "Usage: node deploy/scripts/audit_miniapp_runtime_ui.js [options]",
        "",
        "Options:",
        "  --base-url <url>            Existing host-app origin. If omitted, local Next standalone is started.",
        "  --serve-static              Serve platform/host-app/public directly. Useful for asset-only smoke checks.",
        "  --min-text-length <number>  Minimum rendered body text length per miniapp. Default: 50.",
        "  --nav-timeout-ms <number>   Navigation timeout. Default: 10000.",
        "  --render-timeout-ms <num>   Wait timeout for #app rendered content. Default: 15000.",
        "  --viewports <list>          Comma-separated viewports. Default: desktop,mobile.",
        "                               Supports desktop, mobile, or label:WIDTHxHEIGHT.",
        "  --viewport-width <number>   Single custom viewport width; overrides --viewports when paired with height.",
        "  --viewport-height <number>  Single custom viewport height; overrides --viewports when paired with width.",
        "  --screenshots               Capture viewport screenshots for visual review.",
        "  --screenshot-dir <path>     Screenshot output directory. Default: docs/reports/miniapp-runtime-ui-screenshots.",
        "  --slugs <list>              Optional comma-separated miniapp slug filter for targeted reruns.",
      ].join("\n"));
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  for (const [key, value] of Object.entries(options)) {
    if (
      key === "baseUrl" ||
      key === "serveStatic" ||
      key === "viewports" ||
      key === "screenshots" ||
      key === "screenshotDir" ||
      key === "slugs"
    ) continue;
    if (value == null) continue;
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`Invalid numeric option ${key}: ${value}`);
    }
  }

  options.baseUrl = String(options.baseUrl || "").replace(/\/+$/, "");
  options.screenshotDir = path.resolve(options.screenshotDir);
  options.viewportList = resolveViewports(options);
  options.slugList = parseSlugList(options.slugs);
  return options;
}

function parseSlugList(value) {
  return String(value || "")
    .split(",")
    .map((slug) => slug.trim())
    .filter(Boolean);
}

function resolveViewports(options) {
  const hasCustomWidth = options.viewportWidth != null;
  const hasCustomHeight = options.viewportHeight != null;
  if (hasCustomWidth || hasCustomHeight) {
    if (!hasCustomWidth || !hasCustomHeight) {
      throw new Error("--viewport-width and --viewport-height must be provided together");
    }
    return [{ label: "custom", width: options.viewportWidth, height: options.viewportHeight }];
  }

  const aliases = new Map(DEFAULT_VIEWPORTS.map((viewport) => [viewport.label, viewport]));
  return String(options.viewports || "")
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => {
      if (aliases.has(token)) return aliases.get(token);
      const match = /^([a-z0-9_-]+):(\d+)x(\d+)$/i.exec(token);
      if (!match) {
        throw new Error(`Unknown viewport "${token}". Use desktop, mobile, or label:WIDTHxHEIGHT.`);
      }
      return {
        label: match[1],
        width: Number(match[2]),
        height: Number(match[3]),
      };
    });
}

function sanitize(value) {
  let text = String(value || "");
  for (const pattern of SENSITIVE_PATTERNS) {
    text = text.replace(pattern, (match, prefix) => {
      if (prefix && /=|:/.test(prefix)) return `${prefix}[REDACTED]`;
      return "[REDACTED]";
    });
  }
  return text;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadCatalogSlugs() {
  const catalog = readJson(CATALOG_PATH);
  const apps = Array.isArray(catalog.apps) ? catalog.apps : [];
  const slugs = apps
    .map((app) => String(app?.slug || "").trim())
    .filter(Boolean)
    .sort();

  if (slugs.length === 0 || Number(catalog.count) !== slugs.length) {
    throw new Error(`Catalog count does not match discovered miniapps: count=${catalog.count} slugs=${slugs.length}`);
  }

  return slugs;
}

function filterCatalogSlugs(slugs, requestedSlugs) {
  if (!requestedSlugs.length) return slugs;
  const available = new Set(slugs);
  const missing = requestedSlugs.filter((slug) => !available.has(slug));
  if (missing.length > 0) {
    throw new Error(`Unknown miniapp slug(s): ${missing.join(", ")}`);
  }
  return requestedSlugs;
}

function isIgnoredConsole(text) {
  return IGNORED_CONSOLE_PATTERNS.some((pattern) => pattern.test(text));
}

function isAssetRequest(request) {
  return ["script", "stylesheet", "image", "font"].includes(request.resourceType());
}

async function waitForRenderedContent(page, minTextLength, timeoutMs) {
  await page.waitForFunction(
    (minimumTextLength) => {
      const app = document.querySelector("#app");
      const text = (document.body?.innerText || "").replace(/\s+/g, " ").trim();
      return Boolean(app && app.children.length > 0 && text.length >= minimumTextLength);
    },
    minTextLength,
    { timeout: timeoutMs },
  );
}

function isBlockingLog(log, result) {
  if (RESOURCE_TIMEOUT_PATTERN.test(log.text || "") && result.contentReady && result.failedAssets.length === 0) {
    return false;
  }
  return log.type === "error" || log.type === "pageerror";
}

function safeFilePart(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

function createStaticServer() {
  const server = http.createServer(async (request, response) => {
    try {
      const rawUrl = new URL(request.url || "/", "http://127.0.0.1");
      let pathname = decodeURIComponent(rawUrl.pathname);
      if (pathname.endsWith("/")) pathname += "index.html";
      const resolved = path.resolve(PUBLIC_ROOT, `.${pathname}`);

      if (!resolved.startsWith(PUBLIC_ROOT + path.sep)) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
      }

      const stat = await fs.promises.stat(resolved).catch(() => null);
      if (!stat || !stat.isFile()) {
        response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
      }

      response.writeHead(200, {
        "access-control-allow-origin": "*",
        "cache-control": "no-store",
        "content-type": CONTENT_TYPES[path.extname(resolved).toLowerCase()] || "application/octet-stream",
      });
      fs.createReadStream(resolved).pipe(response);
    } catch (error) {
      response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      response.end(sanitize(error instanceof Error ? error.message : String(error)));
    }
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        baseUrl: `http://127.0.0.1:${address.port}`,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = address.port;
      server.close(() => resolve(port));
    });
  });
}

function httpGetStatus(url) {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => {
      response.resume();
      resolve(response.statusCode || 0);
    });
    request.setTimeout(1000, () => {
      request.destroy(new Error("timeout"));
    });
    request.on("error", () => resolve(0));
  });
}

async function waitForHttpOk(url, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const status = await httpGetStatus(url);
    if (status >= 200 && status < 500) return status;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function createStandaloneServer() {
  if (!fs.existsSync(STANDALONE_SERVER_PATH)) {
    throw new Error(
      [
        "Host-app standalone server is missing.",
        `Expected: ${STANDALONE_SERVER_PATH}`,
        "Run `npm --prefix platform/host-app run build` first, or pass `--base-url <running host-app origin>`.",
      ].join(" "),
    );
  }

  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const output = [];
  const child = spawn(process.execPath, [STANDALONE_SERVER_PATH], {
    cwd: STANDALONE_SERVER_ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
      NEXT_TELEMETRY_DISABLED: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const collect = (chunk) => {
    output.push(sanitize(chunk.toString()).slice(0, 1000));
    while (output.length > 10) output.shift();
  };
  child.stdout.on("data", collect);
  child.stderr.on("data", collect);

  try {
    await waitForHttpOk(`${baseUrl}/miniapps/catalog.json`);
  } catch (error) {
    child.kill("SIGTERM");
    throw new Error(`${error instanceof Error ? error.message : String(error)}. Server output: ${output.join(" ")}`);
  }

  return {
    baseUrl,
    close: () => new Promise((resolve) => {
      if (child.exitCode !== null || child.killed) {
        resolve();
        return;
      }
      child.once("exit", () => resolve());
      child.kill("SIGTERM");
      setTimeout(() => {
        if (child.exitCode === null && !child.killed) child.kill("SIGKILL");
      }, 3000).unref();
    }),
  };
}

async function inspectMiniapp(context, slug, viewport, options) {
  const page = await context.newPage();
  const logs = [];
  const failedAssets = [];
  const url = `${options.baseUrl}/miniapps/${slug}/index.html`;
  let responseStatus = null;
  let loadError = null;
  let contentReady = false;

  page.on("console", (message) => {
    if (!["error", "warning"].includes(message.type())) return;
    const text = sanitize(message.text()).slice(0, 300);
    if (!isIgnoredConsole(text)) {
      const location = message.location();
      logs.push({
        type: message.type(),
        text,
        url: location?.url ? sanitize(location.url).replace(options.baseUrl, "") : "",
      });
    }
  });

  page.on("pageerror", (error) => {
    logs.push({
      type: "pageerror",
      text: sanitize(error?.message || error).slice(0, 300),
    });
  });

  page.on("response", (response) => {
    const request = response.request();
    if (!isAssetRequest(request) || response.status() < 400) return;
    failedAssets.push({
      status: response.status(),
      resourceType: request.resourceType(),
      url: sanitize(response.url()).replace(options.baseUrl, ""),
    });
  });

  try {
    const response = await page.goto(url, {
      waitUntil: "commit",
      timeout: options.navTimeoutMs,
    });
    responseStatus = response ? response.status() : null;
    await page.waitForLoadState("domcontentloaded", {
      timeout: options.navTimeoutMs,
    }).catch(() => {});
    await waitForRenderedContent(page, options.minTextLength, options.renderTimeoutMs);
    contentReady = true;
  } catch (error) {
    loadError = sanitize(error instanceof Error ? error.message : String(error)).slice(0, 400);
    const recoveryTimeoutMs = Math.min(10000, Math.max(1000, Math.floor(options.renderTimeoutMs / 2)));
    try {
      await waitForRenderedContent(page, options.minTextLength, recoveryTimeoutMs);
      contentReady = true;
      loadError = null;
    } catch {
      // Keep the original load error; metrics below capture the final rendered state.
    }
  }

  const metrics = await page.evaluate((overlaySource) => {
    const text = (document.body?.innerText || "").replace(/\s+/g, " ").trim();
    const doc = document.documentElement;
    const controls = Array.from(document.querySelectorAll("button,a,input,select,textarea,summary,[role='button'],[role='link']"));
    const visibleControls = controls.filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    });
    const enabledControls = visibleControls.filter((element) => {
      return !Boolean(element.disabled || element.getAttribute("aria-disabled") === "true");
    });
    const touchControls = enabledControls.filter((element) => {
      if (element.tagName.toLowerCase() !== "input") return true;
      const type = String(element.getAttribute("type") || "text").toLowerCase();
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return !["checkbox", "file", "radio"].includes(type) ||
        (rect.width > 4 && rect.height > 4 && style.opacity !== "0");
    });
    const smallTouchTargets = touchControls
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const label =
          element.getAttribute("aria-label") ||
          element.textContent ||
          element.getAttribute("title") ||
          element.tagName.toLowerCase();
        return {
          tag: element.tagName.toLowerCase(),
          label: String(label || "").replace(/\s+/g, " ").trim().slice(0, 80),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      })
      .filter((control) => control.width < 24 || control.height < 24);
    return {
      title: document.title,
      readyState: document.readyState,
      appChildCount: document.querySelector("#app")?.children.length || 0,
      textLength: text.length,
      textSample: text.slice(0, 160),
      hasFrameworkOverlay: new RegExp(overlaySource, "i").test(document.documentElement.innerText || ""),
      horizontalOverflow: doc.scrollWidth > doc.clientWidth + 2,
      controlsCount: controls.length,
      visibleControlsCount: visibleControls.length,
      enabledControlsCount: enabledControls.length,
      smallTouchTargetCount: smallTouchTargets.length,
      smallTouchTargets: smallTouchTargets.slice(0, 5),
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      pageHeight: Math.max(doc.scrollHeight, document.body?.scrollHeight || 0),
      viewportHeight: window.innerHeight,
    };
  }, OVERLAY_PATTERN.source).catch((error) => ({
    evaluateError: sanitize(error instanceof Error ? error.message : String(error)).slice(0, 300),
  }));

  let screenshot = null;
  if (options.screenshots) {
    const fileName = `${safeFilePart(slug)}-${safeFilePart(viewport.label)}-${viewport.width}x${viewport.height}.png`;
    const screenshotPath = path.join(options.screenshotDir, fileName);
    try {
      fs.mkdirSync(options.screenshotDir, { recursive: true });
      await page.screenshot({
        path: screenshotPath,
        fullPage: false,
        animations: "disabled",
      });
      screenshot = {
        path: screenshotPath,
        relative_path: path.relative(REPORT_DIR, screenshotPath),
      };
    } catch (error) {
      screenshot = {
        error: sanitize(error instanceof Error ? error.message : String(error)).slice(0, 300),
      };
    }
  }

  await page.close();

  const result = {
    slug,
    viewport: viewport.label,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
    url,
    responseStatus,
    loadError,
    contentReady,
    logs,
    failedAssets,
    screenshot,
    ...metrics,
  };

  result.failed = Boolean(
    result.loadError ||
      !result.contentReady ||
      result.responseStatus !== 200 ||
      result.evaluateError ||
      result.textLength < options.minTextLength ||
      result.appChildCount < 1 ||
      result.hasFrameworkOverlay ||
      result.horizontalOverflow ||
      result.failedAssets.length > 0 ||
      result.logs.some((log) => isBlockingLog(log, result)),
  );

  return result;
}

function buildWarnings(results) {
  const warnings = [];
  for (const result of results) {
    if (result.failed) continue;
    const base = {
      slug: result.slug,
      viewport: result.viewport,
      viewportWidth: result.viewportWidth,
      viewportHeight: result.viewportHeight,
    };

    if ((result.visibleControlsCount || 0) === 0) {
      warnings.push({
        ...base,
        type: "no_visible_semantic_controls",
        message: "No visible semantic controls were detected in the audited viewport; review whether this state is intentionally read-only.",
      });
    }

    if ((result.textLength || 0) < DEFAULT_LOW_TEXT_WARNING_LENGTH) {
      warnings.push({
        ...base,
        type: "low_visible_text",
        message: `Visible text length is ${result.textLength}; review whether the page communicates enough context in this viewport.`,
      });
    }

    if (result.viewportWidth <= 480 && (result.smallTouchTargetCount || 0) > 0) {
      const examples = (result.smallTouchTargets || [])
        .map((target) => `${target.tag} "${target.label || "unlabeled"}" ${target.width}x${target.height}`)
        .join("; ");
      warnings.push({
        ...base,
        type: "small_mobile_touch_targets",
        message: `${result.smallTouchTargetCount} enabled mobile control(s) are below 24x24px. Examples: ${examples}`,
      });
    }

    if (result.screenshot?.error) {
      warnings.push({
        ...base,
        type: "screenshot_capture_error",
        message: result.screenshot.error,
      });
    }
  }
  return warnings;
}

function writeReports(report) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(JSON_REPORT, JSON.stringify(report, null, 2));

  const lines = [
    "# Miniapp Runtime UI Audit",
    "",
    `Generated: ${report.generated_at}`,
    `Base URL: ${report.base_url}`,
    `Catalog count: ${report.catalog_count}`,
    `Viewports: ${report.viewports.map((viewport) => `${viewport.label} ${viewport.width}x${viewport.height}`).join(", ")}`,
    `Total checks: ${report.total_checks}`,
    `Passed: ${report.passed}`,
    `Failed: ${report.failed}`,
    `Warnings: ${report.warnings.length}`,
    `Screenshots: ${report.screenshots_enabled ? report.screenshot_dir : "disabled"}`,
    "",
    "## Checks",
    "",
    "- Each catalog miniapp loads `/miniapps/<slug>/index.html` with HTTP 200.",
    "- The `#app` root renders children and enough visible text.",
    "- No framework error overlay is visible.",
    "- No horizontal document overflow is present at each audit viewport.",
    "- Script, stylesheet, image, and font requests do not return 4xx/5xx.",
    "- Relevant console errors and page errors fail the audit.",
    report.screenshots_enabled
      ? "- Optional screenshots are captured per miniapp and viewport for human visual review."
      : "- Run with `--screenshots` to capture per-miniapp viewport screenshots for human visual review.",
    "",
  ];

  if (report.failures.length > 0) {
    lines.push("## Failures", "");
    for (const failure of report.failures) {
      lines.push(
        `- ${failure.slug} (${failure.viewport} ${failure.viewportWidth}x${failure.viewportHeight}): status=${failure.responseStatus} contentReady=${failure.contentReady} textLength=${failure.textLength} overflow=${failure.horizontalOverflow}`,
      );
      if (failure.loadError) lines.push(`  - loadError: ${failure.loadError}`);
      if (failure.evaluateError) lines.push(`  - evaluateError: ${failure.evaluateError}`);
      for (const asset of failure.failedAssets.slice(0, 5)) {
        lines.push(`  - asset ${asset.status} ${asset.resourceType}: ${asset.url}`);
      }
      for (const log of failure.logs.slice(0, 5)) {
        lines.push(`  - ${log.type}: ${log.text}`);
      }
    }
  } else {
    lines.push("## Failures", "", "None.");
  }

  lines.push("", "## Warnings", "");
  if (report.warnings.length > 0) {
    for (const warning of report.warnings) {
      lines.push(
        `- ${warning.slug} (${warning.viewport} ${warning.viewportWidth}x${warning.viewportHeight}) ${warning.type}: ${warning.message}`,
      );
    }
  } else {
    lines.push("None.");
  }

  if (report.screenshots_enabled) {
    const byViewport = new Map();
    for (const result of report.results) {
      if (!result.screenshot?.relative_path) continue;
      if (!byViewport.has(result.viewport)) byViewport.set(result.viewport, []);
      byViewport.get(result.viewport).push(result);
    }

    lines.push("", "## Screenshot Index", "");
    for (const [viewport, items] of byViewport.entries()) {
      lines.push(`### ${viewport}`, "");
      for (const item of items) {
        lines.push(`- ${item.slug}: [screenshot](${item.screenshot.relative_path})`);
      }
      lines.push("");
    }
  }

  lines.push("");
  fs.writeFileSync(MD_REPORT, `${lines.join("\n").replace(/\n+$/, "")}\n`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  let ownedServer = null;
  let servedStatic = false;
  let startedStandalone = false;
  if (!options.baseUrl) {
    if (options.serveStatic) {
      ownedServer = await createStaticServer();
      servedStatic = true;
    } else {
      ownedServer = await createStandaloneServer();
      startedStandalone = true;
    }
    options.baseUrl = ownedServer.baseUrl;
  }

  const catalogSlugs = loadCatalogSlugs();
  const slugs = filterCatalogSlugs(catalogSlugs, options.slugList);
  const browser = await chromium.launch({ headless: true });

  const results = [];
  try {
    for (const viewport of options.viewportList) {
      const context = await browser.newContext({
        viewport: {
          width: viewport.width,
          height: viewport.height,
        },
        deviceScaleFactor: 1,
      });
      try {
        for (const slug of slugs) {
          results.push(await inspectMiniapp(context, slug, viewport, options));
        }
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
    if (ownedServer) await ownedServer.close();
  }

  const failures = results.filter((result) => result.failed);
  const warnings = buildWarnings(results);
  const warningsByResult = new Map();
  for (const warning of warnings) {
    const key = `${warning.slug}:${warning.viewport}`;
    if (!warningsByResult.has(key)) warningsByResult.set(key, []);
    warningsByResult.get(key).push({
      type: warning.type,
      message: warning.message,
    });
  }
  for (const result of results) {
    result.warnings = warningsByResult.get(`${result.slug}:${result.viewport}`) || [];
  }
  const report = {
    generated_at: new Date().toISOString(),
    base_url: options.baseUrl,
    served_static_public: servedStatic,
    started_standalone_server: startedStandalone,
    viewports: options.viewportList,
    screenshots_enabled: options.screenshots,
    screenshot_dir: options.screenshots ? options.screenshotDir : null,
    min_text_length: options.minTextLength,
    low_text_warning_length: DEFAULT_LOW_TEXT_WARNING_LENGTH,
    catalog_count: slugs.length,
    catalog_total_count: catalogSlugs.length,
    total_checks: results.length,
    passed: results.length - failures.length,
    failed: failures.length,
    warnings,
    failures,
    results,
  };

  writeReports(report);

  console.log(JSON.stringify({
    report: JSON_REPORT,
    markdown: MD_REPORT,
    catalog_count: report.catalog_count,
    total_checks: report.total_checks,
    viewports: report.viewports,
    passed: report.passed,
    failed: report.failed,
    warnings: report.warnings.length,
    screenshots_enabled: report.screenshots_enabled,
    screenshot_dir: report.screenshot_dir,
    failures: failures.map((failure) => ({
      slug: failure.slug,
      viewport: failure.viewport,
      responseStatus: failure.responseStatus,
      contentReady: failure.contentReady,
      textLength: failure.textLength,
      horizontalOverflow: failure.horizontalOverflow,
      failedAssets: failure.failedAssets.slice(0, 3),
      logs: failure.logs.slice(0, 3),
      loadError: failure.loadError,
    })),
  }, null, 2));

  if (failures.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(sanitize(error instanceof Error ? error.stack || error.message : String(error)));
  process.exit(1);
});

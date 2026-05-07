import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(appRoot, "..", "..");
const standaloneBase = path.join(appRoot, ".next", "standalone");
const standaloneRoot = path.join(
  appRoot,
  ".next",
  "standalone",
  "platform",
  "host-app",
);

const copies = [
  {
    from: path.join(appRoot, ".next", "static"),
    to: path.join(standaloneRoot, ".next", "static"),
  },
  {
    from: path.join(appRoot, ".next", "server"),
    to: path.join(standaloneRoot, ".next", "server"),
  },
  {
    from: path.join(appRoot, ".next", "BUILD_ID"),
    to: path.join(standaloneRoot, ".next", "BUILD_ID"),
  },
  {
    from: path.join(appRoot, "public"),
    to: path.join(standaloneRoot, "public"),
  },
  {
    from: path.join(repoRoot, "apps"),
    to: path.join(standaloneBase, "apps"),
  },
];

const hoistedPackages = [
  // Next.js standalone tracing can occasionally miss hoisted workspace deps in
  // this monorepo, causing runtime ERR_MODULE_NOT_FOUND when running the
  // standalone server (used by Playwright E2E). Keep this list minimal and
  // copy only when missing.
  "zustand",
];

if (!fs.existsSync(standaloneRoot)) {
  console.warn(
    `[prepare-standalone] skipped: standalone output not found at ${standaloneRoot}`,
  );
  process.exit(0);
}

function sleepSync(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    // busy wait; short, bounded, and avoids async top-level changes.
  }
}

function copyWithRetry(from, to, { attempts = 3, backoffMs = 250 } = {}) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      fs.cpSync(from, to, { recursive: true, dereference: true });
      return;
    } catch (error) {
      lastError = error;
      if (error && typeof error === "object" && error.code === "ENOENT" && attempt < attempts) {
        sleepSync(backoffMs * attempt);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

const REQUIRED_STANDALONE_PAGE_FILES = [
  "index.html",
  "index.js",
  "account.html",
  "analytics.html",
  "docs.html",
  "docs/api.html",
  "docs/sdk.html",
  "developer.html",
  "explorer.html",
  "home.html",
  "leaderboard.html",
  "login.html",
  "miniapps.html",
  "miniapps.js",
  "miniapps/[id].js",
  "privacy.html",
  "secrets.html",
  "stats.html",
  "terms.html",
  "test.html",
];

function readBuildId() {
  try {
    return fs.readFileSync(path.join(appRoot, ".next", "BUILD_ID"), "utf8").trim();
  } catch {
    return "";
  }
}

function validateStandaloneServerOutput(serverDir) {
  const pagesDir = path.join(serverDir, "pages");
  if (!fs.existsSync(pagesDir)) return { ok: false, reason: "missing pages dir" };
  const missing = [];
  for (const file of REQUIRED_STANDALONE_PAGE_FILES) {
    const candidate = path.join(pagesDir, file);
    if (!fs.existsSync(candidate)) missing.push(`pages/${file}`);
  }
  if (missing.length > 0) {
    return {
      ok: false,
      reason: `missing ${missing.slice(0, 6).join(", ")}${missing.length > 6 ? "…" : ""}`,
    };
  }
  return { ok: true };
}

function validateStandaloneStaticOutput(staticDir, buildId) {
  if (!buildId) return { ok: false, reason: "missing build id" };
  const buildRoot = path.join(staticDir, buildId);
  const required = ["_buildManifest.js", "_ssgManifest.js"];
  const missing = required.filter((file) => !fs.existsSync(path.join(buildRoot, file)));
  if (missing.length > 0) {
    return { ok: false, reason: `missing ${missing.join(", ")}` };
  }
  return { ok: true };
}

function copyServerWithValidation(from, to, { attempts = 5, backoffMs = 300 } = {}) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      rmWithRetry(to);
      fs.mkdirSync(path.dirname(to), { recursive: true });
      copyWithRetry(from, to, { attempts: 3, backoffMs });

      const validation = validateStandaloneServerOutput(to);
      if (validation.ok) return;

      lastError = new Error(
        `[prepare-standalone] standalone server copy incomplete (${validation.reason})`,
      );
    } catch (error) {
      lastError = error;
    }

    if (attempt < attempts) {
      sleepSync(backoffMs * attempt);
    }
  }
  throw lastError;
}

function copyStaticWithValidation(from, to, { attempts = 5, backoffMs = 300 } = {}) {
  const buildId = readBuildId();
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      rmWithRetry(to);
      fs.mkdirSync(path.dirname(to), { recursive: true });
      copyWithRetry(from, to, { attempts: 3, backoffMs });

      const validation = validateStandaloneStaticOutput(to, buildId);
      if (validation.ok) return;

      lastError = new Error(
        `[prepare-standalone] standalone static copy incomplete (${validation.reason})`,
      );
    } catch (error) {
      lastError = error;
    }

    if (attempt < attempts) {
      sleepSync(backoffMs * attempt);
    }
  }
  throw lastError;
}

function rmWithRetry(target, { attempts = 5, backoffMs = 200 } = {}) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      fs.rmSync(target, { recursive: true, force: true });
      return;
    } catch (error) {
      lastError = error;
      const code = error && typeof error === "object" ? error.code : "";
      if ((code === "ENOTEMPTY" || code === "EBUSY" || code === "EPERM") && attempt < attempts) {
        sleepSync(backoffMs * attempt);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

for (const { from, to } of copies) {
  if (!fs.existsSync(from)) {
    console.warn(`[prepare-standalone] skipped missing source: ${from}`);
    continue;
  }

  if (from.endsWith(`${path.sep}.next${path.sep}server`)) {
    copyServerWithValidation(from, to);
    console.log(`[prepare-standalone] copied ${from} -> ${to} (validated)`);
    continue;
  }

  if (from.endsWith(`${path.sep}.next${path.sep}static`)) {
    copyStaticWithValidation(from, to);
    console.log(`[prepare-standalone] copied ${from} -> ${to} (validated)`);
    continue;
  }

  rmWithRetry(to);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  copyWithRetry(from, to);
  console.log(`[prepare-standalone] copied ${from} -> ${to}`);
}

for (const pkg of hoistedPackages) {
  const src = path.join(repoRoot, "node_modules", pkg);
  const dest = path.join(standaloneBase, "node_modules", pkg);
  if (fs.existsSync(dest)) continue;
  if (!fs.existsSync(src)) {
    console.warn(`[prepare-standalone] missing hoisted package source: ${src}`);
    continue;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  copyWithRetry(src, dest);
  console.log(`[prepare-standalone] copied hoisted package ${pkg} -> ${dest}`);
}

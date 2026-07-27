#!/usr/bin/env node
/**
 * Systematic verification of the whole four-repository system.
 *
 * The split's failure modes are not local to one repo - they live in the seams:
 * a package that resolves from a workspace link but not from its published
 * tarball, an app whose manifest disagrees with what the CDN serves, a contract
 * binding that points at an artifact nobody shipped. Each check below exists
 * because that seam actually broke at least once.
 *
 * Checks (each independent, all reported even if earlier ones fail):
 *
 *   repos        every repo clean and in sync with its remote
 *   sdk-package  every module consumers import is present in the *published*
 *                file set, not just in the checkout
 *   imports      no relative import in any repo escapes it or fails to resolve
 *   contracts    every app contract has its compiled artifacts committed, and
 *                the vendored DevPack matches the platform's canonical copy
 *   catalog      CDN catalogue agrees with each app's manifest, and every app in
 *                a repo is published
 *   cdn          the published release itself (delegates to verify-cdn-release)
 *
 * Usage:
 *   node scripts/verify-split-system.mjs
 *   node scripts/verify-split-system.mjs --only catalog,contracts
 *   node scripts/verify-split-system.mjs --json
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.resolve(repoRoot, "..");

const REPOS = {
  platform: path.join(workspaceRoot, "neo-miniapps-platform"),
  sdk: path.join(workspaceRoot, "neo-miniapp-sdk"),
  minigames: path.join(workspaceRoot, "neo-minigames"),
  miniapps: path.join(workspaceRoot, "neo-miniapps"),
};

const CDN = String(process.env.MINIAPP_CDN_BASE_URL || "https://meshmini.app").replace(/\/+$/, "");

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const onlyIndex = args.indexOf("--only");
const only = onlyIndex !== -1 ? new Set(args[onlyIndex + 1].split(",")) : null;

const results = [];
function record(check, ok, detail, extra = {}) {
  results.push({ check, ok, detail, ...extra });
  if (!asJson) {
    process.stdout.write(`${ok ? "  PASS" : "  FAIL"}  ${check.padEnd(28)} ${detail}\n`);
  }
}

function git(dir, ...cmd) {
  return execFileSync("git", cmd, { cwd: dir, encoding: "utf8" }).trim();
}

function selected(name) {
  return !only || only.has(name);
}

// ---------------------------------------------------------------------------

function checkRepos() {
  for (const [name, dir] of Object.entries(REPOS)) {
    if (!fs.existsSync(dir)) {
      record(`repos/${name}`, false, "checkout missing");
      continue;
    }
    const dirty = git(dir, "status", "--porcelain").split("\n").filter(Boolean).length;
    let ahead = "?";
    let behind = "?";
    try {
      const upstream = git(dir, "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}");
      ahead = git(dir, "rev-list", "--count", `${upstream}..HEAD`);
      behind = git(dir, "rev-list", "--count", `HEAD..${upstream}`);
    } catch {
      // No upstream configured.
    }
    const ok = dirty === 0 && ahead === "0" && behind === "0";
    record(`repos/${name}`, ok, `clean=${dirty === 0} ahead=${ahead} behind=${behind}`);
  }
}

/**
 * The packaging bug that shipped: a `files` allowlist of extensions dropped the
 * .js shims and image assets consumers import. Compare what apps actually
 * import from the SDK against what the package would publish.
 */
function checkSdkPackage() {
  const sdk = REPOS.sdk;
  if (!fs.existsSync(sdk)) return record("sdk-package", false, "SDK checkout missing");

  const published = new Set();
  for (const pkg of ["framework", "shared"]) {
    let out;
    try {
      out = execFileSync("npm", ["pack", "--dry-run", "--json"], {
        cwd: path.join(sdk, pkg),
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
      });
    } catch (error) {
      return record("sdk-package", false, `npm pack failed for ${pkg}: ${error.message.slice(0, 80)}`);
    }
    for (const entry of JSON.parse(out)[0].files) {
      published.add(`${pkg}/${entry.path}`);
    }
  }

  // Every @shared/* and @framework/* specifier used anywhere in the app repos.
  const wanted = new Map();
  for (const name of ["minigames", "miniapps"]) {
    const dir = REPOS[name];
    if (!fs.existsSync(dir)) continue;
    const files = execFileSync("git", ["ls-files", "-z", "apps"], { cwd: dir, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 })
      .split("\0")
      .filter((f) => /\.(ts|tsx|vue|scss|js)$/.test(f));
    for (const rel of files) {
      const source = fs.readFileSync(path.join(dir, rel), "utf8");
      // Only real import positions. A bare "@shared/..." string is often an
      // assertion about source text (several tests assert an alias is *not*
      // used), and counting those would invent imports that do not exist.
      const IMPORT_POSITION =
        /(?:\bfrom\s*|\bimport\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bvi\s*\.\s*(?:mock|doMock|unmock)\s*\(\s*|@use\s+|@import\s+)["']@(shared|framework)\/([^"']+)["']/g;
      for (const match of source.matchAll(IMPORT_POSITION)) {
        const pkg = match[1];
        const spec = match[2].replace(/\?.*$/, "").replace(/\s+as\s+.*$/, "");
        wanted.set(`${pkg}/${spec}`, (wanted.get(`${pkg}/${spec}`) || 0) + 1);
      }
    }
  }

  const missing = [];
  for (const [spec] of wanted) {
    // A specifier may resolve to the file itself, an extension, or an index.
    const dir = spec.slice(0, spec.lastIndexOf("/") + 1);
    const base = spec.slice(spec.lastIndexOf("/") + 1);
    const candidates = [
      spec,
      ...[".ts", ".tsx", ".js", ".mjs", ".scss", ".css", ".json", ".svg", ".webp", ".png"].map((e) => spec + e),
      ...[".ts", ".tsx", ".js"].map((e) => `${spec}/index${e}`),
      // Sass partials: `@use "x"` resolves _x.scss.
      ...[".scss", ".sass"].map((e) => `${dir}_${base}${e}`),
    ];
    if (!candidates.some((candidate) => published.has(candidate))) missing.push(spec);
  }

  record(
    "sdk-package",
    missing.length === 0,
    `${wanted.size} imported specifiers, ${published.size} published files, ${missing.length} unresolvable`,
    missing.length ? { missing: missing.slice(0, 15) } : {},
  );
}

/**
 * The gate for deleting apps/ and framework/ from this repo: every tracked file
 * under them must already exist in one of the new repos. A file that is in none
 * of them would be lost silently by the delete, which is the one failure mode
 * with no way back.
 *
 * The path mapping has to keep sub-paths, not just basenames - shared service
 * tests live under shared/test/services, and collapsing that made an earlier
 * version of this check report ten files as lost when they were fine.
 */
function checkMigrated() {
  const targets = {
    sdk: REPOS.sdk,
    minigames: REPOS.minigames,
    miniapps: REPOS.miniapps,
  };

  const candidates = (file) => {
    if (file.startsWith("apps/shared/test/")) {
      const sub = file.slice("apps/shared/test/".length);
      return [
        ["sdk", `shared/test/${sub}`],
        ["minigames", `apps/tests/unit/${sub}`],
        ["minigames", `apps/tests/conformance/${sub}`],
        ["miniapps", `apps/tests/unit/${sub}`],
        ["miniapps", `apps/tests/conformance/${sub}`],
      ];
    }
    if (file.startsWith("apps/shared/test-utils/")) {
      const sub = file.slice("apps/shared/test-utils/".length);
      return [
        ["sdk", `shared/test-utils/${sub}`],
        ["minigames", `apps/tests/test-utils/${sub}`],
        ["miniapps", `apps/tests/test-utils/${sub}`],
      ];
    }
    if (file.startsWith("apps/shared/")) return [["sdk", file.replace("apps/shared/", "shared/")]];
    if (file.startsWith("framework/")) return [["sdk", file]];
    if (file.startsWith("apps/")) return [["minigames", file], ["miniapps", file]];
    return [];
  };

  const lost = [];
  let checked = 0;
  for (const root of ["framework", "apps"]) {
    const tracked = execFileSync("git", ["ls-files", root], {
      cwd: REPOS.platform,
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
    })
      .split("\n")
      .filter(Boolean);
    for (const file of tracked) {
      checked += 1;
      const found = candidates(file).some(([repo, rel]) => fs.existsSync(path.join(targets[repo], rel)));
      if (!found) lost.push(file);
    }
  }

  // The cross-boundary parity tests are knowingly still here; they assert across
  // the platform/app seam and cannot travel with either side untouched.
  const expected = new Set(
    (plan().repos["neo-miniapps-platform"].keeps_shared_tests || []).map((entry) => entry.test),
  );
  const unexpected = lost.filter((file) => !expected.has(file));

  record(
    "migrated",
    unexpected.length === 0,
    `${checked - lost.length}/${checked} platform files present in a new repo, ${lost.length} retained (${unexpected.length} unaccounted)`,
    unexpected.length ? { unaccounted: unexpected.slice(0, 15) } : {},
  );
}

function checkImports() {
  for (const name of ["sdk", "minigames", "miniapps"]) {
    const dir = REPOS[name];
    if (!fs.existsSync(dir)) continue;
    try {
      const out = execFileSync("node", [path.join(repoRoot, "scripts/verify-split-repo.mjs"), dir, "--json"], {
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
      });
      const report = JSON.parse(out);
      record(`imports/${name}`, true, `${report.source_files_scanned} files, 0 unresolved, 0 escaping`);
    } catch (error) {
      let detail = error.message.slice(0, 100);
      try {
        const report = JSON.parse(error.stdout);
        detail = `${report.unresolved_relative_imports} unresolved, ${report.imports_escaping_repo} escaping`;
      } catch {
        // Keep the raw message.
      }
      record(`imports/${name}`, false, detail);
    }
  }
}

let cachedPlan = null;
function plan() {
  if (!cachedPlan) {
    cachedPlan = JSON.parse(fs.readFileSync(path.join(repoRoot, "docs/split/plan.json"), "utf8"));
  }
  return cachedPlan;
}

function checkContracts() {
  for (const [repoName, planKey] of [["minigames", "neo-minigames"], ["miniapps", "neo-miniapps"]]) {
    const dir = REPOS[repoName];
    if (!fs.existsSync(dir)) continue;
    const tracked = new Set(
      execFileSync("git", ["ls-files", "contracts"], { cwd: dir, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
        .split("\n")
        .filter(Boolean),
    );
    const missing = [];
    let expected = 0;
    for (const app of plan().repos[planKey].apps) {
      for (const contract of app.contracts) {
        const project = contract.split("/").pop();
        for (const ext of [".nef", ".manifest.json"]) {
          expected += 1;
          if (!tracked.has(`contracts/build/${project}${ext}`)) missing.push(`${project}${ext}`);
        }
      }
    }
    record(
      `contracts/${repoName}`,
      missing.length === 0,
      `${expected - missing.length}/${expected} compiled artifacts committed`,
      missing.length ? { missing: missing.slice(0, 10) } : {},
    );

    // The vendored DevPack must match the platform's canonical copy byte for byte.
    const devPack = path.join(dir, "contracts/MiniApp.DevPack");
    if (fs.existsSync(devPack)) {
      const drift = fs
        .readdirSync(devPack)
        .filter((f) => f.endsWith(".cs"))
        .filter((f) => {
          const upstream = path.join(REPOS.platform, "contracts/MiniApp.DevPack", f);
          return !fs.existsSync(upstream) || !fs.readFileSync(upstream).equals(fs.readFileSync(path.join(devPack, f)));
        });
      record(`devpack/${repoName}`, drift.length === 0, `${drift.length} files drifted from platform`, drift.length ? { drift } : {});
    }
  }
}

async function checkCatalog() {
  for (const [kind, repoName, planKey] of [
    ["minigames", "minigames", "neo-minigames"],
    ["miniapps", "miniapps", "neo-miniapps"],
  ]) {
    const dir = REPOS[repoName];
    if (!fs.existsSync(dir)) continue;

    let catalog;
    try {
      const response = await fetch(`${CDN}/catalog/${kind}.json`, {
        headers: { "user-agent": "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/140 Safari/537.36" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      catalog = await response.json();
    } catch (error) {
      record(`catalog/${kind}`, false, `fetch failed: ${error.message}`);
      continue;
    }

    const bySlug = new Map(catalog.apps.map((app) => [app.slug, app]));
    const problems = [];
    for (const app of plan().repos[planKey].apps) {
      const manifestPath = path.join(dir, "apps", app.slug, "neo-manifest.json");
      if (!fs.existsSync(manifestPath)) {
        problems.push(`${app.slug}: manifest missing from the repo`);
        continue;
      }
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      const entry = bySlug.get(app.slug);
      if (!entry) {
        problems.push(`${app.slug}: in the repo but not published`);
        continue;
      }
      if (entry.version !== String(manifest.version)) {
        problems.push(`${app.slug}: published ${entry.version}, repo has ${manifest.version}`);
      }
      if (entry.app_id !== String(manifest.id || `miniapp-${app.slug}`)) {
        problems.push(`${app.slug}: app_id ${entry.app_id} != manifest ${manifest.id}`);
      }
      const repoContracts = manifest.contracts && typeof manifest.contracts === "object" ? manifest.contracts : {};
      for (const [network, hash] of Object.entries(repoContracts)) {
        if (entry.contracts?.[network] !== hash) {
          problems.push(`${app.slug}: ${network} contract published as ${entry.contracts?.[network]}, repo says ${hash}`);
        }
      }
    }
    for (const slug of bySlug.keys()) {
      if (!plan().repos[planKey].apps.some((app) => app.slug === slug)) {
        problems.push(`${slug}: published but not in the repo`);
      }
    }
    record(
      `catalog/${kind}`,
      problems.length === 0,
      `${catalog.apps.length} published, ${plan().repos[planKey].apps.length} in repo, ${problems.length} mismatches`,
      problems.length ? { problems: problems.slice(0, 12) } : {},
    );
  }
}

function checkCdn() {
  try {
    execFileSync("node", [path.join(repoRoot, "scripts/verify-cdn-release.mjs")], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: "pipe",
    });
    record("cdn/release", true, "all published apps verified end to end");
  } catch (error) {
    const out = String(error.stdout || "");
    const match = out.match(/"failures": (\d+)/);
    record("cdn/release", false, match ? `${match[1]} failures` : error.message.slice(0, 100));
  }
}

async function main() {
  if (selected("repos")) checkRepos();
  if (selected("migrated")) checkMigrated();
  if (selected("sdk-package")) checkSdkPackage();
  if (selected("imports")) checkImports();
  if (selected("contracts")) checkContracts();
  if (selected("catalog")) await checkCatalog();
  if (selected("cdn")) checkCdn();

  const failed = results.filter((r) => !r.ok);
  if (asJson) {
    console.log(JSON.stringify({ checks: results.length, failed: failed.length, results }, null, 2));
  } else {
    console.log(`\n  ${results.length - failed.length}/${results.length} checks passed`);
    for (const failure of failed) {
      const extra = Object.entries(failure)
        .filter(([key]) => !["check", "ok", "detail"].includes(key))
        .map(([key, value]) => `\n      ${key}: ${JSON.stringify(value)}`)
        .join("");
      console.log(`    ${failure.check}: ${failure.detail}${extra}`);
    }
  }
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});

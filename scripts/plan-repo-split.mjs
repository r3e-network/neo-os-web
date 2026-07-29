#!/usr/bin/env node
/**
 * Repo-split planner.
 *
 * Produces a deterministic manifest describing which paths belong to each
 * target repository once the monorepo is broken up:
 *
 *   neo-miniapp-sdk  - framework/ + apps/shared (the app-facing SDK)
 *   neo-minigames    - apps/* with manifest category "games", their contracts,
 *                      contract tests, and per-app tests
 *   neo-miniapps     - every other app, same satellites
 *   platform         - whatever remains (host-app, admin-console, edge,
 *                      platform contracts, deploy tooling)
 *
 * The output is data, not action: `apply-repo-split.mjs` consumes it. Keeping
 * the decision in one auditable place is what makes the split reviewable and
 * repeatable, instead of a pile of one-off `git mv` calls.
 *
 * Usage:
 *   node scripts/plan-repo-split.mjs                 # write docs/split/plan.json
 *   node scripts/plan-repo-split.mjs --print         # also dump a summary
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const appsRoot = path.join(repoRoot, "apps");
const contractsRoot = path.join(repoRoot, "contracts");
const sharedTestRoot = path.join(appsRoot, "shared", "test");
const contractTestRoot = path.join(contractsRoot, "__tests__");

const GAME_CATEGORY = "games";
const NON_APP_DIRS = new Set(["shared"]);
const ARCHIVED_SLUGS = new Set(["flamingo", "flaminggo", "neoburger", "neo-burger"]);

/** Contract projects that belong to the platform, never to a single app. */
const PLATFORM_CONTRACT_PREFIXES = ["platform", "MiniApp.DevPack", "templates", "build", "__tests__"];
const PLATFORM_CONTRACT_DIRS = new Set([
  "AbstractAccountCoreMockFixture",
  "DeployerProbeFixture",
  "EngineMockFixture",
  "GameOracleMockFixture",
  "PlatformDeFiLegacyCreditFixture",
  "ReentrantEngineMockFixture",
  "RegistryMockFixture",
  "TarotOracleMockFixture",
  "MiniAppCredits",
]);

/**
 * Contract project -> app slug, for the cases a plain slug-ification of the
 * project name does not resolve. Keys are directory names under contracts/.
 */
const CONTRACT_SLUG_OVERRIDES = {
  MiniAppTarot: "on-chain-tarot",
  MiniAppTarotVrf: "on-chain-tarot",
  MiniAppTipJar: "dev-tipping",
  MiniAppBreakupPact: "breakup-contract",
  MiniAppMultisig: "neo-multisig",
  MiniAppCoinFlip: "dice-game",
  MiniAppCoinFlipV2: "dice-game",
  MiniAppDiceGameV2: "dice-game",
  MiniAppGasBox: "gasbox",
  MiniAppGasBoxV2: "gasbox",
  MiniAppGame2048: "game-2048",
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

function listDirs(root) {
  if (!exists(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function listFiles(root) {
  if (!exists(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();
}

/** `MiniAppSheepSolitaire` -> `sheep-solitaire`. */
function contractNameToSlug(dirName) {
  if (CONTRACT_SLUG_OVERRIDES[dirName]) return CONTRACT_SLUG_OVERRIDES[dirName];
  const stripped = dirName.replace(/^MiniApp/, "");
  return stripped
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

function collectApps() {
  const apps = [];
  for (const slug of listDirs(appsRoot)) {
    if (NON_APP_DIRS.has(slug) || ARCHIVED_SLUGS.has(slug)) continue;
    const manifestPath = path.join(appsRoot, slug, "neo-manifest.json");
    if (!exists(manifestPath)) continue;
    const manifest = readJson(manifestPath);
    const category = String(manifest.category || "").trim().toLowerCase();
    apps.push({
      slug,
      appId: String(manifest.id || `miniapp-${slug}`),
      name: String(manifest.name || slug),
      category,
      kind: category === GAME_CATEGORY ? "minigames" : "miniapps",
      version: String(manifest.version || "1.0.0"),
      dir: `apps/${slug}`,
    });
  }
  return apps;
}

/**
 * Per-app tests live in apps/shared/test as `<slug>.<kind>.test.ts`, not next to
 * the app, and they reach their app by relative path.
 *
 * Ownership is decided by what a test actually references, not by its filename:
 * several tests named after neither app nor runtime (anchor-ux-fixes,
 * console-kernel, price-feed-freshness, ...) do exercise app sources, and a
 * filename-only rule would have stranded them in the SDK repo where the code
 * they import no longer exists.
 *
 *   references exactly one repo's apps -> that repo
 *   references apps from both repos, or platform source -> stays in platform
 *   references no app at all -> SDK (it tests the shared runtime)
 *
 * String literals are scanned too, not just import specifiers, because some
 * tests assert on app or platform files they read with `readFileSync`.
 */
function scanReferences(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const slugs = new Set();
  let platform = false;
  // Repo-wide audits discover their subjects at runtime by walking the apps
  // directory rather than importing anything, so an import scan alone would
  // classify them as shared-runtime tests and strand them in the SDK repo where
  // there are no apps to audit.
  const traversesApps = /\bappsRoot\b|\bappsDir\b/.test(source);
  for (const match of source.matchAll(/["'`]\.\.\/\.\.\/([A-Za-z0-9._-]+)\//g)) {
    const segment = match[1];
    if (segment === "..") continue;
    slugs.add(segment);
  }
  // Both the relative form and a repo-root-relative one: a test may read
  // "platform/host-app/..." through a helper that already anchors the root, and
  // matching only "../platform/" let one such test slip into an app repo.
  for (const match of source.matchAll(/["'`](?:\.\.\/)*platform\/(?:host-app|admin-console|sdk|shared|edge)\//g)) {
    void match;
    platform = true;
  }
  return { slugs, platform, traversesApps };
}

function partitionSharedTests(apps) {
  const kindBySlug = new Map(apps.map((app) => [app.slug, app.kind]));
  const slugsByLength = [...kindBySlug.keys()].sort((a, b) => b.length - a.length);
  const perApp = new Map();
  const sdkTests = [];
  const platformTests = [];
  const conformanceTests = [];

  const assign = (slug, rel) => {
    if (!perApp.has(slug)) perApp.set(slug, []);
    perApp.get(slug).push(rel);
  };

  for (const fileName of listFiles(sharedTestRoot)) {
    const rel = `apps/shared/test/${fileName}`;
    const { slugs, platform, traversesApps } = scanReferences(path.join(sharedTestRoot, fileName));
    const appRefs = [...slugs].filter((slug) => kindBySlug.has(slug));
    const kinds = new Set(appRefs.map((slug) => kindBySlug.get(slug)));

    if (platform || kinds.size > 1) {
      platformTests.push({
        test: rel,
        reason: platform ? "asserts on platform source" : "spans both app repos",
        app_refs: appRefs.sort(),
      });
      continue;
    }

    if (appRefs.length > 0) {
      // Attribute to the longest matching slug in the filename when possible so
      // the test travels next to the app it is named for; otherwise to its only
      // referenced app.
      const named = slugsByLength.find((slug) => fileName.startsWith(`${slug}.`));
      assign(named && appRefs.includes(named) ? named : appRefs[0], rel);
      continue;
    }

    const named = slugsByLength.find((slug) => fileName.startsWith(`${slug}.`));
    if (named) {
      assign(named, rel);
      continue;
    }

    // Names no app and imports none, but walks the apps tree: a repo-wide
    // audit. It has to run where the apps live, so it goes to both app repos.
    if (traversesApps) {
      conformanceTests.push(rel);
      continue;
    }

    sdkTests.push(rel);
  }

  return { perApp, sdkTests, platformTests, conformanceTests };
}

function partitionContracts(apps) {
  const bySlug = new Map(apps.map((app) => [app.slug, app]));
  const perApp = new Map();
  const platformContracts = [];
  const unmatched = [];

  for (const dirName of listDirs(contractsRoot)) {
    if (PLATFORM_CONTRACT_PREFIXES.includes(dirName) || PLATFORM_CONTRACT_DIRS.has(dirName)) {
      platformContracts.push(`contracts/${dirName}`);
      continue;
    }
    if (!dirName.startsWith("MiniApp")) {
      platformContracts.push(`contracts/${dirName}`);
      continue;
    }
    const slug = contractNameToSlug(dirName);
    if (bySlug.has(slug)) {
      if (!perApp.has(slug)) perApp.set(slug, []);
      perApp.get(slug).push(`contracts/${dirName}`);
    } else {
      unmatched.push({ contract: `contracts/${dirName}`, derivedSlug: slug });
    }
  }

  return { perApp, platformContracts, unmatched };
}

function partitionContractTests(apps) {
  const bySlug = new Map(apps.map((app) => [app.slug, app]));
  const perApp = new Map();
  const platformTests = [];

  for (const fileName of listFiles(contractTestRoot)) {
    const match = fileName.match(/^MiniApp([A-Za-z0-9]+?)(?:Integration)?Tests\.cs$/);
    const rel = `contracts/__tests__/${fileName}`;
    if (!match) {
      platformTests.push(rel);
      continue;
    }
    const slug = contractNameToSlug(`MiniApp${match[1]}`);
    if (bySlug.has(slug)) {
      if (!perApp.has(slug)) perApp.set(slug, []);
      perApp.get(slug).push(rel);
    } else {
      platformTests.push(rel);
    }
  }

  return { perApp, platformTests };
}

function main() {
  const apps = collectApps();
  const {
    perApp: testsByApp,
    sdkTests,
    platformTests: sharedTestsStayingInPlatform,
    conformanceTests,
  } = partitionSharedTests(apps);
  const {
    perApp: contractsByApp,
    platformContracts,
    unmatched: unmatchedContracts,
  } = partitionContracts(apps);
  const { perApp: contractTestsByApp, platformTests } = partitionContractTests(apps);

  for (const app of apps) {
    app.tests = testsByApp.get(app.slug) || [];
    app.contracts = contractsByApp.get(app.slug) || [];
    app.contractTests = contractTestsByApp.get(app.slug) || [];
  }

  const plan = {
    generated_by: "scripts/plan-repo-split.mjs",
    repos: {
      "neo-miniapp-sdk": {
        description: "App-facing SDK: business framework + shared runtime",
        packages: {
          "framework": "framework",
          "shared": "apps/shared",
        },
        shared_runtime_tests: sdkTests,
        // Copied into both app repos: each audit walks the local apps/ tree, so
        // it needs to run where the apps actually live.
        cross_app_conformance_tests: conformanceTests,
      },
      "neo-minigames": {
        description: "Minigame miniapps, their contracts and tests",
        apps: apps.filter((app) => app.kind === "minigames"),
      },
      "neo-miniapps": {
        description: "Non-game miniapps, their contracts and tests",
        apps: apps.filter((app) => app.kind === "miniapps"),
      },
      "neo-os-web": {
        description: "Platform only: host, admin console, edge, platform contracts",
        keeps_contracts: platformContracts,
        keeps_contract_tests: platformTests,
        keeps_shared_tests: sharedTestsStayingInPlatform,
      },
    },
    counts: {
      apps_total: apps.length,
      minigames: apps.filter((app) => app.kind === "minigames").length,
      miniapps: apps.filter((app) => app.kind === "miniapps").length,
      sdk_shared_tests: sdkTests.length,
      cross_app_conformance_tests: conformanceTests.length,
      app_tests: apps.reduce((sum, app) => sum + app.tests.length, 0),
      app_contracts: apps.reduce((sum, app) => sum + app.contracts.length, 0),
      app_contract_tests: apps.reduce((sum, app) => sum + app.contractTests.length, 0),
      platform_contracts: platformContracts.length,
      platform_contract_tests: platformTests.length,
      shared_tests_staying_in_platform: sharedTestsStayingInPlatform.length,
    },
    warnings: {
      contracts_without_matching_app: unmatchedContracts,
      apps_without_contract: apps.filter((app) => app.contracts.length === 0).map((app) => app.slug),
      apps_without_tests: apps.filter((app) => app.tests.length === 0).map((app) => app.slug),
    },
  };

  const outDir = path.join(repoRoot, "docs", "split");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "plan.json");
  fs.writeFileSync(outPath, `${JSON.stringify(plan, null, 2)}\n`);

  if (process.argv.includes("--print")) {
    console.log(JSON.stringify({ counts: plan.counts, warnings: plan.warnings }, null, 2));
  }
  console.log(`[split-plan] wrote ${path.relative(repoRoot, outPath)}`);
}

main();

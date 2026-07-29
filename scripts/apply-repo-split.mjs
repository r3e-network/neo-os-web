#!/usr/bin/env node
/**
 * Materializes one of the split target repositories from docs/split/plan.json.
 *
 * Only git-tracked files are copied, so build output, node_modules, and
 * bin/obj never leak into the new repos, and a re-run over a clean checkout
 * produces identical output.
 *
 * Two structural facts drive the layout:
 *
 * 1. The 300 per-app test files live in apps/shared/test and reach their app by
 *    relative path (`../../<slug>/src`). They land in `apps/tests/unit/`, the
 *    same depth below apps/, so those imports keep resolving untouched. What
 *    does need rewriting is their `../<shared-dir>` imports, which used to mean
 *    apps/shared and now mean the SDK package.
 * 2. Import specifiers are rewritten with a specifier-aware matcher, never a
 *    blind string replace: several tests assert on import statements inside
 *    string literals (`expect(src).toContain('from "../static/coin.webp"')`),
 *    and a blind replace would corrupt those assertions.
 *
 * Usage:
 *   node scripts/apply-repo-split.mjs --repo neo-miniapp-sdk --out ..
 *   node scripts/apply-repo-split.mjs --repo neo-minigames   --out ..
 *   node scripts/apply-repo-split.mjs --repo neo-miniapps    --out ..
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  SDK_SCOPE,
  FRAMEWORK_PKG,
  SHARED_PKG,
  SHARED_DIRS,
  renderSdkFiles,
  renderAppRepoFiles,
} from "./lib/split-scaffold.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

function arg(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1 || index === process.argv.length - 1) return fallback;
  return process.argv[index + 1];
}

const targetRepo = arg("repo");
const outBase = path.resolve(repoRoot, arg("out", ".."));
const force = process.argv.includes("--force");

if (!targetRepo) {
  console.error("apply-repo-split: --repo <neo-miniapp-sdk|neo-minigames|neo-miniapps> is required");
  process.exit(2);
}

const plan = JSON.parse(fs.readFileSync(path.join(repoRoot, "docs", "split", "plan.json"), "utf8"));
const outDir = path.join(outBase, targetRepo);

/**
 * Cross-cutting parity tests the planner kept in the platform repo: they assert
 * on platform host source, or span both app repos, so they cannot travel with a
 * single app.
 */
const PLATFORM_BOUND_TESTS = new Set(
  (plan.repos["neo-os-web"].keeps_shared_tests || []).map((entry) => entry.test),
);

/**
 * Repo-wide audits that discover their subjects by walking the apps tree. They
 * go to both app repos rather than the SDK, since the SDK has no apps to audit.
 */
const CONFORMANCE_TESTS = plan.repos["neo-miniapp-sdk"].cross_app_conformance_tests || [];

function trackedFiles(pathspec) {
  const stdout = execFileSync("git", ["ls-files", "-z", "--", pathspec], {
    cwd: repoRoot,
    maxBuffer: 512 * 1024 * 1024,
  });
  return stdout.toString("utf8").split("\0").filter(Boolean).sort();
}

function copyTracked(pathspec, mapPath) {
  let copied = 0;
  for (const rel of trackedFiles(pathspec)) {
    const destRel = mapPath(rel);
    if (!destRel) continue;
    const dest = path.join(outDir, destRel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(repoRoot, rel), dest);
    copied += 1;
  }
  return copied;
}

function copyFile(srcRel, destRel) {
  const dest = path.join(outDir, destRel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(repoRoot, srcRel), dest);
}

function write(relPath, contents) {
  const dest = path.join(outDir, relPath);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, contents);
}

function walkFiles(root, extensions) {
  const out = [];
  if (!fs.existsSync(root)) return out;
  const stat = fs.statSync(root);
  if (stat.isFile()) return extensions.some((ext) => root.endsWith(ext)) ? [root] : [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full, extensions));
    else if (extensions.some((ext) => entry.name.endsWith(ext))) out.push(full);
  }
  return out;
}

/**
 * Matches only real module specifiers: `from "x"`, `import "x"`, `import("x")`,
 * `require("x")`, and vitest's `vi.mock("x")` family. Anything inside an
 * ordinary string stays untouched.
 */
const SPECIFIER_RE =
  /((?:\bfrom\s*|\bimport\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bvi\s*\.\s*(?:mock|doMock|unmock)\s*\(\s*)(['"]))([^'"\n]+)(\2)/g;

function rewriteSpecifiers(content, rules) {
  return content.replace(SPECIFIER_RE, (match, head, _quote, spec, tail) => {
    for (const [pattern, replacement] of rules) {
      if (pattern.test(spec)) return `${head}${spec.replace(pattern, replacement)}${tail}`;
    }
    return match;
  });
}

/** Applies specifier rules across a subtree; returns how many files changed. */
function transformImports(subPath, extensions, rules) {
  let changed = 0;
  for (const file of walkFiles(path.join(outDir, subPath), extensions)) {
    const before = fs.readFileSync(file, "utf8");
    const after = rewriteSpecifiers(before, rules);
    if (after !== before) {
      fs.writeFileSync(file, after);
      changed += 1;
    }
  }
  return changed;
}

/** Literal replacements, for structural edits to config files. */
function replaceLiterals(subPath, extensions, pairs) {
  let changed = 0;
  for (const file of walkFiles(path.join(outDir, subPath), extensions)) {
    const before = fs.readFileSync(file, "utf8");
    let after = before;
    for (const [from, to] of pairs) after = after.split(from).join(to);
    if (after !== before) {
      fs.writeFileSync(file, after);
      changed += 1;
    }
  }
  return changed;
}

function prepareOutDir() {
  if (fs.existsSync(outDir)) {
    const entries = fs.readdirSync(outDir).filter((name) => name !== ".git");
    if (entries.length > 0 && !force) {
      console.error(`apply-repo-split: ${outDir} is not empty (pass --force to rebuild it)`);
      process.exit(1);
    }
    for (const name of entries) fs.rmSync(path.join(outDir, name), { recursive: true, force: true });
  }
  fs.mkdirSync(outDir, { recursive: true });
}

const SHARED_DIR_GROUP = SHARED_DIRS.join("|");

// ---------------------------------------------------------------------------
// neo-miniapp-sdk
// ---------------------------------------------------------------------------

function buildSdk() {
  const appTests = new Set(
    ["neo-minigames", "neo-miniapps"].flatMap((repo) =>
      plan.repos[repo].apps.flatMap((app) => app.tests),
    ),
  );

  const frameworkFiles = copyTracked("framework", (rel) => rel);

  // apps/shared -> shared/, minus per-app tests, which belong to the app repos.
  // Platform-bound tests stay in the platform repo, so they are dropped here too.
  const conformance = new Set(CONFORMANCE_TESTS);
  const sharedFiles = copyTracked("apps/shared", (rel) => {
    if (appTests.has(rel) || PLATFORM_BOUND_TESTS.has(rel) || conformance.has(rel)) return null;
    return rel.replace(/^apps\/shared\//, "shared/");
  });

  // The NEP-21 provider was the one place shared/ reached back into
  // platform/sdk. It imports nothing, so it moves wholesale; the platform SDK
  // re-exports it from the package instead.
  copyFile("platform/sdk/src/nep21-provider.ts", "shared/neo/nep21-provider.ts");
  write(
    "shared/utils/nep21-provider.ts",
    "// Re-exported from the SDK-owned implementation. Kept as its own module so\n" +
      "// the long-standing `@shared/utils/nep21-provider` import path in apps keeps\n" +
      "// working after the provider moved out of the platform repo.\n" +
      'export * from "../neo/nep21-provider";\n',
  );

  const sharedAliased = transformImports("shared", [".ts", ".tsx"], [
    [/^\.\.\/\.\.\/\.\.\/framework(\/|$)/, "@framework$1"],
  ]);
  const frameworkAliased = transformImports("framework", [".ts", ".tsx"], [
    [/^\.\.\/\.\.\/apps\/shared(\/|$)/, "@shared$1"],
  ]);

  for (const [rel, contents] of Object.entries(renderSdkFiles())) write(rel, contents);

  return {
    framework_files: frameworkFiles,
    shared_files: sharedFiles,
    per_app_tests_excluded: appTests.size,
    platform_bound_tests_excluded: PLATFORM_BOUND_TESTS.size,
    conformance_tests_excluded: conformance.size,
    shared_framework_imports_aliased: sharedAliased,
    framework_shared_imports_aliased: frameworkAliased,
  };
}

// ---------------------------------------------------------------------------
// neo-minigames / neo-miniapps
// ---------------------------------------------------------------------------

function buildAppRepo(repoName) {
  const apps = plan.repos[repoName].apps;
  const kind = repoName === "neo-minigames" ? "minigames" : "miniapps";

  let appFiles = 0;
  let testFiles = 0;
  let contractFiles = 0;
  let contractTestFiles = 0;
  const leftBehindTests = [];

  for (const app of apps) {
    appFiles += copyTracked(app.dir, (rel) => rel);

    for (const test of app.tests) {
      if (PLATFORM_BOUND_TESTS.has(test)) {
        leftBehindTests.push(test);
        continue;
      }
      copyFile(test, test.replace(/^apps\/shared\/test\//, "apps/tests/unit/"));
      testFiles += 1;
    }

    for (const contract of app.contracts) {
      contractFiles += copyTracked(contract, (rel) => rel);
      // The compiled .nef/.manifest.json are tracked in the platform repo and
      // read by production-safety tests to pin the client against the deployed
      // ABI. They travel with the contract that produced them.
      const projectName = contract.split("/").pop();
      for (const ext of [".nef", ".manifest.json"]) {
        contractFiles += copyTracked(`contracts/build/${projectName}${ext}`, (rel) => rel);
      }
    }
    for (const contractTest of app.contractTests) {
      copyFile(contractTest, contractTest);
      contractTestFiles += 1;
    }
  }

  // Two app tests assert against the platform's published miniapp definition
  // (a production gate: guest mode stays available while GameFi is fail-closed).
  // The definition is platform-owned data, so it is pinned here as a fixture and
  // drift-checked, rather than the assertion being dropped.
  let hostFixtures = 0;
  for (const app of apps) {
    const definition = `platform/host-app/public/miniapp-definitions/${app.slug}.json`;
    if (!fs.existsSync(path.join(repoRoot, definition))) continue;
    const referenced = walkFiles(path.join(outDir, app.dir), [".ts", ".tsx"]).some((file) =>
      fs.readFileSync(file, "utf8").includes("miniapp-definitions"),
    );
    if (!referenced) continue;
    copyFile(definition, `${app.dir}/__fixtures__/host-definition.json`);
    replaceLiterals(app.dir, [".ts", ".tsx"], [
      [`../../../platform/host-app/public/miniapp-definitions/${app.slug}.json`, "../__fixtures__/host-definition.json"],
      [`../../platform/host-app/public/miniapp-definitions/${app.slug}.json`, "__fixtures__/host-definition.json"],
    ]);
    hostFixtures += 1;
  }

  let conformanceFiles = 0;
  for (const test of CONFORMANCE_TESTS) {
    copyFile(test, test.replace(/^apps\/shared\/test\//, "apps/tests/conformance/"));
    conformanceFiles += 1;
  }

  for (const config of [
    "apps/tsconfig.base.json",
    "apps/tsconfig.miniapp.json",
    "apps/tsconfig.miniapp.react.json",
    "apps/vite.shared.react.ts",
  ]) {
    copyTracked(config, (rel) => rel);
  }

  // Harness the per-app tests import as `../test-utils/...`; placing it at
  // apps/tests/test-utils keeps that relative path correct.
  copyTracked("apps/shared/test-utils", (rel) =>
    rel.replace(/^apps\/shared\/test-utils\//, "apps/tests/test-utils/"),
  );

  // MiniApp.DevPack is source-included by 7 app csprojs via
  // `<Compile Include="../MiniApp.DevPack/...">`; Neo contracts compile their
  // bases in rather than linking a package, so it is vendored at the same
  // relative position and drift-checked in CI.
  if (contractFiles > 0) {
    copyTracked("contracts/MiniApp.DevPack", (rel) => rel);
    copyTracked("contracts/Directory.Build.props", (rel) => rel);
    copyTracked("contracts/build.sh", (rel) => rel);
    copyTracked("contracts/__tests__/NeoContracts.Tests.csproj", (rel) => rel);
  }

  // Per-app tests: `../<shared-dir>` meant apps/shared, `../../../framework`
  // meant the repo root, and one test reached apps/shared as `../../shared`.
  const testsAliased = transformImports("apps/tests", [".ts", ".tsx"], [
    [/^\.\.\/\.\.\/\.\.\/framework(\/|$)/, "@framework$1"],
    [/^\.\.\/\.\.\/shared(\/|$)/, "@shared$1"],
    [new RegExp(`^\\.\\./(${SHARED_DIR_GROUP})(/|$)`), "@shared/$1$2"],
  ]);

  // Same three shapes can appear inside app sources.
  const appsAliased = transformImports("apps", [".ts", ".tsx", ".vue"], [
    [/^\.\.\/\.\.\/\.\.\/framework(\/|$)/, "@framework$1"],
    [/^\.\.\/\.\.\/\.\.\/shared(\/|$)/, "@shared$1"],
  ]);

  // @shared / @framework now resolve to the published SDK packages.
  // Stylesheets and per-app build configs that reached apps/shared by relative
  // path. Every other app already goes through the @shared alias; these kept the
  // sibling-directory form, which points at a placeholder after the split.
  const stylesRepointed = replaceLiterals("apps", [".scss"], [
    ['@use "../../shared/', '@use "@shared/'],
    ['@use "../shared/', '@use "@shared/'],
    ['@import "../../shared/', '@import "@shared/'],
    ['@import "../shared/', '@import "@shared/'],
  ]);
  const appConfigsRepointed = replaceLiterals("apps", [".ts"], [
    ['"../shared/shims/', `"../../node_modules/${SHARED_PKG}/shims/`],
    ['"../../shared/shims/', `"../../node_modules/${SHARED_PKG}/shims/`],
  ]);

  const viteRepointed = replaceLiterals("apps/vite.shared.react.ts", [".ts"], [
    [
      'import fs from "fs";',
      'import fs from "fs";\nimport { createRequire } from "node:module";',
    ],
    [
      'import path from "path";',
      'import path from "path";\n\nconst require = createRequire(import.meta.url);',
    ],
    [
      '  const sharedDir = path.resolve(rootDir, "shared");',
      `  // The shared runtime and framework ship as published SDK packages now, so\n` +
        `  // resolve them out of node_modules instead of a sibling monorepo path.\n` +
        `  const sharedDir = path.dirname(require.resolve("${SHARED_PKG}/package.json"));`,
    ],
    [
      '  const frameworkDir = path.resolve(rootDir, "..", "framework");',
      `  const frameworkDir = path.dirname(require.resolve("${FRAMEWORK_PKG}/package.json"));`,
    ],
    // One React copy for both bundling and tests. The SDK packages declare react
    // as a peer; a nested copy makes components render against a different React
    // than the caller - every hook then fails on a null dispatcher - and a
    // production bundle would ship React twice.
    [
      "    resolve: {\n      alias: [",
      '    resolve: {\n      dedupe: ["react", "react-dom"],\n      alias: [',
    ],
    [
      '        { find: "@", replacement: path.resolve(appDir, "src") },',
      '        { find: /^react$/, replacement: path.dirname(require.resolve("react/package.json", { paths: [rootDir] })) },\n' +
        '        { find: /^react-dom$/, replacement: path.dirname(require.resolve("react-dom/package.json", { paths: [rootDir] })) },\n' +
        '        { find: "@", replacement: path.resolve(appDir, "src") },',
    ],
  ]);

  const tsconfigsRepointed = replaceLiterals("apps", [".json"], [
    ['"@framework/*": ["../../framework/*"]', `"@framework/*": ["../../node_modules/${FRAMEWORK_PKG}/*"]`],
    ['"@shared/*": ["../shared/*"]', `"@shared/*": ["../../node_modules/${SHARED_PKG}/*"]`],
    ['"../shared/*"', `"../../node_modules/${SHARED_PKG}/*"`],
    ['"../../framework/*"', `"../../node_modules/${FRAMEWORK_PKG}/*"`],
  ]);

  for (const [rel, contents] of Object.entries(renderAppRepoFiles(repoName, kind, apps))) {
    write(rel, contents);
  }

  return {
    apps: apps.length,
    app_files: appFiles,
    per_app_test_files: testFiles,
    conformance_test_files: conformanceFiles,
    host_definition_fixtures: hostFixtures,
    tests_left_in_platform: leftBehindTests,
    contract_files: contractFiles,
    contract_test_files: contractTestFiles,
    test_imports_aliased: testsAliased,
    app_imports_aliased: appsAliased,
    styles_repointed: stylesRepointed,
    app_configs_repointed: appConfigsRepointed,
    vite_shared_repointed: viteRepointed,
    app_tsconfigs_repointed: tsconfigsRepointed,
  };
}

function main() {
  prepareOutDir();
  const summary = targetRepo === "neo-miniapp-sdk" ? buildSdk() : buildAppRepo(targetRepo);
  console.log(JSON.stringify({ repo: targetRepo, out: outDir, scope: SDK_SCOPE, ...summary }, null, 2));
}

main();

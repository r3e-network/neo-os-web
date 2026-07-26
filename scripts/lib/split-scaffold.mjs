/**
 * Scaffolding for the split target repositories.
 *
 * Every file the new repos need but the monorepo never had - package
 * manifests, per-repo tsconfig/vitest wiring, CI, and the R2 publish pipeline -
 * is rendered from here so the three repos stay consistent with each other.
 */

export const SDK_SCOPE = "@r3e-network";
export const FRAMEWORK_PKG = `${SDK_SCOPE}/neo-miniapp-framework`;
export const SHARED_PKG = `${SDK_SCOPE}/neo-miniapp-shared`;
export const SDK_VERSION = "2.2.0";

/** Top-level directories of the shared package, used to rewrite `../<dir>` imports. */
export const SHARED_DIRS = [
  "art",
  "assets",
  "components-react",
  "components",
  "composables",
  "constants",
  "factory",
  "locale",
  "neo",
  "react",
  "services",
  "shims",
  "styles",
  "templates",
  "types",
  "utils",
];

const LICENSE = `MIT License

Copyright (c) 2024 R3E-Network

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

const GITIGNORE = `node_modules/
dist/
build/
coverage/
.turbo/
*.tsbuildinfo

# .NET
bin/
obj/

# env / secrets
.env
.env.*
!.env.example

# tooling noise
.DS_Store
*.log
test-results/
playwright-report/
`;

const NPMRC = `${SDK_SCOPE}:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=\${NODE_AUTH_TOKEN}
`;

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

// ---------------------------------------------------------------------------
// neo-miniapp-sdk
// ---------------------------------------------------------------------------

export function renderSdkFiles() {
  const files = {};

  files["package.json"] = json({
    name: `${SDK_SCOPE}/neo-miniapp-sdk`,
    version: SDK_VERSION,
    private: true,
    description: "MiniApp SDK for the Neo MiniApps platform: business framework and shared app runtime",
    license: "MIT",
    repository: { type: "git", url: "git+https://github.com/r3e-network/neo-miniapp-sdk.git" },
    workspaces: ["framework", "shared"],
    scripts: {
      test: "npm run -s test:framework && npm run -s test:shared",
      "test:framework": "npm --workspace framework run test",
      "test:shared": "npm --workspace shared run test",
      typecheck: "tsc -p tsconfig.json --noEmit",
    },
    devDependencies: {
      // react/react-dom are pinned here on purpose: without them npm resolves
      // react 19 from @testing-library/react's loose peer range, which collides
      // with the packages' react@^18.3.1 peer and fails install outright.
      "@douyinfe/semi-ui": "^2.101.0",
      "@testing-library/react": "^16.3.2",
      "@testing-library/user-event": "^14.6.1",
      "@types/react": "^18.3.28",
      "@types/react-dom": "^18.3.7",
      "@vue/test-utils": "^2.4.6",
      ethers: "^6.16.0",
      glob: "^10.5.0",
      jsdom: "^25.0.1",
      "lucide-react": "^0.562.0",
      phaser: "^3.90.0",
      react: "^18.3.1",
      "react-dom": "^18.3.1",
      // The shared package ships .scss beside its components and vite 7
      // resolves .scss through sass-embedded.
      "sass-embedded": "^1.98.0",
      typescript: "^5.9.3",
      vite: "^7.3.6",
      vitest: "^4.1.0",
      vue: "^3.5.33",
    },
  });

  files["framework/package.json"] = json({
    name: FRAMEWORK_PKG,
    version: SDK_VERSION,
    description: "Business SDK surfaces exposed to Neo MiniApps as ctx.framework",
    license: "MIT",
    type: "module",
    main: "./index.ts",
    types: "./index.ts",
    exports: { ".": "./index.ts", "./*": "./*" },
    files: ["**/*.ts", "**/*.tsx", "!**/*.test.ts", "!**/*.test.tsx", "!test/**"],
    publishConfig: { registry: "https://npm.pkg.github.com" },
    repository: { type: "git", url: "git+https://github.com/r3e-network/neo-miniapp-sdk.git", directory: "framework" },
    dependencies: {
      "@noble/curves": "^1.2.0",
      "@noble/hashes": "^1.8.0",
    },
    peerDependencies: {
      "lucide-react": ">=0.5.0",
      phaser: "^3.90.0",
      react: "^18.3.1",
    },
    peerDependenciesMeta: {
      "lucide-react": { optional: true },
      phaser: { optional: true },
    },
    scripts: { test: "vitest run" },
  });

  files["shared/package.json"] = json({
    name: SHARED_PKG,
    version: SDK_VERSION,
    description: "Shared runtime for Neo MiniApps: components, composables, services, and chain helpers",
    license: "MIT",
    type: "module",
    main: "./components/index.ts",
    exports: { ".": "./components/index.ts", "./*": "./*" },
    files: ["**/*.ts", "**/*.tsx", "**/*.scss", "**/*.css", "**/*.json", "!**/*.test.ts", "!**/*.test.tsx", "!test/**"],
    publishConfig: { registry: "https://npm.pkg.github.com" },
    repository: { type: "git", url: "git+https://github.com/r3e-network/neo-miniapp-sdk.git", directory: "shared" },
    dependencies: {
      [FRAMEWORK_PKG]: SDK_VERSION,
    },
    peerDependencies: {
      "@douyinfe/semi-foundation": "^2.101.0",
      "@douyinfe/semi-ui": "^2.101.0",
      ethers: "^6.16.0",
      "lucide-react": ">=0.5.0",
      react: "^18.3.1",
      "react-dom": "^18.3.1",
    },
    peerDependenciesMeta: {
      "@douyinfe/semi-foundation": { optional: true },
      "@douyinfe/semi-ui": { optional: true },
      ethers: { optional: true },
      "lucide-react": { optional: true },
    },
    scripts: { test: "vitest run" },
  });

  files["tsconfig.base.json"] = json({
    compilerOptions: {
      target: "ESNext",
      module: "ESNext",
      moduleResolution: "bundler",
      lib: ["ESNext", "DOM"],
      jsx: "react-jsx",
      jsxImportSource: "react",
      strict: true,
      esModuleInterop: true,
      resolveJsonModule: true,
      isolatedModules: true,
      skipLibCheck: true,
      noEmit: true,
      // Both packages import Vite-transformed assets (`*.svg?url`) and read
      // import.meta.env, and the suites use vitest globals.
      types: ["vite/client", "vitest/globals"],
      baseUrl: ".",
      paths: {
        "@framework": ["./framework/index.ts"],
        "@framework/*": ["./framework/*"],
        "@shared": ["./shared/components/index.ts"],
        "@shared/*": ["./shared/*"],
      },
    },
  });

  files["tsconfig.json"] = json({
    extends: "./tsconfig.base.json",
    include: ["framework/**/*.ts", "framework/**/*.tsx", "shared/**/*.ts", "shared/**/*.tsx"],
    // Typecheck what the packages publish. The suites are verified by running
    // them and use fixture typing the published surface must not adopt - the
    // `files` field excludes them from the tarball for the same reason.
    exclude: [
      "node_modules",
      "**/node_modules",
      "**/test/**",
      "**/test-utils/**",
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/vitest.config.ts",
      "**/vitest.cross-repo.config.ts",
    ],
  });

  // Both packages carried a tsconfig extending a monorepo path
  // (../apps/tsconfig.miniapp.json) that does not exist here, which failed the
  // transform for every test file. Regenerate them against this repo's base.
  const packageTsconfig = (patterns) =>
    json({
      extends: "../tsconfig.base.json",
      compilerOptions: {
        baseUrl: "..",
        paths: {
          "@framework/*": ["framework/*"],
          "@shared/*": ["shared/*"],
        },
        types: ["vite/client", "vitest/globals"],
      },
      include: patterns,
      exclude: ["node_modules", "dist"],
    });
  files["framework/tsconfig.json"] = packageTsconfig(["**/*.ts", "**/*.tsx"]);
  files["shared/tsconfig.json"] = packageTsconfig(["**/*.ts", "**/*.tsx", "**/*.vue"]);

  // Both packages sit one level below the repo root now (they used to be
  // `framework/` and `apps/shared/`), so the vitest configs are regenerated
  // rather than carried over with their old `../..` root math.
  files["framework/vitest.config.ts"] = `import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(currentDir, "..");

export default defineConfig({
  root: currentDir,
  resolve: {
    alias: {
      "@framework": currentDir,
      "@shared": resolve(repoRoot, "shared"),
      phaser: resolve(repoRoot, "node_modules/phaser/dist/phaser.esm.js"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    setupFiles: [resolve(currentDir, "test/setup.ts")],
  },
});
`;

  files["shared/vitest.config.ts"] = `import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(currentDir, "..");

export default defineConfig({
  root: currentDir,
  resolve: {
    alias: {
      "@framework": resolve(repoRoot, "framework"),
      "@shared": currentDir,
      // No "@" alias on purpose: it means "this app's src" everywhere else, and
      // binding it here would silently resolve app imports to shared modules.
      phaser: resolve(repoRoot, "node_modules/phaser/dist/phaser.esm.js"),
    },
  },
  test: {
    testTimeout: 30_000,
    environment: "jsdom",
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    environmentOptions: { jsdom: { url: "http://localhost/" } },
    setupFiles: [resolve(currentDir, "test-utils/vitest-setup.ts")],
    server: {
      deps: {
        inline: ["@douyinfe/semi-icons", "@douyinfe/semi-ui", /@douyinfe\\/semi-foundation/],
      },
    },
  },
});
`;

  files[".github/workflows/ci.yml"] = `name: ci

on:
  push:
    branches: [master]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm install --no-audit --no-fund
      - run: npm run typecheck
      - run: npm test
`;

  files[".github/workflows/publish.yml"] = `name: publish

on:
  push:
    tags: ["v*"]
  workflow_dispatch:

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          registry-url: https://npm.pkg.github.com
          scope: "${SDK_SCOPE}"
      - run: npm install --no-audit --no-fund
      - run: npm test
      - run: npm publish --workspace framework
        env:
          NODE_AUTH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
      - run: npm publish --workspace shared
        env:
          NODE_AUTH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
`;

  files[".gitignore"] = GITIGNORE;
  files[".npmrc"] = NPMRC;
  files["LICENSE"] = LICENSE;
  files["README.md"] = `# neo-miniapp-sdk

The SDK every Neo MiniApp and MiniGame builds against. Split out of
[neo-miniapps-platform](https://github.com/r3e-network/neo-miniapps-platform) so
that the platform repo holds only platform code, and app repos depend on a
versioned SDK instead of a monorepo path.

## Packages

| Package | Path | Import alias | What it is |
| --- | --- | --- | --- |
| \`${FRAMEWORK_PKG}\` | \`framework/\` | \`@framework/*\` | Business SDK surfaces reached from an app as \`ctx.framework\` — chain, wallet, AA, credits, oracle, platform game/social/anchor/registry/defi/escrow/vesting, plus the Phaser game kernel. |
| \`${SHARED_PKG}\` | \`shared/\` | \`@shared/*\` | Shared app runtime — React and Vue components, composables, services, locale, chain constants, and the embedded host bridge. Depends on the framework. |

## Consumers

- \`neo-miniapps\` — non-game MiniApps
- \`neo-minigames\` — MiniGames
- \`neo-miniapps-platform\` — host app and admin console

Apps keep importing \`@shared/*\` and \`@framework/*\`; only what those aliases
point at changed. In an app repo they resolve into \`node_modules\`.

## Install

Both packages publish to GitHub Packages under the \`${SDK_SCOPE}\` scope, so a
consumer needs an \`.npmrc\` with:

\`\`\`
${SDK_SCOPE}:registry=https://npm.pkg.github.com
\`\`\`

Then:

\`\`\`bash
npm install ${FRAMEWORK_PKG} ${SHARED_PKG}
\`\`\`

Packages ship TypeScript source, not a build artifact. Consumers are bundlers
(Vite, Next) that compile the SDK alongside app code, which keeps the alias
imports, \`.scss\` assets, and tree-shaking working the way they did in the
monorepo.

## Tests

\`\`\`bash
npm test
\`\`\`

\`framework/test\` and \`shared/test\` cover the SDK itself. Tests that exercise a
specific app moved to that app's repo.
`;

  return files;
}

// ---------------------------------------------------------------------------
// neo-minigames / neo-miniapps
// ---------------------------------------------------------------------------

export function renderAppRepoFiles(repoName, kind, apps) {
  const files = {};
  const label = kind === "minigames" ? "MiniGames" : "MiniApps";
  const withContracts = apps.filter((app) => app.contracts.length > 0);

  files["package.json"] = json({
    name: `${SDK_SCOPE}/${repoName}`,
    version: "1.0.0",
    private: true,
    description: `Neo ${label} — app sources, contracts, and the CDN publish pipeline`,
    license: "MIT",
    repository: { type: "git", url: `git+https://github.com/r3e-network/${repoName}.git` },
    scripts: {
      build: "node scripts/build-all.mjs",
      test: "vitest run",
      // Repo-wide audits carried over from the monorepo. They still assume the
      // full app catalogue in places, so they report rather than gate until
      // their hardcoded app lists are made subset-tolerant.
      "test:conformance": "vitest run --dir apps/tests/conformance",
      "test:apps": "node scripts/run-app-tests.mjs",
      "publish:cdn": "node scripts/publish-bundles-r2.mjs",
      "publish:cdn:dry-run": "node scripts/publish-bundles-r2.mjs --dry-run",
      "check:devpack-drift": "node scripts/check-devpack-drift.mjs",
      "build:contracts": "bash contracts/build.sh",
    },
    dependencies: {
      [FRAMEWORK_PKG]: `^${SDK_VERSION}`,
      [SHARED_PKG]: `^${SDK_VERSION}`,
      "@cityofzion/neon-js": "^5.9.0",
      "@douyinfe/semi-ui": "^2.101.0",
      "@noble/curves": "^1.2.0",
      "@noble/hashes": "^1.8.0",
      // npm only publishes up to 0.3.6; the platform pins the r3e tarball, and
      // neo-convert / neo-multisig depend on APIs only in that build.
      "@r3e/neo-js-sdk":
        "https://codeload.github.com/r3e-network/neo-js-sdk/tar.gz/refs/tags/v0.3.7-r3e.1",
      bs58: "^6.0.0",
      "cannon-es": "^0.20.0",
      ethers: "^6.16.0",
      jspdf: "^4.2.1",
      "lucide-react": "^0.562.0",
      phaser: "^3.90.0",
      qrcode: "^1.5.4",
      react: "^18.3.1",
      "react-dom": "^18.3.1",
      three: "^0.169.0",
      vue: "^3.5.33",
    },
    devDependencies: {
      "@testing-library/react": "^16.3.2",
      "@testing-library/user-event": "^14.6.1",
      "@types/react": "^18.3.28",
      "@types/react-dom": "^18.3.7",
      "@vitejs/plugin-react": "^5.2.0",
      "@vue/test-utils": "^2.4.6",
      jsdom: "^25.0.1",
      sass: "^1.98.0",
      // Build-time only: the art-generation scripts rasterize source SVGs.
      sharp: "^0.35.3",
      terser: "^5.46.0",
      typescript: "^5.9.3",
      vite: "^7.3.6",
      "vite-plugin-node-polyfills": "^0.25.0",
      vitest: "^4.1.0",
    },
  });

  files["vitest.config.ts"] = `import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const repoRoot = dirname(fileURLToPath(import.meta.url));
const appsRoot = resolve(repoRoot, "apps");

/**
 * Per-app tests live in apps/tests/unit and reach their app by relative path
 * (\`../../<slug>/src/...\`) - the same depth below apps/ they had in the
 * monorepo, so those imports need no rewriting. @shared and @framework resolve
 * into node_modules now that the SDK is a published package.
 */
export default defineConfig({
  root: appsRoot,
  resolve: {
    alias: {
      "@framework": resolve(repoRoot, "node_modules/${FRAMEWORK_PKG}"),
      "@shared": resolve(repoRoot, "node_modules/${SHARED_PKG}"),
      phaser: resolve(repoRoot, "node_modules/phaser/dist/phaser.esm.js"),
    },
  },
  test: {
    testTimeout: 30_000,
    environment: "jsdom",
    // Only the tests this config actually owns. Apps that declare their own
    // \`test\` script bring their own vitest setup (asset stubs, audio and physics
    // shims), so those run in the app directory via \`npm run test:apps\` - the
    // same way the monorepo ran them.
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
    // apps/tests/conformance is excluded from the default run; see
    // "test:conformance" in package.json.
    exclude: ["**/node_modules/**", "**/dist/**", "tests/conformance/**"],
    environmentOptions: { jsdom: { url: "http://localhost/" } },
    setupFiles: [resolve(appsRoot, "tests/test-utils/vitest-setup.ts")],
    server: {
      deps: {
        inline: ["@douyinfe/semi-icons", "@douyinfe/semi-ui", /@douyinfe\\/semi-foundation/],
      },
    },
  },
});
`;

  files["scripts/build-all.mjs"] = `#!/usr/bin/env node
/**
 * Builds every app in this repo with Vite, in slug order.
 *
 * Each app is an independent SPA whose output is what gets published to the
 * CDN, so a failure in one app must not silently produce a partial release:
 * every failure is collected and the process exits non-zero.
 *
 * Usage:
 *   node scripts/build-all.mjs              # all apps
 *   node scripts/build-all.mjs game-2048    # selected apps
 */
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appsRoot = path.join(repoRoot, "apps");
const selected = new Set(process.argv.slice(2).filter((arg) => !arg.startsWith("-")));
const NON_APP_DIRS = new Set(["tests"]);

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function runBuild(appDir) {
  return new Promise((resolve) => {
    const child = spawn("npx", ["vite", "build"], { cwd: appDir, stdio: "pipe", env: process.env });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk.toString(); });
    child.stderr.on("data", (chunk) => { output += chunk.toString(); });
    child.on("close", (code) => resolve({ code, output }));
  });
}

const entries = await fs.readdir(appsRoot, { withFileTypes: true });
const apps = [];
for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
  if (!entry.isDirectory() || NON_APP_DIRS.has(entry.name)) continue;
  if (selected.size > 0 && !selected.has(entry.name)) continue;
  const appDir = path.join(appsRoot, entry.name);
  if (!(await exists(path.join(appDir, "neo-manifest.json")))) continue;
  apps.push({ slug: entry.name, appDir });
}

const failures = [];
for (const app of apps) {
  process.stdout.write(\`[build] \${app.slug}\\n\`);
  const result = await runBuild(app.appDir);
  if (result.code !== 0) {
    failures.push({ slug: app.slug, tail: result.output.split(/\\r?\\n/).slice(-40).join("\\n") });
    process.stdout.write(\`[build] \${app.slug} FAILED\\n\`);
  }
}

console.log(JSON.stringify({ built: apps.length - failures.length, failed: failures.length, failures }, null, 2));
if (failures.length > 0) process.exit(1);
`;

  files["scripts/run-app-tests.mjs"] = `#!/usr/bin/env node
/**
 * Aggregate runner for per-app test suites.
 *
 * Apps that declare their own \`test\` script own their vitest config - jsdom
 * mocks, asset stubs, physics and audio shims. Running those files from the
 * repo-level config instead would fail on setup the app config provides, so
 * each suite runs in its own directory exactly as it did in the monorepo.
 *
 * Suites run in parallel with bounded concurrency, output is buffered so logs
 * do not interleave, and every suite runs even if some fail - a failure is
 * reported by app name rather than reduced to an anonymous count.
 */
import { spawn } from "node:child_process";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "apps");
const NON_APP_DIRS = new Set(["tests"]);
const selected = new Set(process.argv.slice(2).filter((arg) => !arg.startsWith("-")));

function findAppsWithTests() {
  const out = [];
  for (const entry of readdirSync(appsDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || NON_APP_DIRS.has(entry.name)) continue;
    if (selected.size > 0 && !selected.has(entry.name)) continue;
    const pkgPath = path.join(appsDir, entry.name, "package.json");
    if (!existsSync(pkgPath)) continue;
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
      if (typeof pkg.scripts?.test === "string") {
        out.push({ name: entry.name, dir: path.join(appsDir, entry.name) });
      }
    } catch {
      // Unparseable package.json is a separate concern; skip rather than abort.
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

function runSuite(app) {
  return new Promise((resolve) => {
    const child = spawn("npm", ["test", "--silent"], { cwd: app.dir, stdio: ["ignore", "pipe", "pipe"] });
    const chunks = [];
    child.stdout.on("data", (d) => chunks.push(d));
    child.stderr.on("data", (d) => chunks.push(d));
    child.on("close", (code) =>
      resolve({ name: app.name, ok: code === 0, output: Buffer.concat(chunks).toString("utf8") }),
    );
  });
}

const apps = findAppsWithTests();
if (apps.length === 0) {
  console.log("[app-tests] no app declares a test script");
  process.exit(0);
}

const concurrency = Math.max(1, Math.min(apps.length, os.cpus().length - 1 || 1));
const queue = [...apps];
const failures = [];

async function worker() {
  for (;;) {
    const app = queue.shift();
    if (!app) return;
    const result = await runSuite(app);
    console.log(\`\\n===== \${result.name} \${result.ok ? "PASS" : "FAIL"} =====\`);
    if (!result.ok) {
      console.log(result.output);
      failures.push(result.name);
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, worker));

console.log(\`\\n[app-tests] \${apps.length - failures.length}/\${apps.length} suites passed\`);
if (failures.length > 0) {
  console.log(\`[app-tests] failing: \${failures.join(", ")}\`);
  process.exit(1);
}
`;

  files["scripts/publish-bundles-r2.mjs"] = renderR2Publisher(kind);

  if (withContracts.length > 0) {
    files["scripts/check-devpack-drift.mjs"] = `#!/usr/bin/env node
/**
 * contracts/MiniApp.DevPack is source-included by this repo's contract projects
 * (\`<Compile Include="../MiniApp.DevPack/...">\`) because Neo contracts compile
 * their base classes in rather than linking a DLL - there is no package form to
 * depend on. That means the DevPack is vendored here, and a vendored copy can
 * drift from the platform's canonical one.
 *
 * This compares every vendored file against neo-miniapps-platform@master and
 * fails on any difference, so drift surfaces in CI instead of at deploy time.
 */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const devPackDir = path.join(repoRoot, "contracts", "MiniApp.DevPack");
const RAW_BASE =
  process.env.DEVPACK_UPSTREAM_BASE ||
  "https://raw.githubusercontent.com/r3e-network/neo-miniapps-platform/master/contracts/MiniApp.DevPack";

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

const localNames = (await fs.readdir(devPackDir, { withFileTypes: true }))
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name)
  .sort();

const drift = [];
for (const name of localNames) {
  const local = await fs.readFile(path.join(devPackDir, name));
  const response = await fetch(\`\${RAW_BASE}/\${encodeURIComponent(name)}\`);
  if (!response.ok) {
    drift.push({ file: name, reason: \`upstream fetch failed with HTTP \${response.status}\` });
    continue;
  }
  const upstream = Buffer.from(await response.arrayBuffer());
  if (sha256(local) !== sha256(upstream)) {
    drift.push({ file: name, reason: "content differs from platform master" });
  }
}

console.log(JSON.stringify({ checked: localNames.length, drift_count: drift.length, drift }, null, 2));
if (drift.length > 0) process.exit(1);
`;
  }

  files[".github/workflows/ci.yml"] = `name: ci

on:
  push:
    branches: [master]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          registry-url: https://npm.pkg.github.com
          scope: "${SDK_SCOPE}"
      - run: npm install --no-audit --no-fund
        env:
          NODE_AUTH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
      - run: npm test
      - run: npm run test:apps
      - run: npm run build
${
  withContracts.length > 0
    ? `
  devpack-drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: node scripts/check-devpack-drift.mjs
`
    : ""
}`;

  files[".github/workflows/publish-cdn.yml"] = `name: publish-cdn

on:
  push:
    branches: [master]
    paths:
      - "apps/**"
  workflow_dispatch:
    inputs:
      slugs:
        description: "Space-separated slugs to publish (empty = all)"
        required: false
        default: ""

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          registry-url: https://npm.pkg.github.com
          scope: "${SDK_SCOPE}"
      - run: npm install --no-audit --no-fund
        env:
          NODE_AUTH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
      - run: npm run build -- \${{ github.event.inputs.slugs }}
      - run: npm run publish:cdn -- \${{ github.event.inputs.slugs }}
        env:
          CLOUDFLARE_API_TOKEN: \${{ secrets.CLOUDFLARE_API_TOKEN }}
          CF_API_TOKEN_ID: \${{ secrets.CF_API_TOKEN_ID }}
          CLOUDFLARE_ACCOUNT_ID: \${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          MINIAPP_R2_BUCKET: \${{ secrets.MINIAPP_R2_BUCKET }}
          MINIAPP_CDN_BASE_URL: \${{ secrets.MINIAPP_CDN_BASE_URL }}
`;

  files[".gitignore"] = GITIGNORE;
  files[".npmrc"] = NPMRC;
  files["LICENSE"] = LICENSE;
  files["README.md"] = renderAppRepoReadme(repoName, kind, label, apps, withContracts);

  return files;
}

function renderAppRepoReadme(repoName, kind, label, apps, withContracts) {
  const rows = apps
    .map((app) => `| \`${app.slug}\` | ${app.name} | ${app.category} | ${app.contracts.length > 0 ? app.contracts.map((c) => `\`${c.replace("contracts/", "")}\``).join(", ") : "shared platform contract" } |`)
    .join("\n");

  return `# ${repoName}

Neo ${label} — app sources, their contracts, and the pipeline that publishes
built bundles to the CDN. Split out of
[neo-miniapps-platform](https://github.com/r3e-network/neo-miniapps-platform),
which now holds only platform code and loads these apps from the CDN at runtime.

## Layout

\`\`\`
apps/<slug>/            one Vite SPA per app, with its neo-manifest.json
apps/tests/unit/        per-app tests (they reach their app by relative path)
apps/tests/test-utils/  shared vitest setup and SDK mocks
contracts/              per-app Neo N3 contracts + vendored MiniApp.DevPack
scripts/                build-all, CDN publisher, DevPack drift check
\`\`\`

## Apps (${apps.length})

| Slug | Name | Category | Contract |
| --- | --- | --- | --- |
${rows}

## Develop

\`\`\`bash
npm install
npm test
cd apps/<slug> && npx vite
\`\`\`

Apps import the SDK through the \`@shared/*\` and \`@framework/*\` aliases, which
resolve to [\`neo-miniapp-sdk\`](https://github.com/r3e-network/neo-miniapp-sdk)
in \`node_modules\`. Installing needs an \`.npmrc\` pointed at GitHub Packages for
the \`${SDK_SCOPE}\` scope (one is committed here).

## Publish to the CDN

\`\`\`bash
npm run build
npm run publish:cdn:dry-run     # prints the plan, uploads nothing
npm run publish:cdn
\`\`\`

Bundles land in R2 under an immutable, versioned prefix and a small mutable
pointer flips a release live:

\`\`\`
${kind}/<slug>/<version>/index.html          immutable, 1y
${kind}/<slug>/<version>/assets/*            immutable, 1y
${kind}/<slug>/<version>/neo-manifest.json   immutable, 1y
meta/${kind}/<slug>/latest.json              60s — the pointer the platform reads
catalog/${kind}.json                         60s — meta + logo for the launcher grid
\`\`\`

Because the version is in the path, a rollback is a pointer flip rather than a
re-upload, and the platform never has to bust an asset cache.

Credentials come from the environment (\`CLOUDFLARE_API_TOKEN\`,
\`CF_API_TOKEN_ID\`, \`CLOUDFLARE_ACCOUNT_ID\`, \`MINIAPP_R2_BUCKET\`); see
\`scripts/publish-bundles-r2.mjs\`.

${
  withContracts.length > 0
    ? `## Contracts

\`\`\`bash
npm run build:contracts
npm run check:devpack-drift
\`\`\`

\`contracts/MiniApp.DevPack\` is vendored: Neo contracts compile their base
classes in via \`<Compile Include>\` rather than linking a package, so there is
no dependency form to use. \`check:devpack-drift\` fails if the vendored copy
diverges from the platform's canonical one.
`
    : ""
}`;
}

// ---------------------------------------------------------------------------
// R2 publisher (emitted into each app repo)
// ---------------------------------------------------------------------------

function renderR2Publisher(kind) {
  return `#!/usr/bin/env node
/**
 * Publishes built app bundles to Cloudflare R2 and flips them live.
 *
 * Layout, and why:
 *
 *   ${kind}/<slug>/<version>/**            the bundle, immutable for a year
 *   meta/${kind}/<slug>/latest.json        the pointer, 60s
 *   catalog/${kind}.json                   meta + logo for the launcher, 60s
 *
 * Putting the version in the path makes every bundle object immutable: a new
 * build is a new URL, so nothing ever needs cache-busting and a rollback is a
 * pointer rewrite instead of a re-upload. The platform reads only the pointer
 * and the catalog, and never has to know how an app was built.
 *
 * Auth uses the R2 S3 API with a Cloudflare API token: access key id is the
 * token id, secret is the sha256 of the token value. That avoids minting a
 * separate pair of R2 access keys.
 *
 * Usage:
 *   node scripts/publish-bundles-r2.mjs [--dry-run] [slug ...]
 */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const KIND = ${JSON.stringify(kind)};
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appsRoot = path.join(repoRoot, "apps");
const NON_APP_DIRS = new Set(["tests"]);

const dryRun = process.argv.includes("--dry-run");
const selected = new Set(process.argv.slice(2).filter((arg) => !arg.startsWith("-")));

const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";
const POINTER_CACHE = "public, max-age=60, stale-while-revalidate=300";

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
};

function contentTypeFor(filePath) {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function requireEnv(name, fallback) {
  const value = String(process.env[name] || fallback || "").trim();
  if (!value) {
    console.error(\`publish-bundles-r2: \${name} is required\`);
    process.exit(2);
  }
  return value;
}

const accountId = dryRun ? String(process.env.CLOUDFLARE_ACCOUNT_ID || "dry-run") : requireEnv("CLOUDFLARE_ACCOUNT_ID");
const bucket = String(process.env.MINIAPP_R2_BUCKET || "miniapps").trim();
const cdnBase = String(process.env.MINIAPP_CDN_BASE_URL || "https://meshmini.app").trim().replace(/\\/+$/, "");
// OneGate opens apps through the platform's chrome-free /play route, never a raw
// CDN URL: the platform owns the wallet bridge, the sandbox policy, and the
// loading state, while the visitor still sees only the app itself.
const platformBase = String(process.env.MINIAPP_PLATFORM_BASE_URL || "https://neomini.app").trim().replace(/\\/+$/, "");
const apiToken = dryRun ? String(process.env.CLOUDFLARE_API_TOKEN || "") : requireEnv("CLOUDFLARE_API_TOKEN");
const tokenId = dryRun ? String(process.env.CF_API_TOKEN_ID || "") : requireEnv("CF_API_TOKEN_ID");

const accessKeyId = tokenId;
const secretAccessKey = apiToken ? crypto.createHash("sha256").update(apiToken, "utf8").digest("hex") : "";
const s3Host = \`\${accountId}.r2.cloudflarestorage.com\`;
const AWS_REGION = "auto";
const AWS_SERVICE = "s3";

function hmac(key, data) {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest();
}
function sha256hex(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}
function encodeRfc3986(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => \`%\${char.charCodeAt(0).toString(16).toUpperCase()}\`);
}

async function putObject(key, body, cacheControl) {
  const contentType = contentTypeFor(key);
  if (dryRun) return { key, bytes: body.length, contentType, cacheControl, uploaded: false };

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\\.\\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256hex(body);
  const canonicalUri = \`/\${[bucket, ...key.split("/")].map(encodeRfc3986).join("/")}\`;
  const headers = {
    "cache-control": cacheControl,
    "content-type": contentType,
    host: s3Host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  const signedHeaders = Object.keys(headers).sort().join(";");
  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map((name) => \`\${name}:\${String(headers[name]).trim()}\\n\`)
    .join("");
  const canonicalRequest = ["PUT", canonicalUri, "", canonicalHeaders, signedHeaders, payloadHash].join("\\n");
  const credentialScope = \`\${dateStamp}/\${AWS_REGION}/\${AWS_SERVICE}/aws4_request\`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, sha256hex(canonicalRequest)].join("\\n");
  const signingKey = hmac(hmac(hmac(hmac(\`AWS4\${secretAccessKey}\`, dateStamp), AWS_REGION), AWS_SERVICE), "aws4_request");
  const signature = crypto.createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");

  const response = await fetch(\`https://\${s3Host}\${canonicalUri}\`, {
    method: "PUT",
    headers: {
      ...headers,
      Authorization: \`AWS4-HMAC-SHA256 Credential=\${accessKeyId}/\${credentialScope}, SignedHeaders=\${signedHeaders}, Signature=\${signature}\`,
    },
    body,
  });
  if (!response.ok) {
    throw new Error(\`PUT \${key} failed: HTTP \${response.status} \${(await response.text()).slice(0, 300)}\`);
  }
  return { key, bytes: body.length, contentType, cacheControl, uploaded: true };
}

async function walk(dir, base = dir) {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(full, base)));
    } else if (entry.isFile()) {
      out.push(path.relative(base, full).split(path.sep).join("/"));
    }
  }
  return out.sort();
}

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function asString(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  return String(value).trim() || fallback;
}

function asArray(value) {
  return Array.isArray(value) ? value.map((entry) => String(entry).trim()).filter(Boolean) : [];
}

/**
 * OneGate wants a stable numeric dapp id. Manifests may pin one; otherwise
 * derive it from the app id with FNV-1a so it never moves between releases.
 */
function stableOneGateId(appId) {
  let hash = 2166136261;
  for (let index = 0; index < appId.length; index += 1) {
    hash ^= appId.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 1) || 1;
}

function resolveOneGateId(manifest, appId) {
  const onegate = manifest.onegate && typeof manifest.onegate === "object" ? manifest.onegate : {};
  const raw = asString(onegate.id || onegate.app_id || onegate.dapp_id);
  if (/^[1-9][0-9]{0,9}$/.test(raw)) return Number(raw);
  return stableOneGateId(appId);
}

function localizedJson(en, zh, ja) {
  const localized = { en: asString(en) };
  if (asString(zh) && asString(zh) !== asString(en)) localized.zh = asString(zh);
  if (asString(ja)) localized.ja = asString(ja);
  return JSON.stringify(localized);
}

async function main() {
  const entries = await fs.readdir(appsRoot, { withFileTypes: true });
  const published = [];
  const skipped = [];

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() || NON_APP_DIRS.has(entry.name)) continue;
    const slug = entry.name;
    if (selected.size > 0 && !selected.has(slug)) continue;

    const appDir = path.join(appsRoot, slug);
    const manifestPath = path.join(appDir, "neo-manifest.json");
    const distDir = path.join(appDir, "dist");
    if (!(await exists(manifestPath))) continue;
    if (!(await exists(path.join(distDir, "index.html")))) {
      skipped.push({ slug, reason: "missing dist/index.html - run npm run build first" });
      continue;
    }

    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    const appId = asString(manifest.id, \`miniapp-\${slug}\`);
    const version = asString(manifest.version, "1.0.0");
    const prefix = \`\${KIND}/\${slug}/\${version}\`;

    const files = await walk(distDir);
    let bytes = 0;
    for (const rel of files) {
      const body = await fs.readFile(path.join(distDir, rel));
      bytes += body.length;
      await putObject(\`\${prefix}/\${rel}\`, body, IMMUTABLE_CACHE);
    }
    // The manifest travels with the bundle so the platform can read an app's
    // declared contracts and permissions straight off the CDN.
    const manifestBody = Buffer.from(\`\${JSON.stringify(manifest, null, 2)}\\n\`, "utf8");
    await putObject(\`\${prefix}/neo-manifest.json\`, manifestBody, IMMUTABLE_CACHE);

    const entryUrl = \`\${cdnBase}/\${prefix}/index.html\`;
    const pointer = {
      app_id: appId,
      slug,
      kind: KIND,
      version,
      entry_url: entryUrl,
      base_url: \`\${cdnBase}/\${prefix}\`,
      manifest_url: \`\${cdnBase}/\${prefix}/neo-manifest.json\`,
      file_count: files.length + 1,
      bytes,
      published_at: new Date().toISOString(),
    };
    await putObject(
      \`meta/\${KIND}/\${slug}/latest.json\`,
      Buffer.from(\`\${JSON.stringify(pointer, null, 2)}\\n\`, "utf8"),
      POINTER_CACHE,
    );

    published.push({ manifest, pointer });
    process.stdout.write(\`[publish] \${slug}@\${version} \${files.length + 1} files \${(bytes / 1024).toFixed(0)}KB\\n\`);
  }

  // The catalog is what the launcher renders before anything is loaded, so it
  // carries meta and artwork only - never a bundle URL the grid would fetch.
  const catalogApps = published.map(({ manifest, pointer }) => {
    const urls = manifest.urls && typeof manifest.urls === "object" ? manifest.urls : {};
    const developer = manifest.developer && typeof manifest.developer === "object" ? manifest.developer : {};
    const iconUrl = \`\${pointer.base_url}/\${asString(urls.icon, "logo.webp").replace(/^\\.?\\//, "")}\`;
    const bannerUrl = \`\${pointer.base_url}/\${asString(urls.banner, "banner.webp").replace(/^\\.?\\//, "")}\`;
    const onegateId = resolveOneGateId(manifest, pointer.app_id);
    return {
      app_id: pointer.app_id,
      slug: pointer.slug,
      kind: KIND,
      name: asString(manifest.name, pointer.slug),
      name_zh: asString(manifest.name_zh) || undefined,
      name_ja: asString(manifest.name_ja) || undefined,
      description: asString(manifest.description),
      description_zh: asString(manifest.description_zh) || undefined,
      description_ja: asString(manifest.description_ja) || undefined,
      category: asString(manifest.category, "utility"),
      tags: Array.from(new Set(asArray(manifest.tags))),
      version: pointer.version,
      icon_url: iconUrl,
      banner_url: bannerUrl,
      entry_url: pointer.entry_url,
      manifest_url: pointer.manifest_url,
      supported_networks: asArray(manifest.supported_networks),
      default_network: asString(manifest.default_network),
      contracts: manifest.contracts && typeof manifest.contracts === "object" ? manifest.contracts : {},
      onegate: {
        id: onegateId,
        isActive: true,
        name: localizedJson(manifest.name, manifest.name_zh, manifest.name_ja),
        url: \`\${platformBase}/play/\${pointer.slug}\`,
        iconUrl,
        tags: Array.from(new Set(asArray(manifest.tags))),
        developer: asString(developer.name, "R3E Network").slice(0, 32),
        previews: [bannerUrl],
      },
    };
  });

  if (selected.size === 0 && catalogApps.length > 0) {
    const catalog = {
      generated_at: new Date().toISOString(),
      source: \`neo-\${KIND}\`,
      kind: KIND,
      cdn_base_url: cdnBase,
      count: catalogApps.length,
      apps: catalogApps,
    };
    await putObject(
      \`catalog/\${KIND}.json\`,
      Buffer.from(\`\${JSON.stringify(catalog, null, 2)}\\n\`, "utf8"),
      POINTER_CACHE,
    );
  }

  console.log(
    JSON.stringify(
      {
        kind: KIND,
        dry_run: dryRun,
        cdn_base_url: cdnBase,
        bucket,
        published: published.length,
        catalog_written: selected.size === 0 && catalogApps.length > 0,
        skipped,
      },
      null,
      2,
    ),
  );

  if (skipped.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
`;
}

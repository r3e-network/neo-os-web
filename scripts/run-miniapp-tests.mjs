#!/usr/bin/env node
/**
 * Aggregate runner for per-miniapp test suites under apps/*.
 *
 * Walks every directory in apps/ (skipping shared/host-app/admin-console),
 * detects ones that declare a `test` script in their package.json, and runs
 * each suite sequentially. Fails the process on the first non-zero exit.
 *
 * The miniapp coverage audit found that only neo-x-bridge and on-chain-tarot
 * have any test files today. This runner ensures any future per-miniapp
 * tests are picked up automatically without further wiring.
 */

import { execSync } from "node:child_process";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APPS_DIR = path.resolve(__dirname, "..", "apps");

const NON_MINIAPP_DIRS = new Set(["shared", "host-app", "admin-console"]);

function findMiniappsWithTests() {
  const out = [];
  for (const entry of readdirSync(APPS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (NON_MINIAPP_DIRS.has(entry.name)) continue;
    const pkgPath = path.join(APPS_DIR, entry.name, "package.json");
    if (!existsSync(pkgPath)) continue;
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
      if (pkg.scripts && typeof pkg.scripts.test === "string") {
        out.push({ name: entry.name, dir: path.join(APPS_DIR, entry.name) });
      }
    } catch {
      // ignore unparseable package.json — covered by miniapp-bundles.coverage.test.ts
    }
  }
  return out;
}

const targets = findMiniappsWithTests();
if (targets.length === 0) {
  console.log("no per-miniapp test suites detected — nothing to run");
  process.exit(0);
}

let failed = 0;
for (const t of targets) {
  console.log(`\n=== ${t.name} ===`);
  try {
    execSync("npm test --silent", { cwd: t.dir, stdio: "inherit" });
  } catch {
    failed += 1;
  }
}

console.log(`\n${targets.length - failed}/${targets.length} miniapp test suites passed`);
process.exit(failed > 0 ? 1 : 0);

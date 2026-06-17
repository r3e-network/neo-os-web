#!/usr/bin/env node
/**
 * Aggregate runner for per-miniapp test suites under apps/*.
 *
 * Walks every directory in apps/ (skipping shared/host-app/admin-console),
 * detects ones that declare a `test` script in their package.json, and runs
 * the independent suites in parallel with a bounded concurrency. Every suite
 * runs even if some fail; the process exits non-zero and lists the failing
 * app names so a failure is never reduced to an anonymous "N-1/N passed".
 *
 * This runner ensures any future per-miniapp tests are picked up
 * automatically without further wiring.
 */

import { spawn } from "node:child_process";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import os from "node:os";
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

/**
 * Run one miniapp's test suite. Output is buffered (not inherited) so that
 * concurrently-running suites don't interleave their logs; the captured
 * output is printed under the app's banner once the suite finishes. Resolves
 * to { name, ok, output } — never rejects — so a failure is reported by app
 * name instead of being swallowed.
 */
function runSuite(t) {
  return new Promise((resolve) => {
    const child = spawn("npm", ["test", "--silent"], {
      cwd: t.dir,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const chunks = [];
    child.stdout.on("data", (d) => chunks.push(d));
    child.stderr.on("data", (d) => chunks.push(d));
    child.on("error", (err) => {
      chunks.push(Buffer.from(`failed to launch test runner: ${err.message}\n`));
      resolve({ name: t.name, ok: false, output: Buffer.concat(chunks).toString("utf8") });
    });
    child.on("close", (code) => {
      resolve({ name: t.name, ok: code === 0, output: Buffer.concat(chunks).toString("utf8") });
    });
  });
}

/**
 * Run the given suites with a bounded number in flight at once. Independent
 * suites run in parallel (each is its own `npm test` in its own dir); the
 * concurrency cap keeps memory/CPU sane on CI and laptops alike.
 */
async function runWithConcurrency(items, limit) {
  const results = [];
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const item = items[next++];
      console.log(`\n=== ${item.name} ===`);
      const result = await runSuite(item);
      if (result.output.trim()) {
        process.stdout.write(result.output.endsWith("\n") ? result.output : `${result.output}\n`);
      }
      results.push(result);
    }
  }
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function main() {
  const targets = findMiniappsWithTests();
  if (targets.length === 0) {
    console.log("no per-miniapp test suites detected — nothing to run");
    process.exit(0);
  }

  // Independent suites — cap concurrency to keep resource use predictable.
  const concurrency = Math.max(1, Math.min(targets.length, os.cpus()?.length || 4));
  const results = await runWithConcurrency(targets, concurrency);

  const failures = results.filter((r) => !r.ok).map((r) => r.name).sort();
  const passed = targets.length - failures.length;
  console.log(`\n${passed}/${targets.length} miniapp test suites passed`);
  if (failures.length > 0) {
    console.error(`\nFAILED miniapp test suites (${failures.length}): ${failures.join(", ")}`);
    process.exit(1);
  }
  process.exit(0);
}

main();

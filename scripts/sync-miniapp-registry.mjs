// sync-miniapp-registry.mjs
//
// Auto-generates platform/host-app/data/miniapps.json from all
// miniapps/{name}/neo-manifest.json files.
//
// Usage:
//   node scripts/sync-miniapp-registry.mjs            # write + summary
//   node scripts/sync-miniapp-registry.mjs --dry-run   # preview only

import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  parseManifest,
  normalizeCategory,
  permissionsToFlags,
  contractsToChainContracts,
  rewriteUrl,
  VALID_CATEGORIES,
  SKIP_DIRS,
} from "./miniapp-manifest-schema.mjs";

// ── ANSI colors (no deps) ─────────────────────────────────────────────
const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
};

// ── Paths ─────────────────────────────────────────────────────────────
const SCRIPT_DIR = fileURLToPath(new URL(".", import.meta.url));
const PROJECT_ROOT = resolve(SCRIPT_DIR, "..");
const MINIAPPS_DIR = join(PROJECT_ROOT, "miniapps");
const OUTPUT_PATH = join(
  PROJECT_ROOT,
  "platform",
  "host-app",
  "data",
  "miniapps.json",
);

/** Ordered category keys for the output JSON. */
const CATEGORY_ORDER = [
  "gaming",
  "defi",
  "social",
  "nft",
  "governance",
  "utility",
];

// ── CLI flags ─────────────────────────────────────────────────────────
const dryRun = process.argv.includes("--dry-run");

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Determine news_integration value.
 * - Has real contract addresses → null
 * - No contracts at all → false
 */
function resolveNewsIntegration(contracts) {
  if (!contracts || Object.keys(contracts).length === 0) return false;
  const hasReal = Object.values(contracts).some(
    (addr) => typeof addr === "string" && addr.length > 0,
  );
  return hasReal ? null : false;
}

/**
 * Transform a parsed manifest into a registry app entry.
 */
function manifestToRegistryEntry(data) {
  const category = normalizeCategory(data.category);
  const chainContracts = contractsToChainContracts(data.contracts);
  const hasContracts =
    Object.keys(chainContracts).length > 0 &&
    Object.values(chainContracts).some((c) => c.active);

  return {
    app_id: data.id,
    name: data.name,
    name_zh: data.name_zh,
    description: data.description,
    description_zh: data.description_zh,
    icon: rewriteUrl(data.urls.icon),
    banner: rewriteUrl(data.urls.banner),
    entry_url: rewriteUrl(data.urls.entry),
    category,
    status: "active",
    supportedChains: data.supported_networks || ["neo-n3-mainnet"],
    chainContracts: hasContracts ? chainContracts : {},
    permissions: permissionsToFlags(data.permissions),
    limits: null,
    stats_display: null,
    news_integration: resolveNewsIntegration(data.contracts),
  };
}

// ── Main ──────────────────────────────────────────────────────────────

async function scanManifests() {
  const entries = await readdir(MINIAPPS_DIR, { withFileTypes: true });
  const dirs = entries
    .filter((e) => e.isDirectory() && !SKIP_DIRS.includes(e.name))
    .map((e) => e.name)
    .sort();

  const apps = [];
  const errors = [];

  for (const dir of dirs) {
    const manifestPath = join(MINIAPPS_DIR, dir, "neo-manifest.json");
    const result = await parseManifest(manifestPath).catch(() => null);

    if (!result) {
      errors.push({ dir, reason: "file not found or unreadable" });
      continue;
    }
    if (!result.success) {
      errors.push({ dir, reason: result.error.issues[0]?.message || "validation failed" });
      continue;
    }

    apps.push(manifestToRegistryEntry(result.data));
  }

  return { apps, errors };
}

function groupByCategory(apps) {
  const grouped = {};
  for (const cat of CATEGORY_ORDER) {
    grouped[cat] = [];
  }

  for (const app of apps) {
    const cat = app.category;
    if (!grouped[cat]) {
      grouped[cat] = [];
    }
    grouped[cat].push(app);
  }

  // Sort alphabetically within each category
  for (const cat of Object.keys(grouped)) {
    grouped[cat].sort((a, b) => a.name.localeCompare(b.name));
  }

  return grouped;
}

async function loadExistingRegistry() {
  try {
    const raw = await readFile(OUTPUT_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function computeDiff(oldRegistry, newRegistry) {
  const added = [];
  const removed = [];
  const changed = [];

  const oldIds = new Set();
  const newIds = new Set();

  if (oldRegistry) {
    for (const cat of Object.keys(oldRegistry)) {
      for (const app of oldRegistry[cat]) {
        oldIds.add(app.app_id);
      }
    }
  }

  for (const cat of Object.keys(newRegistry)) {
    for (const app of newRegistry[cat]) {
      newIds.add(app.app_id);
      if (!oldIds.has(app.app_id)) {
        added.push(app.app_id);
      }
    }
  }

  if (oldRegistry) {
    for (const id of oldIds) {
      if (!newIds.has(id)) {
        removed.push(id);
      }
    }
  }

  // Detect changed apps (same id, different content)
  if (oldRegistry) {
    const oldMap = new Map();
    for (const cat of Object.keys(oldRegistry)) {
      for (const app of oldRegistry[cat]) {
        oldMap.set(app.app_id, app);
      }
    }
    for (const cat of Object.keys(newRegistry)) {
      for (const app of newRegistry[cat]) {
        const old = oldMap.get(app.app_id);
        if (old && JSON.stringify(old) !== JSON.stringify(app)) {
          changed.push(app.app_id);
        }
      }
    }
  }

  return { added, removed, changed };
}

function printSummary(registry, diff, errors) {
  let total = 0;
  for (const cat of Object.keys(registry)) {
    total += registry[cat].length;
  }

  console.log(
    `\n${C.bold}${C.cyan}Miniapp Registry Sync${C.reset}`,
  );
  console.log(`${C.dim}${"─".repeat(50)}${C.reset}`);

  // Per-category counts
  for (const cat of CATEGORY_ORDER) {
    const count = (registry[cat] || []).length;
    console.log(`  ${C.bold}${cat}${C.reset}: ${count} apps`);
  }
  console.log(`${C.dim}${"─".repeat(50)}${C.reset}`);
  console.log(`  ${C.bold}Total${C.reset}: ${total} apps\n`);

  // Diff
  if (diff.added.length > 0) {
    console.log(`${C.green}+ Added (${diff.added.length}):${C.reset}`);
    for (const id of diff.added) {
      console.log(`  ${C.green}+ ${id}${C.reset}`);
    }
  }
  if (diff.removed.length > 0) {
    console.log(`${C.red}- Removed (${diff.removed.length}):${C.reset}`);
    for (const id of diff.removed) {
      console.log(`  ${C.red}- ${id}${C.reset}`);
    }
  }
  if (diff.changed.length > 0) {
    console.log(
      `${C.yellow}~ Changed (${diff.changed.length}):${C.reset}`,
    );
    for (const id of diff.changed) {
      console.log(`  ${C.yellow}~ ${id}${C.reset}`);
    }
  }
  if (
    diff.added.length === 0 &&
    diff.removed.length === 0 &&
    diff.changed.length === 0
  ) {
    console.log(`${C.dim}  No changes detected.${C.reset}`);
  }

  // Errors
  if (errors.length > 0) {
    console.log(
      `\n${C.red}${C.bold}Errors (${errors.length}):${C.reset}`,
    );
    for (const e of errors) {
      console.log(`  ${C.red}! ${e.dir}: ${e.reason}${C.reset}`);
    }
  }
}

async function main() {
  const { apps, errors } = await scanManifests();
  const registry = groupByCategory(apps);
  const existing = await loadExistingRegistry();
  const diff = computeDiff(existing, registry);

  if (dryRun) {
    console.log(
      `\n${C.bold}${C.yellow}[DRY RUN]${C.reset} No files will be written.\n`,
    );
    printSummary(registry, diff, errors);
    process.exit(errors.length > 0 ? 1 : 0);
  }

  const json = JSON.stringify(registry, null, 2) + "\n";
  await writeFile(OUTPUT_PATH, json, "utf-8");

  printSummary(registry, diff, errors);
  console.log(
    `\n${C.green}${C.bold}Wrote${C.reset} ${OUTPUT_PATH.replace(PROJECT_ROOT + "/", "")}`,
  );

  if (errors.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`${C.red}Fatal: ${err.message}${C.reset}`);
  process.exit(1);
});

/**
 * validate-miniapps.mjs
 *
 * Validates all miniapps have correct structure and consistent data.
 * Checks: manifest existence, schema validation, required files,
 *         registry sync, orphan entries, index page template conventions,
 *         contract address format.
 *
 * Usage: node scripts/validate-miniapps.mjs
 * Exit:  0 = all pass, 1 = any fail
 */

import { readdir, stat, readFile } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  parseManifest,
  SKIP_DIRS,
  REQUIRED_FILES,
} from "./miniapp-manifest-schema.mjs";

// ── Paths ─────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const MINIAPPS_DIR = join(ROOT, "miniapps");
const REGISTRY_PATH = join(
  ROOT,
  "platform",
  "host-app",
  "data",
  "miniapps.json",
);

// ── ANSI helpers ──────────────────────────────────────────────────────

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};

const ok = (msg) => console.log(`  ${c.green}\u2705 ${msg}${c.reset}`);
const fail = (msg) => console.log(`  ${c.red}\u274C ${msg}${c.reset}`);
const warn = (msg) => console.log(`  ${c.yellow}\u26A0\uFE0F  ${msg}${c.reset}`);
const heading = (step, total, label) =>
  console.log(`\n${c.cyan}[${step}/${total}]${c.reset} ${c.bold}${label}${c.reset}`);

// ── Utilities ─────────────────────────────────────────────────────────

async function getMiniappDirs() {
  const entries = await readdir(MINIAPPS_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && !SKIP_DIRS.includes(e.name))
    .map((e) => e.name)
    .sort();
}

async function fileExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

const CONTRACT_RE = /^(0x[0-9a-fA-F]{40}|)$/;

// ── Checks ────────────────────────────────────────────────────────────

const TOTAL_CHECKS = 7;
let failures = 0;

async function checkManifestExistence(dirs) {
  heading(1, TOTAL_CHECKS, "Checking manifest existence...");
  const missing = [];

  for (const dir of dirs) {
    const manifestPath = join(MINIAPPS_DIR, dir, "neo-manifest.json");
    if (!(await fileExists(manifestPath))) {
      missing.push(dir);
    }
  }

  if (missing.length === 0) {
    ok(`${dirs.length}/${dirs.length} miniapps have neo-manifest.json`);
  } else {
    failures++;
    for (const m of missing) {
      fail(`${m}: missing neo-manifest.json`);
    }
    ok(
      `${dirs.length - missing.length}/${dirs.length} miniapps have neo-manifest.json`,
    );
  }

  return missing;
}

async function checkManifestSchemas(dirs, missingManifests) {
  heading(2, TOTAL_CHECKS, "Validating manifest schemas...");
  const validDirs = dirs.filter((d) => !missingManifests.includes(d));
  const errors = [];
  const manifestIds = new Map();

  for (const dir of validDirs) {
    const manifestPath = join(MINIAPPS_DIR, dir, "neo-manifest.json");
    const result = await parseManifest(manifestPath);
    if (result.success) {
      manifestIds.set(dir, result.data.id);
    } else {
      errors.push({ dir, issues: result.error.issues });
    }
  }

  if (errors.length === 0) {
    ok(`${validDirs.length}/${validDirs.length} manifests pass schema validation`);
  } else {
    failures++;
    for (const e of errors) {
      const details = e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
      fail(`${e.dir}: ${details}`);
    }
  }

  return manifestIds;
}

async function checkRequiredFiles(dirs) {
  heading(3, TOTAL_CHECKS, "Checking required files...");
  const issues = [];

  for (const dir of dirs) {
    const base = join(MINIAPPS_DIR, dir);
    for (const file of REQUIRED_FILES) {
      if (!(await fileExists(join(base, file)))) {
        issues.push({ dir, file });
      }
    }
  }

  if (issues.length === 0) {
    ok(`${dirs.length}/${dirs.length} miniapps have all required files`);
  } else {
    failures++;
    for (const { dir, file } of issues) {
      warn(`${dir}: missing ${file}`);
    }
  }
}

async function checkRegistrySync(manifestIds) {
  heading(4, TOTAL_CHECKS, "Checking registry sync...");

  let registry;
  try {
    const raw = await readFile(REGISTRY_PATH, "utf-8");
    registry = JSON.parse(raw);
  } catch (err) {
    failures++;
    fail(`Cannot read registry: ${err.message}`);
    return;
  }

  // Flatten all app_id values from registry
  const registryIds = new Set();
  for (const category of Object.values(registry)) {
    if (!Array.isArray(category)) continue;
    for (const entry of category) {
      if (entry.app_id) registryIds.add(entry.app_id);
    }
  }

  // Manifest ids from parsed manifests
  const manifestIdSet = new Set(manifestIds.values());

  const inManifestNotRegistry = [...manifestIdSet].filter(
    (id) => !registryIds.has(id),
  );
  const inRegistryNotManifest = [...registryIds].filter(
    (id) => !manifestIdSet.has(id),
  );

  if (inManifestNotRegistry.length === 0 && inRegistryNotManifest.length === 0) {
    ok("Registry is in sync with manifests");
  } else {
    failures++;
    for (const id of inManifestNotRegistry) {
      warn(`In manifests but not in registry: ${id}`);
    }
    for (const id of inRegistryNotManifest) {
      warn(`In registry but not in manifests: ${id}`);
    }
  }

  return { registryIds, manifestIdSet };
}

async function checkOrphanEntries(manifestIds) {
  heading(5, TOTAL_CHECKS, "Checking for orphan entries...");

  let registry;
  try {
    const raw = await readFile(REGISTRY_PATH, "utf-8");
    registry = JSON.parse(raw);
  } catch {
    // Already reported in check 4
    return;
  }

  // Build set of known app_ids from parsed manifests
  const knownIds = new Set(manifestIds.values());
  const orphans = [];

  for (const category of Object.values(registry)) {
    if (!Array.isArray(category)) continue;
    for (const entry of category) {
      if (entry.app_id && !knownIds.has(entry.app_id)) {
        orphans.push(entry.app_id);
      }
    }
  }

  if (orphans.length === 0) {
    ok("No orphan entries found");
  } else {
    failures++;
    for (const id of orphans) {
      fail(`Orphan registry entry (no directory): ${id}`);
    }
  }
}

function hasNamedImport(source, importName) {
  const importPattern = new RegExp(
    `import\\s*\\{[^}]*\\b${importName}\\b[^}]*\\}\\s*from\\s*["'][^"']+["']`,
    "m",
  );
  return importPattern.test(source);
}

async function checkIndexPageTemplateConventions(dirs) {
  heading(6, TOTAL_CHECKS, "Checking index page template conventions...");
  const issues = [];

  for (const dir of dirs) {
    const indexPagePath = join(MINIAPPS_DIR, dir, "src", "pages", "index", "index.vue");
    if (!(await fileExists(indexPagePath))) {
      issues.push({ dir, issue: "missing src/pages/index/index.vue" });
      continue;
    }

    let source;
    try {
      source = await readFile(indexPagePath, "utf-8");
    } catch (err) {
      issues.push({ dir, issue: `cannot read index page: ${err.message}` });
      continue;
    }

    const usesSharedTemplate = /<\s*(MiniAppTemplate|MiniAppShell)\b/.test(source);
    if (!usesSharedTemplate) {
      issues.push({ dir, issue: "index page does not use <MiniAppTemplate> or <MiniAppShell>" });
    }

    const hasSharedTemplateImport =
      hasNamedImport(source, "MiniAppTemplate") || hasNamedImport(source, "MiniAppShell");
    if (!hasSharedTemplateImport) {
      issues.push({ dir, issue: "index page does not import MiniAppTemplate or MiniAppShell" });
    }

    const hasTemplateConfigImport =
      hasNamedImport(source, "createTemplateConfig") ||
      hasNamedImport(source, "createTemplateConfigFromPreset") ||
      hasNamedImport(source, "createPrimaryStatsTemplateConfig");

    if (!hasTemplateConfigImport) {
      issues.push({
        dir,
        issue:
          "index page does not import createTemplateConfig, createTemplateConfigFromPreset, or createPrimaryStatsTemplateConfig",
      });
    }
  }

  if (issues.length === 0) {
    ok(
      `${dirs.length}/${dirs.length} miniapps index pages use MiniAppTemplate/MiniAppShell and import shared template config helpers`,
    );
  } else {
    failures++;
    for (const { dir, issue } of issues) {
      fail(`${dir}: ${issue}`);
    }
  }
}

async function checkContractAddresses(dirs, missingManifests) {
  heading(7, TOTAL_CHECKS, "Validating contract addresses...");
  const validDirs = dirs.filter((d) => !missingManifests.includes(d));
  const issues = [];

  for (const dir of validDirs) {
    const manifestPath = join(MINIAPPS_DIR, dir, "neo-manifest.json");
    let json;
    try {
      const raw = await readFile(manifestPath, "utf-8");
      json = JSON.parse(raw);
    } catch {
      continue; // Already caught in schema check
    }

    const contracts = json.contracts || {};
    for (const [network, address] of Object.entries(contracts)) {
      if (!CONTRACT_RE.test(address)) {
        issues.push({ dir, network, address });
      }
    }
  }

  if (issues.length === 0) {
    ok("All contract addresses are valid format");
  } else {
    failures++;
    for (const { dir, network, address } of issues) {
      fail(`${dir}: invalid contract address for ${network}: "${address}"`);
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${c.bold}\uD83D\uDD0D Validating miniapps...${c.reset}`);

  const dirs = await getMiniappDirs();

  const missingManifests = await checkManifestExistence(dirs);
  const manifestIds = await checkManifestSchemas(dirs, missingManifests);
  await checkRequiredFiles(dirs);
  await checkRegistrySync(manifestIds);
  await checkOrphanEntries(manifestIds);
  await checkIndexPageTemplateConventions(dirs);
  await checkContractAddresses(dirs, missingManifests);

  // Summary
  console.log(
    `\n${c.dim}\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501${c.reset}`,
  );

  if (failures === 0) {
    console.log(
      `${c.green}\u2705 All checks passed (${dirs.length} miniapps validated)${c.reset}\n`,
    );
    process.exit(0);
  } else {
    console.log(
      `${c.red}\u274C ${failures} check(s) failed - see above for details${c.reset}\n`,
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`${c.red}Fatal error: ${err.message}${c.reset}`);
  process.exit(1);
});

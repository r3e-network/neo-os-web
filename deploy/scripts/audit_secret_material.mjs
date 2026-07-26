#!/usr/bin/env node
/**
 * Audit: no Neo key material anywhere in the working tree.
 *
 * Problem this solves:
 *   Audit finding C-6 (2026-05-19) records a testnet WIF committed in
 *   3423e507. That key was published, so it stays compromised and must be
 *   rotated no matter what the repo looks like today; the lever that remains is
 *   preventing the next one. Nothing in the repo pulled that lever:
 *   `.gitleaks.toml` dropped its dedicated Neo WIF rule on
 *   the theory that "the generic API rules above will also flag suspicious
 *   keys", which is false for this shape. Every generic rule needs a keyword
 *   (`aws`, `api_key`, `password`, `Bearer`, `eyJ`) within a few characters of
 *   the match, and a bare 52-character base58 WIF supplies none. gitleaks is
 *   also neither installed nor referenced from .github, so that config never
 *   executes in the first place.
 *
 *   This gate closes the hole with no new dependency: it scans every file git
 *   would let you commit — tracked plus untracked-and-unignored — for Neo
 *   private-key encodings, and fails the build on a hit.
 *
 *   Scope is the working tree, not history. History was rewritten separately to
 *   strip the leaked material, but a rewrite only covers refs that can be
 *   force-updated: read-only refs such as GitHub's `refs/pull/*` keep the old
 *   commits reachable until the host garbage-collects them. So a history-scoped
 *   gate would fail on state this repo cannot change, and rotation — not
 *   scanning — is what actually contains an already-published key.
 *
 * Usage:
 *   node deploy/scripts/audit_secret_material.mjs            # report
 *   node deploy/scripts/audit_secret_material.mjs --check    # non-zero on hit
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ALLOWED_SECRET_VALUES,
  SECRET_RULES,
  scanTextForSecretMaterial,
} from "./lib/secret_material_scan.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Extensions whose contents cannot meaningfully hold a pasted key and which are
 * expensive or noisy to read as text. Everything else is scanned, including
 * files with no extension.
 */
const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".ico", ".bmp",
  ".mp3", ".mp4", ".wav", ".ogg", ".webm", ".mov",
  ".woff", ".woff2", ".ttf", ".otf", ".eot",
  ".zip", ".gz", ".tgz", ".bz2", ".xz", ".7z", ".rar",
  ".pdf", ".wasm", ".nef", ".dll", ".so", ".dylib", ".exe", ".node",
  ".pyc", ".class", ".jar", ".bin", ".dat", ".db", ".sqlite",
]);

/** A single pasted key is ~52 bytes; no plausible carrier is 4 MB of text. */
const MAX_FILE_BYTES = 4 * 1024 * 1024;

/**
 * Files git would accept in a commit: tracked, plus untracked ones that
 * .gitignore does not exclude. Using git rather than a hand-rolled walker means
 * the gate's idea of "in the repo" cannot drift from git's.
 *
 * @param {string} root
 * @returns {string[]} Repo-relative paths, sorted.
 */
export function committableFiles(root = ROOT) {
  const stdout = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  return stdout.split("\0").filter((entry) => entry.length > 0).sort();
}

/**
 * @param {string} absolutePath
 * @returns {boolean} True when the file should be read as text and scanned.
 */
function isScannable(absolutePath) {
  if (BINARY_EXTENSIONS.has(path.extname(absolutePath).toLowerCase())) return false;
  let stat;
  try {
    stat = fs.statSync(absolutePath);
  } catch {
    // Raced deletion, or a tracked path that is not materialised locally.
    return false;
  }
  if (!stat.isFile() || stat.size === 0 || stat.size > MAX_FILE_BYTES) return false;
  return true;
}

/**
 * Reject files whose leading bytes contain NUL. Extension lists always lag
 * reality, and decoding a binary as UTF-8 produces replacement characters that
 * can only generate false positives.
 *
 * @param {Buffer} buffer
 * @returns {boolean}
 */
function looksBinary(buffer) {
  return buffer.subarray(0, 4096).includes(0);
}

/**
 * @typedef {object} SecretMaterialReport
 * @property {number} scannedFiles Files read as text.
 * @property {number} skippedFiles Files excluded as binary or oversized.
 * @property {Array<{file: string, ruleId: string, description: string, line: number, column: number, redacted: string}>} violations
 * @property {string[]} allowedValues Value allowlist in force, redacted.
 * @property {boolean} gitleaksRuleRestored Whether .gitleaks.toml also covers the WIF shape.
 */

/**
 * Scan the working tree for Neo key material.
 *
 * @param {string} [root]
 * @returns {SecretMaterialReport}
 */
export function auditSecretMaterial(root = ROOT) {
  const violations = [];
  let scannedFiles = 0;
  let skippedFiles = 0;

  for (const relativePath of committableFiles(root)) {
    const absolutePath = path.join(root, relativePath);
    if (!isScannable(absolutePath)) {
      skippedFiles += 1;
      continue;
    }

    let buffer;
    try {
      buffer = fs.readFileSync(absolutePath);
    } catch {
      skippedFiles += 1;
      continue;
    }
    if (looksBinary(buffer)) {
      skippedFiles += 1;
      continue;
    }

    scannedFiles += 1;
    for (const finding of scanTextForSecretMaterial(buffer.toString("utf8"))) {
      violations.push({ file: relativePath, ...finding });
    }
  }

  return {
    scannedFiles,
    skippedFiles,
    violations,
    allowedValues: ALLOWED_SECRET_VALUES.map(
      (value) => `${value.slice(0, 4)}… (published test vector)`,
    ),
    gitleaksRuleRestored: gitleaksCoversWif(root),
  };
}

/**
 * Whether `.gitleaks.toml` still carries a rule for the Neo WIF shape.
 *
 * This gate is the enforced one, but the gitleaks config is what a security
 * reviewer reads first. Letting the two disagree is how the original rule came
 * to be deleted, so the report states the answer instead of assuming it.
 *
 * @param {string} root
 * @returns {boolean}
 */
function gitleaksCoversWif(root) {
  const configPath = path.join(root, ".gitleaks.toml");
  if (!fs.existsSync(configPath)) return false;
  const config = fs.readFileSync(configPath, "utf8");
  return config.includes("[KL][1-9A-HJ-NP-Za-km-z]{51}");
}

function main() {
  const strict = process.argv.slice(2).includes("--check");
  const report = auditSecretMaterial();

  console.log(
    JSON.stringify(
      {
        scanned_files: report.scannedFiles,
        skipped_files: report.skippedFiles,
        rules: SECRET_RULES.map((rule) => ({ id: rule.id, description: rule.description })),
        allowed_values: report.allowedValues,
        gitleaks_rule_restored: report.gitleaksRuleRestored,
        violations: report.violations,
      },
      null,
      2,
    ),
  );

  const notes = [];
  if (!report.gitleaksRuleRestored) {
    notes.push(
      ".gitleaks.toml has no Neo WIF rule; the shape this repo actually leaks is invisible to it",
    );
  }

  if (report.violations.length === 0 && notes.length === 0) {
    console.log(
      `[audit_secret_material] no Neo key material in ${report.scannedFiles} scanned files`,
    );
    return;
  }

  const summary = [
    `[audit_secret_material] ${report.violations.length} key-material occurrence(s)`,
    `across ${new Set(report.violations.map((v) => v.file)).size} file(s)`,
    notes.length > 0 ? `| ${notes.join("; ")}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (strict) {
    console.error(summary);
    process.exit(1);
  }
  console.warn(summary);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

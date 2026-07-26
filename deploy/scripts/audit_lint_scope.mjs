#!/usr/bin/env node
/**
 * Lint-scope audit.
 *
 * Problem this solves: the repository maintains two independent exclusion
 * lists — `.gitignore` (what git refuses to track) and the `ignores` array in
 * `eslint.config.mjs` (what eslint refuses to inspect). Nothing kept them in
 * agreement, so they drifted: generated vite output in the per-app
 * `dist-device-qa` directories was git-ignored but still linted, and the
 * minified bundles inside it produced thousands of meaningless errors that
 * buried the real findings.
 *
 * The invariant enforced here is narrow and checkable: eslint must never
 * report a problem in a file that git ignores. Generated output is not source
 * code, so a lint finding inside it is noise by construction. Any future
 * addition to `.gitignore` that eslint does not also exclude re-breaks this
 * gate immediately, which is what keeps the two lists from drifting again.
 *
 * Usage:
 *   node deploy/scripts/audit_lint_scope.mjs            # report
 *   node deploy/scripts/audit_lint_scope.mjs --check    # exit 1 on violation
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Maximum bytes of eslint JSON we are willing to buffer. */
const MAX_BUFFER = 256 * 1024 * 1024;

/**
 * Run `eslint . -f json` and return the parsed result array.
 *
 * eslint exits non-zero whenever it reports an error, so a non-zero status is
 * expected and not itself a failure. A missing/unparseable payload is a real
 * failure, because it means we cannot assess the invariant at all.
 *
 * @returns {Array<{filePath: string, messages: Array<{ruleId: string|null, severity: number, line?: number, message: string}>}>}
 */
function runEslint() {
  const result = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["eslint", ".", "-f", "json"],
    { cwd: ROOT, encoding: "utf8", maxBuffer: MAX_BUFFER },
  );

  if (result.error) {
    throw new Error(`failed to spawn eslint: ${result.error.message}`);
  }

  const stdout = (result.stdout || "").trim();
  if (!stdout) {
    throw new Error(
      `eslint produced no JSON output (exit ${result.status}): ${(result.stderr || "").trim() || "no stderr"}`,
    );
  }

  // eslint may prepend warnings (e.g. deprecation notices) before the JSON
  // array. Recover by parsing from the first "[".
  const firstBracket = stdout.indexOf("[");
  if (firstBracket < 0) {
    throw new Error(`eslint output contained no JSON array: ${stdout.slice(0, 400)}`);
  }

  try {
    return JSON.parse(stdout.slice(firstBracket));
  } catch (err) {
    throw new Error(
      `could not parse eslint JSON output: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Partition absolute file paths into those git ignores and those it does not.
 *
 * `git check-ignore --stdin` is the authority here rather than a re-implemented
 * glob matcher: it applies the same precedence rules (negations, nested
 * .gitignore files, exclude files) that git itself does. Exit code 1 means "no
 * path was ignored", which is a valid answer and not an error.
 *
 * @param {string[]} files absolute paths
 * @returns {Set<string>} the subset of `files` that git ignores
 */
function selectGitIgnored(files) {
  if (files.length === 0) return new Set();

  const result = spawnSync("git", ["check-ignore", "--stdin"], {
    cwd: ROOT,
    input: `${files.join("\n")}\n`,
    encoding: "utf8",
    maxBuffer: MAX_BUFFER,
  });

  if (result.error) {
    throw new Error(`failed to spawn git check-ignore: ${result.error.message}`);
  }
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(
      `git check-ignore failed (exit ${result.status}): ${(result.stderr || "").trim()}`,
    );
  }

  const ignored = new Set();
  for (const line of (result.stdout || "").split("\n")) {
    const trimmed = line.trim();
    if (trimmed) ignored.add(path.resolve(ROOT, trimmed));
  }
  return ignored;
}

/**
 * Assess the lint-scope invariant.
 *
 * @returns {{
 *   filesWithMessages: number,
 *   errorCount: number,
 *   warningCount: number,
 *   violations: Array<{file: string, errorCount: number, warningCount: number}>,
 *   violationErrorCount: number,
 *   violationWarningCount: number,
 * }}
 */
export function auditLintScope() {
  const results = runEslint();

  const reported = results.filter(
    (entry) => Array.isArray(entry.messages) && entry.messages.length > 0,
  );

  const ignored = selectGitIgnored(reported.map((entry) => entry.filePath));

  const violations = [];
  let errorCount = 0;
  let warningCount = 0;
  let violationErrorCount = 0;
  let violationWarningCount = 0;

  for (const entry of reported) {
    const errors = entry.messages.filter((m) => m.severity === 2).length;
    const warnings = entry.messages.filter((m) => m.severity === 1).length;
    errorCount += errors;
    warningCount += warnings;

    if (!ignored.has(path.resolve(entry.filePath))) continue;

    violationErrorCount += errors;
    violationWarningCount += warnings;
    violations.push({
      file: path.relative(ROOT, entry.filePath),
      errorCount: errors,
      warningCount: warnings,
    });
  }

  violations.sort(
    (a, b) => b.errorCount + b.warningCount - (a.errorCount + a.warningCount),
  );

  return {
    filesWithMessages: reported.length,
    errorCount,
    warningCount,
    violations,
    violationErrorCount,
    violationWarningCount,
  };
}

function main() {
  const strict = process.argv.slice(2).includes("--check");
  const report = auditLintScope();

  console.log(
    JSON.stringify(
      {
        files_with_messages: report.filesWithMessages,
        error_count: report.errorCount,
        warning_count: report.warningCount,
        git_ignored_files_linted: report.violations.length,
        git_ignored_error_count: report.violationErrorCount,
        git_ignored_warning_count: report.violationWarningCount,
        violations: report.violations.slice(0, 20),
      },
      null,
      2,
    ),
  );

  if (report.violations.length === 0) {
    console.log("[audit_lint_scope] eslint reports no problems in git-ignored files.");
    return;
  }

  const summary =
    `[audit_lint_scope] eslint reported ${report.violationErrorCount} error(s) and ` +
    `${report.violationWarningCount} warning(s) across ${report.violations.length} ` +
    `git-ignored file(s). Generated output must be excluded in eslint.config.mjs ` +
    `so the lint gate only reports real source code.`;

  if (strict) {
    console.error(summary);
    process.exit(1);
  }
  console.warn(summary);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

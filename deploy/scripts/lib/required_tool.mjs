// External command-line tools that a verification gate depends on.
//
// A gate that quietly skips itself when its tool is absent is worse than no
// gate at all: the run still reports green, so the absence reads as a pass.
// That is exactly how an unquoted expansion or an unkilled listener reaches
// master. On a developer machine a skip is a reasonable convenience -- the
// tool can be installed later and the rest of the suite still runs. In CI it
// is a lie, so there the missing tool is a failure and the workflow has to
// install it.
//
// Resolution scans the search path itself rather than shelling out to
// `command -v` or `<tool> --version`: no subprocess, no shell quoting, no
// assumption that the tool supports a version flag, and an injectable
// environment so the behaviour is unit-testable.

import fs from "node:fs";
import path from "node:path";

// Values that mean "this is automation" rather than "a person is watching".
// GitHub Actions sets both CI and GITHUB_ACTIONS; other runners set CI alone.
const CI_TRUTHY = new Set(["1", "true", "yes", "on"]);
const CI_VARIABLES = ["CI", "GITHUB_ACTIONS", "CONTINUOUS_INTEGRATION"];

function assertToolName(name) {
  if (typeof name !== "string" || name.trim() === "") {
    throw new TypeError("tool name must be a non-empty string");
  }
  if (name !== name.trim() || /[\s]/.test(name)) {
    throw new TypeError(`tool name must not contain whitespace: ${JSON.stringify(name)}`);
  }
  if (name.includes("/") || name.includes(path.sep) || name === "." || name === "..") {
    throw new TypeError(`tool name must not contain a path separator: ${JSON.stringify(name)}`);
  }
}

function isExecutableFile(candidate) {
  let stats;
  try {
    stats = fs.statSync(candidate);
  } catch {
    return false;
  }
  if (!stats.isFile()) {
    return false;
  }
  try {
    fs.accessSync(candidate, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve `name` against the PATH in `env`, in search-path order.
 *
 * @param {string} name bare executable name, no directory component
 * @param {Record<string, string | undefined>} [env]
 * @returns {string | null} absolute path to the executable, or null when absent
 */
export function findTool(name, env = process.env) {
  assertToolName(name);
  const searchPath = env?.PATH ?? "";
  for (const entry of searchPath.split(path.delimiter)) {
    if (entry === "") {
      continue;
    }
    const candidate = path.resolve(entry, name);
    if (isExecutableFile(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * True when the process is running under automation, where a skipped gate
 * would be reported as a pass.
 *
 * @param {Record<string, string | undefined>} [env]
 * @returns {boolean}
 */
export function isContinuousIntegration(env = process.env) {
  return CI_VARIABLES.some((variable) => CI_TRUTHY.has(String(env?.[variable] ?? "").toLowerCase()));
}

/**
 * Resolve a tool a test depends on: return its path when installed, skip the
 * test when it is missing on a developer machine, and throw when it is missing
 * under CI so the gate cannot pass by omission.
 *
 * @param {{ skip: (reason?: string) => void }} context node:test context
 * @param {string} name bare executable name
 * @param {{ env?: Record<string, string | undefined>, purpose?: string }} [options]
 * @returns {string | null} the resolved path, or null when the test was skipped
 */
export function requireTool(context, name, options = {}) {
  if (typeof context?.skip !== "function") {
    throw new TypeError("requireTool needs a node:test context exposing skip()");
  }
  const env = options.env ?? process.env;
  const resolved = findTool(name, env);
  if (resolved !== null) {
    return resolved;
  }

  const purpose = options.purpose ? ` (needed to ${options.purpose})` : "";
  const reason = `${name} is not installed${purpose}`;
  if (isContinuousIntegration(env)) {
    throw new Error(
      `${reason}. CI must run this gate rather than skip it: install ${name} in the workflow.`,
    );
  }
  context.skip(`${reason}; install it to run this gate locally`);
  return null;
}

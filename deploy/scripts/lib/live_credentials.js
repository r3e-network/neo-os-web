"use strict";

/**
 * Single missing-credential policy for live validators and fuzz/sim suites
 * (MP-W3-09).
 *
 * When a required credential env var is missing the process exits NON-ZERO so
 * CI cannot silently green-light a skipped live gate. Setting
 * LIVE_SMOKE_ALLOW_SKIP=1 turns the failure into an explicit, logged skip
 * (exit 0) for environments that intentionally run without live credentials.
 */

const ALLOW_SKIP_ENV = "LIVE_SMOKE_ALLOW_SKIP";

function allowSkip(env = process.env) {
  return String(env[ALLOW_SKIP_ENV] || "").trim() === "1";
}

/**
 * @param {string} name     human-readable env var name(s) for the message
 * @param {string} value    the credential value (may be empty/undefined)
 * @param {object} [options] { env, exit, log } — injectable for tests
 * @returns {string} the trimmed credential when present
 */
function requireCredential(name, value, options = {}) {
  const { env = process.env, exit = process.exit, log = console.error } = options;
  const resolved = String(value ?? "").trim();
  if (resolved) return resolved;

  if (allowSkip(env)) {
    log(`[live-smoke] ${name} is not set — skipping (${ALLOW_SKIP_ENV}=1)`);
    exit(0);
  } else {
    log(
      `[live-smoke] ${name} is required; aborting (set ${ALLOW_SKIP_ENV}=1 to skip this gate without failing)`
    );
    exit(1);
  }
  // Reached only when `exit` is stubbed (tests) — keep control flow sound.
  throw new Error(`${name} is required`);
}

module.exports = { requireCredential, allowSkip, ALLOW_SKIP_ENV };

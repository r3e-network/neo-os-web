import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const SCRIPT = path.join(ROOT, "deploy/scripts/verify_mainnet_miniapp_contract_methods.js");

test("mainnet miniapp method verifier is bounded and observable", () => {
  const source = fs.readFileSync(SCRIPT, "utf8");

  assert.match(source, /MAINNET_MINIAPP_METHOD_RPC_TIMEOUT_MS/);
  assert.match(source, /MAINNET_MINIAPP_METHOD_CONCURRENCY/);
  assert.match(source, /MAINNET_MINIAPP_METHOD_PROGRESS/);
  assert.match(source, /MAINNET_MINIAPP_METHOD_MAX_SAFE_READS/);
  assert.match(source, /function logProgress/);
  assert.match(source, /async function withConcurrency/);
  assert.match(source, /AbortError/);
  assert.match(source, /safeInvocationsAttempted/);
});

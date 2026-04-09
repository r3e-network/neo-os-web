import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");

test("cross-repo testnet script honors RPC overrides and retries transient Neo RPC resets", () => {
  const script = fs.readFileSync(path.join(repoRoot, "deploy/scripts/verify_cross_repo_testnet.sh"), "utf8");

  assert.match(script, /NEO_RPC_TESTNET/);
  assert.match(script, /NEO_N3_TESTNET_RPC_URL/);
  assert.match(script, /AA_TESTNET_RPC_URL/);
  assert.match(script, /TESTNET_RPC_URL="\$AA_TESTNET_RPC_URL"/);
  assert.match(script, /ECONNRESET/);
});

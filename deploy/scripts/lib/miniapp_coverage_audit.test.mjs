import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const SCRIPT = path.join(ROOT, "deploy/scripts/audit_all_miniapp_coverage.js");

test("miniapp coverage audit uses multi-RPC contract-state fallback", () => {
  const source = fs.readFileSync(SCRIPT, "utf8");

  assert.match(source, /TESTNET_RPC_CANDIDATES/);
  assert.match(source, /MAINNET_RPC_CANDIDATES/);
  assert.match(source, /async function resolveRpcCandidates/);
  assert.match(source, /async function contractExistsAcrossCandidates/);
  assert.match(source, /contract_errors/);
  assert.match(source, /rpc_unknown: \[\]/);
  assert.match(source, /miniapp-coverage-latest\.json/);
  assert.match(source, /fs\.writeFileSync\(DEFAULT_REPORT_PATH/);
});

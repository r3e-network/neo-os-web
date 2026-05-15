import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

test("flagship live validation covers every flagship miniapp", () => {
  const script = fs.readFileSync(
    path.join(repoRoot, "deploy/scripts/live_validate_flagship_user_flows.js"),
    "utf8",
  );

  const targetNames = [...script.matchAll(/\["([^"]+)",\s*run[A-Za-z]+\]/g)].map((match) => match[1]);

  assert.deepEqual(targetNames, [
    "dailyCheckin",
    "lastSurvivor",
    "gasBox",
    "fogPlay",
    "redEnvelope",
    "profitAnchor",
    "trustAnchor",
    "selfLoan",
    "neoPay",
  ]);
});

test("anchor AA proxy smoke witness matches the AA core scoped transaction rule", () => {
  const script = fs.readFileSync(
    path.join(repoRoot, "deploy/scripts/live_validate_flagship_user_flows.js"),
    "utf8",
  );

  assert.match(script, /function aaProxySigner/);
  assert.match(script, /function cozSignerHash/);
  assert.match(script, /cozSignerHash\(AA_CORE_HASH\)/);
  assert.match(script, /cozSignerHash\(targetContract\)/);
  assert.match(script, /account:\s*cozSignerHash\(accountHash\)/);
  assert.match(script, /scopes:\s*CozNeon\.tx\.WitnessScope\.WitnessRules/);
});

test("anchor live AA write smoke funds proxy GAS before user operations", () => {
  const script = fs.readFileSync(
    path.join(repoRoot, "deploy/scripts/live_validate_flagship_user_flows.js"),
    "utf8",
  );

  assert.match(script, /ANCHOR_LIVE_AGENT_MIN_GAS/);
  assert.match(script, /async function ensureAnchorProxyGas/);
  assert.match(script, /await ensureAnchorProxyGas\(fromAgentHash, config, "source"\)/);
  assert.match(script, /await ensureAnchorProxyGas\(state\.firstAgent\.accountId, config, "source-account"\)/);
  assert.match(script, /await ensureAnchorProxyGas\(toAgentHash, config, "target"\)/);
  assert.match(script, /await ensureAnchorProxyGas\(state\.secondAgent\.accountId, config, "target-account"\)/);
});

test("anchor live AA network fee estimation retries transient RPC aborts", () => {
  const script = fs.readFileSync(
    path.join(repoRoot, "deploy/scripts/live_validate_flagship_user_flows.js"),
    "utf8",
  );

  assert.match(script, /ANCHOR_NETWORK_FEE_RETRY_ATTEMPTS/);
  assert.match(script, /function isTransientRpcError/);
  assert.match(script, /for \(let attempt = 1; attempt <= ANCHOR_NETWORK_FEE_RETRY_ATTEMPTS; attempt \+= 1\)/);
  assert.match(script, /await sleep\(ANCHOR_NETWORK_FEE_RETRY_DELAY_MS \* attempt\)/);
  assert.match(script, /network fee estimation failed after/);
});

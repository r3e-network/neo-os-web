import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

function extractFunction(script, name) {
  const signature = script.indexOf(`function ${name}(`);
  const asyncSignature = script.indexOf(`async function ${name}(`);
  const start = asyncSignature >= 0 && (signature < 0 || asyncSignature < signature)
    ? asyncSignature
    : signature;
  assert.notEqual(start, -1, `${name} was not found`);

  let parenDepth = 0;
  let brace = -1;
  for (let i = start; i < script.length; i += 1) {
    if (script[i] === "(") parenDepth += 1;
    if (script[i] === ")") parenDepth -= 1;
    if (parenDepth === 0 && script[i] === "{") {
      brace = i;
      break;
    }
  }
  assert.notEqual(brace, -1, `${name} has no function body`);

  let depth = 0;
  for (let i = brace; i < script.length; i += 1) {
    if (script[i] === "{") depth += 1;
    if (script[i] === "}") {
      depth -= 1;
      if (depth === 0) return script.slice(start, i + 1);
    }
  }

  throw new Error(`${name} function body was not closed`);
}

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
  const anchorWriteSmoke = extractFunction(script, "runAnchorManualWriteSmoke");

  assert.match(script, /ANCHOR_LIVE_AGENT_MIN_GAS/);
  assert.match(script, /async function ensureAnchorProxyGas/);
  assert.match(anchorWriteSmoke, /await ensureAnchorProxyGas\(fromAgentHash, config, "source"\)/);
  assert.match(anchorWriteSmoke, /await ensureAnchorProxyGas\(sourceAgent\.accountId, config, "source-account"\)/);
  assert.match(anchorWriteSmoke, /await ensureAnchorProxyGas\(toAgentHash, config, "target"\)/);
  assert.match(anchorWriteSmoke, /await ensureAnchorProxyGas\(targetAgent\.accountId, config, "target-account"\)/);
  assert.doesNotMatch(anchorWriteSmoke, /ensureAnchorProxyGas\(state\.(?:firstAgent|secondAgent)\.accountId/);
});

test("anchor live AA write smoke selects the funded source agent instead of hardcoding agent order", () => {
  const script = fs.readFileSync(
    path.join(repoRoot, "deploy/scripts/live_validate_flagship_user_flows.js"),
    "utf8",
  );
  const anchorWriteSmoke = extractFunction(script, "runAnchorManualWriteSmoke");

  assert.match(anchorWriteSmoke, /candidateBalances\.sort/);
  assert.match(anchorWriteSmoke, /const sourceAgent = candidateBalances\[0\]\?\.agent \|\| state\.firstAgent/);
  assert.match(anchorWriteSmoke, /const targetAgent =/);
  assert.match(anchorWriteSmoke, /Neon\.sc\.ContractParam\.integer\(String\(sourceAgent\.agentId\)\)/);
  assert.match(anchorWriteSmoke, /Neon\.sc\.ContractParam\.integer\(String\(targetAgent\.agentId\)\)/);
  assert.match(anchorWriteSmoke, /sourceAgentId: String\(sourceAgent\.agentId\)/);
  assert.match(anchorWriteSmoke, /targetAgentId: String\(targetAgent\.agentId\)/);
  assert.doesNotMatch(anchorWriteSmoke, /accountId:\s*state\.(?:firstAgent|secondAgent)\.accountId/);
  assert.doesNotMatch(anchorWriteSmoke, /Neon\.sc\.ContractParam\.integer\("1"\)/);
  assert.doesNotMatch(anchorWriteSmoke, /Neon\.sc\.ContractParam\.integer\("2"\)/);
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

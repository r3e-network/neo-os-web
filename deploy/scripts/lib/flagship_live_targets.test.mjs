import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const { LIVE_CHAIN_FLOWS, SHARED_RUNTIME_FLOWS } = require("../audit_live_harness_coverage.js");

const FLAGSHIP_SCRIPT = "deploy/scripts/live_validate_flagship_user_flows.js";

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

test("flagship live validation registers exactly the targets the coverage registry routes to it", () => {
  const script = fs.readFileSync(path.join(repoRoot, FLAGSHIP_SCRIPT), "utf8");

  // Parse the FLAGSHIP_TASKS registry literal (the script runs main() on load,
  // so its task table cannot be imported directly).
  const tasksLiteral = script.match(/const FLAGSHIP_TASKS = \[([\s\S]*?)\n\];/);
  assert.ok(tasksLiteral, "FLAGSHIP_TASKS registry was not found in the flagship validator");
  const registered = [...tasksLiteral[1].matchAll(/\["([^"]+)",\s*[A-Za-z0-9_$]+\]/g)].map(
    (match) => match[1],
  );
  assert.ok(registered.length > 0, "FLAGSHIP_TASKS registry declares no targets");
  assert.equal(
    new Set(registered).size,
    registered.length,
    `FLAGSHIP_TASKS registry declares duplicate targets: ${registered.join(", ")}`,
  );

  // The expected target set is derived from the live harness coverage
  // registry (the routing source of truth), not from a duplicated literal.
  const expected = new Set();
  for (const flows of [LIVE_CHAIN_FLOWS, SHARED_RUNTIME_FLOWS]) {
    for (const flow of flows.values()) {
      if (flow.script !== FLAGSHIP_SCRIPT) continue;
      for (const target of String(flow.target).split("/")) expected.add(target);
    }
  }

  assert.deepEqual(
    [...registered].sort(),
    [...expected].sort(),
    "FLAGSHIP_TASKS must register exactly the targets that audit_live_harness_coverage.js routes to the flagship validator",
  );
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

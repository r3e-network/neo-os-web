#!/usr/bin/env node

/**
 * Audits the deployed flagship contract on-chain ABI against the methods the
 * frontend / live-flow validator actually invokes. Source-side per-app contract
 * directories no longer exist after the platform-contract consolidation, so this
 * script reads the on-chain manifest via getcontractstate and compares it to a
 * curated list of expected methods per flagship.
 *
 * Network is selected from the manifest (or NEO_TARGET_NETWORK / FLAGSHIP_NETWORK).
 */

const fs = require("fs");
const path = require("path");
const { getManifestContractHash, getNetworkConfig, getTargetNetwork } = require("./lib/neo_network");

const root = path.resolve(__dirname, "..", "..");

// One row per flagship. expectedMethods are the methods the frontend / live
// flow validator depends on — if the on-chain ABI is missing one, the page
// or the smoke test will break.
const items = [
  {
    brand: "LastSurvivor",
    manifest: "apps/last-survivor/neo-manifest.json",
    expectedMethods: ["currentRoundId", "timeRemaining", "totalKeysSold", "totalPotDistributed", "totalPlayers", "getCurrentKeyPrice"],
    expectedMethodsByNetwork: {
      "neo-n3-mainnet": ["getGameType", "getGameAdmin", "isPaused", "startCountdownRound", "buyCountdownKeys", "getCountdownStatus", "calculateCountdownKeyCost"],
      "neo-n3-testnet": ["getGameType", "getGameAdmin", "isPaused", "startCountdownRound", "buyCountdownKeys", "getCountdownStatus", "calculateCountdownKeyCost"],
    },
  },
  {
    brand: "GASBOX",
    manifest: "apps/gasbox/neo-manifest.json",
    expectedMethods: ["totalMachines", "isPaused", "initiatePlay", "settlePlay", "getMachine"],
    expectedMethodsByNetwork: {
      "neo-n3-mainnet": ["getGameType", "getGameAdmin", "isPaused", "createGachaMachine", "pullGacha", "resolveGachaPull", "getGachaMachine"],
      "neo-n3-testnet": ["getGameType", "getGameAdmin", "isPaused", "createGachaMachine", "pullGacha", "resolveGachaPull", "getGachaMachine"],
    },
  },
  {
    brand: "Red Envelope",
    manifest: "apps/red-envelope/neo-manifest.json",
    expectedMethods: ["isPaused", "createEnvelope", "claim", "getEnvelope"],
  },
  {
    brand: "Daily Check-in",
    manifest: "apps/daily-checkin/neo-manifest.json",
    expectedMethods: ["isPaused", "checkIn", "getPlatformStats"],
  },
  {
    brand: "FogPlay",
    manifest: "apps/fogplay/neo-manifest.json",
    expectedMethods: ["isPaused", "placeBet", "getBet"],
    expectedMethodsByNetwork: {
      "neo-n3-mainnet": ["getGameType", "getGameAdmin", "isPaused", "placeCoinFlipBet", "resolveCoinFlipBet", "getCoinFlipBet", "getCoinFlipBetLimits"],
      "neo-n3-testnet": ["getGameType", "getGameAdmin", "isPaused", "placeCoinFlipBet", "resolveCoinFlipBet", "getCoinFlipBet", "getCoinFlipBetLimits"],
    },
  },
  {
    brand: "SelfLoan",
    manifest: "apps/self-loan/neo-manifest.json",
    expectedMethods: ["isPaused", "createLoan", "repayDebt", "getLoanDetails", "getPlatformStats"],
    expectedMethodsByNetwork: {
      "neo-n3-testnet": ["isPaused", "createLoan", "repayLoan", "getLoan", "getLendingStats", "setProfitAnchor", "syncProfitAnchorVote"],
    },
  },
  {
    brand: "ProfitAnchor",
    manifest: "apps/profitanchor/neo-manifest.json",
    deploymentOptional: true,
    expectedMethods: ["getAnchorStats", "registerAgent", "registerAgents", "transferAgentNeo", "setAgentCandidate", "voteAgent"],
  },
  {
    brand: "TrustAnchor",
    manifest: "apps/trustanchor/neo-manifest.json",
    deploymentOptional: true,
    expectedMethods: ["getAnchorStats", "registerAgent", "registerAgents", "transferAgentNeo", "setAgentCandidate", "voteAgent"],
  },
  {
    brand: "NeoPay",
    manifest: "apps/neo-pay/neo-manifest.json",
    expectedMethods: ["totalStreams", "createStream", "claimStream", "cancelStream", "getStreamDetails"],
  },
];

function buildRpcCandidates(networkConfig) {
  const candidates = [];
  const primary = String(networkConfig?.rpcUrl || "").trim();
  if (primary) candidates.push(primary);

  // n3index is a stable public Neo JSON-RPC proxy and helps mitigate transient
  // HTML/WAF pages returned by upstream RPC providers.
  if (networkConfig?.key === "neo-n3-mainnet") {
    candidates.push("https://api.n3index.dev/mainnet");
  } else if (networkConfig?.key === "neo-n3-testnet") {
    candidates.push("https://api.n3index.dev/testnet");
  }

  return [...new Set(candidates)];
}

async function fetchJsonRpc(rpcUrl, payload, { timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await res.text();
    if (!String(text || "").trim()) {
      return {
        ok: false,
        status: res.status,
        error: `empty rpc response (status=${res.status})`,
      };
    }
    try {
      return { ok: true, status: res.status, body: text ? JSON.parse(text) : {} };
    } catch {
      const snippet = String(text || "").trim().slice(0, 120);
      return {
        ok: false,
        status: res.status,
        error: `non-json rpc response (status=${res.status}, head=${JSON.stringify(snippet)})`,
      };
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function getContractState(rpcCandidates, hash) {
  let lastError = null;

  for (const rpcUrl of rpcCandidates) {
    const payload = {
      jsonrpc: "2.0",
      id: 1,
      method: "getcontractstate",
      params: [hash],
    };

    // Some RPC providers intermittently return HTML error pages; retry once
    // before falling back to alternate endpoints.
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const result = await fetchJsonRpc(rpcUrl, payload);
      if (!result.ok) {
        lastError = new Error(`${rpcUrl}: ${result.error}`);
        continue;
      }
      if (result.body?.error) {
        lastError = new Error(
          `${rpcUrl}: ${result.body.error.message || result.body.error.code || "unknown rpc error"}`
        );
        continue;
      }
      if (result.body?.result == null) {
        lastError = new Error(`${rpcUrl}: missing result for getcontractstate`);
        continue;
      }
      return result.body.result;
    }
  }

  throw lastError || new Error("unknown rpc error");
}

function expectedMethodsFor(item, networkKey) {
  return item.expectedMethodsByNetwork?.[networkKey] || item.expectedMethods || [];
}

async function main() {
  const rows = [];
  let failed = false;

  for (const item of items) {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, item.manifest), "utf8"));
    const targetNetwork = getTargetNetwork(manifest);
    const networkConfig = getNetworkConfig(targetNetwork);
    const deployedHash = getManifestContractHash(manifest, targetNetwork);

    const row = {
      brand: item.brand,
      manifestId: manifest.id,
      targetNetwork: networkConfig.key,
      deployedHash: deployedHash || "missing",
      contractName: "",
      methodCount: 0,
      checkedAbiMethods: expectedMethodsFor(item, networkConfig.key),
      missingMethods: [],
      problems: [],
    };

    if (!deployedHash && item.deploymentOptional) {
      row.contractName = "PlatformAnchor (source-ready)";
      rows.push(row);
      continue;
    }

    if (!deployedHash) {
      row.problems.push(`manifest missing ${networkConfig.key} hash`);
      failed = true;
      rows.push(row);
      continue;
    }

    try {
      const remote = await getContractState(buildRpcCandidates(networkConfig), deployedHash);
      const remoteMethods = Array.isArray(remote?.manifest?.abi?.methods)
        ? remote.manifest.abi.methods.map((m) => String(m.name || ""))
        : [];
      row.contractName = String(remote?.manifest?.name || "");
      row.methodCount = remoteMethods.length;
      const missing = row.checkedAbiMethods.filter((name) => !remoteMethods.includes(name));
      row.missingMethods = missing;
      if (missing.length) {
        row.problems.push(`missing ABI methods: ${missing.join(",")}`);
        failed = true;
      }
    } catch (err) {
      row.problems.push(`rpc error: ${err.message}`);
      failed = true;
    }

    rows.push(row);
  }

  console.log(JSON.stringify(rows, null, 2));
  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

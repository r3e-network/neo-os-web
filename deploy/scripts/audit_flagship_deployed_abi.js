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
      "neo-n3-testnet": ["getGameType", "getGameAdmin", "isPaused", "startCountdownRound", "buyCountdownKeys", "getCountdownStatus", "calculateCountdownKeyCost"],
    },
  },
  {
    brand: "GASBOX",
    manifest: "apps/gasbox/neo-manifest.json",
    expectedMethods: ["totalMachines", "isPaused", "initiatePlay", "settlePlay", "getMachine"],
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
    expectedMethods: ["getAnchorStats", "registerAgent", "setAgentProfitScore", "voteBestProfitCandidate", "withdrawCredit", "claimRewards"],
  },
  {
    brand: "TrustAnchor",
    manifest: "apps/trustanchor/neo-manifest.json",
    deploymentOptional: true,
    expectedMethods: ["getAnchorStats", "registerAgent", "votePooledStake", "withdrawCredit", "claimRewards"],
  },
  {
    brand: "NeoPay",
    manifest: "apps/neo-pay/neo-manifest.json",
    expectedMethods: ["totalStreams", "createStream", "claimStream", "cancelStream", "getStreamDetails"],
  },
];

async function getContractState(rpcUrl, hash) {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getcontractstate",
      params: [hash],
    }),
  });
  const data = await res.json();
  if (data.error) {
    throw new Error(data.error.message || "unknown rpc error");
  }
  return data.result;
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
      const remote = await getContractState(networkConfig.rpcUrl, deployedHash);
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

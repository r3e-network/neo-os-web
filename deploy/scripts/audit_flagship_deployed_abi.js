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
// Every method here is one the app's own source invokes by name, checked to
// exist on the contract its manifest binds to. Derived that way on 2026-07-30
// and verified against mainnet and testnet.
//
// The lists had gone stale: they still named the PlatformGame kernel API
// (getGameType, startCountdownRound, buyCountdownKeys, ...) that these apps
// stopped using when they moved to standalone contracts, so the audit was
// asserting an interface nothing implements any more. Two more - red-envelope's
// isPaused and daily-checkin's checkIn - were methods no app calls.
//
// To refresh after an app changes its contract calls: list the methods the app
// source quotes, intersect with the deployed ABI, and put the result here.
const items = [
  {
    brand: "LastSurvivor",
    manifest: "apps/last-survivor/neo-manifest.json",
    expectedMethods: ["buyKeys", "creditOf", "currentKeyCost", "getCurrentRound", "getRound", "playerKeys", "settle", "withdraw"],
    expectedMethodsByNetwork: {
        "neo-n3-mainnet": ["buyKeys", "creditOf", "currentKeyCost", "getCurrentRound", "getRound", "playerKeys", "settle", "withdraw"],
        "neo-n3-testnet": ["buyKeys", "creditOf", "currentKeyCost", "getCurrentRound", "getOwner", "getRound", "playerKeys", "settle", "withdraw"],
      },
  },
  {
    brand: "GASBOX",
    manifest: "apps/gasbox/neo-manifest.json",
    expectedMethods: ["addItem", "commit", "createMachine", "getItem", "getMachine", "getOwner", "getPendingBet", "lastBetId", "lastMachineId", "pendingBetCount", "playCreditOf", "setActive", "settle", "withdraw", "withdrawPool", "withdrawRevenue"],
    expectedMethodsByNetwork: {
        "neo-n3-mainnet": ["addItem", "commit", "createMachine", "getItem", "getMachine", "getOwner", "getPendingBet", "lastBetId", "lastMachineId", "pendingBetCount", "playCreditOf", "setActive", "settle", "withdraw", "withdrawPool", "withdrawRevenue"],
        "neo-n3-testnet": ["addItem", "commit", "createMachine", "getItem", "getMachine", "getOwner", "getPendingBet", "lastBetId", "lastMachineId", "pendingBetCount", "playCreditOf", "setActive", "settle", "withdraw", "withdrawPool", "withdrawRevenue"],
      },
  },
  {
    brand: "Red Envelope",
    manifest: "apps/red-envelope/neo-manifest.json",
    expectedMethods: ["claim", "claimedAmount", "claimerEnvelopeCount", "createEnvelope", "creatorEnvelopeCount", "creditOf", "getClaimerEnvelopes", "getCreatorEnvelopes", "getEnvelope", "hasClaimed", "lastEnvelopeId", "reclaim", "withdraw"],
  },
  {
    brand: "Daily Check-in",
    manifest: "apps/daily-checkin/neo-manifest.json",
    expectedMethods: ["checkInFee", "claimRewards", "getCheckInStateForFrontend", "getCheckinStatus", "getPlatformStats", "getUserStatsDetails", "isPaused", "rewardPool", "totalUnclaimed"],
  },
  {
    brand: "FogPlay",
    manifest: "apps/fogplay/neo-manifest.json",
    expectedMethods: ["bankroll", "commit", "creditOf", "freeBankroll", "getPendingBet", "getPlayerBets", "getStats", "playerBetCount", "settle", "withdraw"],
    expectedMethodsByNetwork: {
        "neo-n3-mainnet": ["bankroll", "commit", "creditOf", "freeBankroll", "getPendingBet", "getPlayerBets", "getStats", "playerBetCount", "settle", "withdraw"],
        "neo-n3-testnet": ["bankroll", "commit", "creditOf", "freeBankroll", "getPendingBet", "getPlayerBets", "getStats", "playerBetCount", "settle", "withdraw"],
      },
  },
  {
    brand: "Dice Game",
    manifest: "apps/dice-game/neo-manifest.json",
    expectedMethodsByNetwork: {
        "neo-n3-mainnet": ["bankroll", "commit", "creditOf", "getPendingBet", "settle", "withdraw"],
        "neo-n3-testnet": ["bankroll", "commit", "creditOf", "getPendingBet", "settle", "withdraw"],
      },
  },
  {
    brand: "SelfLoan",
    manifest: "apps/self-loan/neo-manifest.json",
    expectedMethods: ["addCollateral", "borrow", "collateralCreditOf", "feeBps", "getLoan", "getOwner", "ltvTierBps", "neoPrice", "onNEP17Payment", "pool", "repay", "repayCreditOf", "setNeoPrice", "totalBorrowed", "totalLoans", "totalRepaid", "withdraw", "withdrawPool", "withdrawRepayCredit"],
    expectedMethodsByNetwork: {
        "neo-n3-mainnet": ["addCollateral", "borrow", "collateralCreditOf", "feeBps", "getLoan", "getOwner", "ltvTierBps", "neoPrice", "onNEP17Payment", "pool", "repay", "repayCreditOf", "setNeoPrice", "totalBorrowed", "totalLoans", "totalRepaid", "withdraw", "withdrawPool", "withdrawRepayCredit"],
        "neo-n3-testnet": ["addCollateral", "borrow", "collateralCreditOf", "feeBps", "getLoan", "getOwner", "ltvTierBps", "neoPrice", "onNEP17Payment", "pool", "repay", "repayCreditOf", "setNeoPrice", "totalBorrowed", "totalLoans", "totalRepaid", "withdraw", "withdrawPool", "withdrawRepayCredit"],
      },
  },
  {
    brand: "ProfitAnchor",
    manifest: "apps/profitanchor/neo-manifest.json",
    deploymentOptional: true,
    expectedMethods: ["claimRewards"],
  },
  {
    brand: "TrustAnchor",
    manifest: "apps/trustanchor/neo-manifest.json",
    deploymentOptional: true,
    expectedMethods: ["claimRewards", "stake", "withdraw"],
  },
  {
    brand: "NeoPay",
    manifest: "apps/neo-pay/neo-manifest.json",
    expectedMethods: ["cancelStream", "claimStream", "createStream", "getBeneficiaryStreams", "getStreamDetails", "getUserStreams", "isPaused"],
  },
];


// One app's manifest, out of the committed snapshot rather than a sibling
// checkout. scripts/refresh-manifest-snapshot.mjs --check keeps it honest.
const MANIFEST_SNAPSHOT = "platform/host-app/public/miniapp-manifests.json";
let snapshotCache = null;

function readSnapshotManifest(slug) {
  if (!snapshotCache) {
    const parsed = JSON.parse(fs.readFileSync(path.join(root, MANIFEST_SNAPSHOT), "utf8"));
    snapshotCache = parsed?.manifests ?? {};
    if (Object.keys(snapshotCache).length === 0) {
      throw new Error(`${MANIFEST_SNAPSHOT} is empty; run: node scripts/refresh-manifest-snapshot.mjs`);
    }
  }
  const manifest = snapshotCache[slug];
  if (!manifest) throw new Error(`no manifest for "${slug}" in ${MANIFEST_SNAPSHOT}`);
  return manifest;
}

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
    // The apps are in neo-os-miniapps and neo-os-minigames; their manifests reach
    // this repo through the committed snapshot the host app serves. The table
    // above still names apps/<slug>/neo-manifest.json because that is the
    // identity the snapshot is keyed by.
    const slug = item.manifest.split("/")[1];
    const manifest = readSnapshotManifest(slug);
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

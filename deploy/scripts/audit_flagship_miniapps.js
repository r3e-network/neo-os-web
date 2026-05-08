#!/usr/bin/env node

/**
 * Flagship miniapp audit (post platform-contract consolidation).
 *
 * What it checks per flagship:
 *  - apps/<slug>/neo-manifest.json exists and has the active-network hash
 *  - apps/<slug>/index.html exists (frontend entry)
 *  - platform/host-app/public/miniapp-definitions/<slug>.json exists and matches
 *  - host-app registry / homepage references the manifest id
 *  - Deployed contract responds on-chain and exposes the expected ABI methods
 *
 * Per-app C# contract dirs were removed during the platform-contract
 * consolidation (logic now lives in PlatformGame / PlatformDeFi / PlatformSocial,
 * with appId namespacing) — this audit no longer expects them.
 */

const fs = require("fs");
const path = require("path");
const { getManifestContractHash, getNetworkConfig, getTargetNetwork } = require("./lib/neo_network");

const root = path.resolve(__dirname, "..", "..");

const FLAGSHIP_APPS = [
  {
    brand: "LastSurvivor",
    slug: "last-survivor",
    expectedMethods: ["currentRoundId", "timeRemaining", "totalKeysSold", "getCurrentKeyPrice"],
    expectedMethodsByNetwork: {
      "neo-n3-testnet": ["getGameType", "getGameAdmin", "isPaused", "startCountdownRound", "buyCountdownKeys", "getCountdownStatus", "calculateCountdownKeyCost"],
    },
  },
  { brand: "GASBOX", slug: "gasbox", expectedMethods: ["totalMachines", "isPaused", "initiatePlay", "settlePlay"] },
  { brand: "Red Envelope", slug: "red-envelope", expectedMethods: ["isPaused", "createEnvelope", "claim", "getEnvelope"] },
  { brand: "Daily Check-in", slug: "daily-checkin", expectedMethods: ["isPaused", "checkIn", "getPlatformStats"] },
  { brand: "FogPlay", slug: "fogplay", expectedMethods: ["isPaused", "placeBet", "getBet"] },
  {
    brand: "SelfLoan",
    slug: "self-loan",
    expectedMethods: ["isPaused", "createLoan", "repayDebt", "getLoanDetails"],
    expectedMethodsByNetwork: {
      "neo-n3-testnet": ["isPaused", "createLoan", "repayLoan", "getLoan", "getLendingStats", "setProfitAnchor", "syncProfitAnchorVote"],
    },
  },
  { brand: "ProfitAnchor", slug: "profitanchor", deploymentOptional: true, expectedMethods: ["getAnchorStats", "registerAgent", "registerAgents", "transferAgentNeo", "setAgentCandidate", "voteAgent"] },
  { brand: "TrustAnchor", slug: "trustanchor", deploymentOptional: true, expectedMethods: ["getAnchorStats", "registerAgent", "registerAgents", "transferAgentNeo", "setAgentCandidate", "voteAgent"] },
  { brand: "NeoPay", slug: "neo-pay", expectedMethods: ["totalStreams", "createStream", "claimStream", "cancelStream", "getStreamDetails"] },
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function safeRead(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function expectedMethodsFor(app, networkKey) {
  return app.expectedMethodsByNetwork?.[networkKey] || app.expectedMethods || [];
}

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

async function main() {
  const builtinsSource = safeRead("platform/host-app/lib/miniapp-builtins.ts");
  const showcaseSource = exists("platform/host-app/lib/miniapp-showcase.ts")
    ? safeRead("platform/host-app/lib/miniapp-showcase.ts")
    : "";
  const homeSource = exists("platform/host-app/pages/index.tsx")
    ? safeRead("platform/host-app/pages/index.tsx")
    : "";

  let hasFailures = false;
  const rows = [];

  for (const app of FLAGSHIP_APPS) {
    const manifestPath = `apps/${app.slug}/neo-manifest.json`;
    const definitionPath = `platform/host-app/public/miniapp-definitions/${app.slug}.json`;
    const appIndexPath = `apps/${app.slug}/index.html`;

    const manifest = readJson(path.join(root, manifestPath));
    const definition = exists(definitionPath) ? readJson(path.join(root, definitionPath)) : null;

    const targetNetwork = getTargetNetwork(manifest);
    const networkConfig = getNetworkConfig(targetNetwork);
    const contractActive = getManifestContractHash(manifest, targetNetwork);

    // Definition files carry the canonical (typically mainnet) hash; compare
    // against the manifest's canonical hash, not the per-run active network.
    const canonicalNetwork = manifest.default_network || "neo-n3-mainnet";
    const canonicalHash = manifest.contracts?.[canonicalNetwork] || "";

    const registryLinked = builtinsSource.includes(manifest.id);
    const homeLinked =
      registryLinked ||
      showcaseSource.includes(manifest.id) ||
      homeSource.includes(manifest.id);
    const appIndexExists = exists(appIndexPath);
    const definitionExists = Boolean(definition);
    const definitionIdMatches = definitionExists && definition.app_id === manifest.id;
    const definitionHashMatches =
      definitionExists &&
      (!canonicalHash || !definition.contract?.contract_hash || definition.contract.contract_hash === canonicalHash);

    const problems = [];
    if (!definitionExists) problems.push("missing host definition");
    if (definitionExists && !definitionIdMatches) problems.push("definition app_id mismatch");
    if (definitionExists && !definitionHashMatches) problems.push("definition contract hash mismatch");
    if (!registryLinked) problems.push("host registry missing app_id");
    if (!homeLinked) problems.push("home catalog missing app_id");
    if (!appIndexExists) problems.push("frontend index missing");

    let onChainMethods = [];
    let contractName = "";
    if (!contractActive && app.deploymentOptional) {
      contractName = "PlatformAnchor (source-ready)";
    } else if (!contractActive) {
      problems.push(`manifest missing ${networkConfig.key} hash`);
    } else {
      try {
        const remote = await getContractState(networkConfig.rpcUrl, contractActive);
        contractName = String(remote?.manifest?.name || "");
        onChainMethods = Array.isArray(remote?.manifest?.abi?.methods)
          ? remote.manifest.abi.methods.map((m) => String(m.name || ""))
          : [];
      } catch (err) {
        problems.push(`rpc error: ${err.message}`);
      }
    }
    const expectedMethods = expectedMethodsFor(app, networkConfig.key);
    const missingMethods = !contractActive && app.deploymentOptional
      ? []
      : expectedMethods.filter((name) => !onChainMethods.includes(name));
    if (contractActive && onChainMethods.length === 0) problems.push("on-chain manifest empty");
    if (missingMethods.length) problems.push(`missing ABI methods: ${missingMethods.join(",")}`);

    if (problems.length) hasFailures = true;

    rows.push({
      brand: app.brand,
      manifestId: manifest.id,
      definitionStatus: definition?.status || "missing",
      activeNetwork: networkConfig.key,
      contractAddress: contractActive || "missing",
      contractName,
      methodCount: onChainMethods.length,
      checkedAbiMethods: expectedMethods,
      missingMethods,
      problems,
    });
  }

  console.log(JSON.stringify(rows, null, 2));
  if (hasFailures) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

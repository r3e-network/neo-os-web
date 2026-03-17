#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { getManifestContractHash, getNetworkConfig, getTargetNetwork } = require("./lib/neo_network");

const root = path.resolve(__dirname, "..", "..");

const FLAGSHIP_APPS = [
  {
    brand: "LastSurvivor",
    slug: "last-survivor",
    contractName: "MiniAppLastSurvivor",
    readChecks: [
      { method: "getGameStatus", args: [], expectedStackType: "Map" },
      { method: "getPlatformStats", args: [], expectedStackType: "Map" },
    ],
  },
  {
    brand: "GASBOX",
    slug: "gasbox",
    contractName: "MiniAppGASBox",
    readChecks: [
      { method: "totalMachines", args: [], expectedStackType: "Integer" },
    ],
  },
  {
    brand: "Red Envelope",
    slug: "red-envelope",
    contractName: "MiniAppRedEnvelope",
    readChecks: [
      { method: "getEnvelope", args: [{ type: "Integer", value: "0" }], expectedStackType: "Struct" },
    ],
  },
  {
    brand: "Daily Check-in",
    slug: "daily-checkin",
    contractName: "MiniAppDailyCheckIn",
    readChecks: [
      { method: "getPlatformStats", args: [], expectedStackType: "Map" },
    ],
  },
  {
    brand: "FogPlay",
    slug: "fogplay",
    contractName: "MiniAppFogPlay",
    readChecks: [
      { method: "getBetLimits", args: [], expectedStackType: "Struct" },
    ],
  },
  {
    brand: "SelfLoan",
    slug: "self-loan",
    contractName: "MiniAppSelfLoan",
    readChecks: [
      { method: "getPlatformStats", args: [], expectedStackType: "Map" },
      { method: "getLoanDetails", args: [{ type: "Integer", value: "0" }], expectedStackType: "Map" },
    ],
  },
  {
    brand: "NeoPay",
    slug: "neo-pay",
    contractName: "MiniAppNeoPay",
    readChecks: [
      { method: "totalStreams", args: [], expectedStackType: "Integer" },
      { method: "getStreamDetails", args: [{ type: "Integer", value: "0" }], expectedStackType: "Map" },
    ],
  },
];

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
}

function resolveDefinitionHash(definition, manifest, targetNetwork) {
  const manifestContracts = definition?.manifest?.contracts && typeof definition.manifest.contracts === "object"
    ? definition.manifest.contracts
    : manifest?.contracts && typeof manifest.contracts === "object"
      ? manifest.contracts
      : {};
  const resolvedNetworkKey = targetNetwork === "testnet"
    ? "neo-n3-testnet"
    : targetNetwork === "mainnet"
      ? "neo-n3-mainnet"
      : targetNetwork;
  const direct = String(definition?.contract?.contract_hash || definition?.contract_hash || "").trim();
  const networkSpecific = String(manifestContracts?.[resolvedNetworkKey] || manifestContracts?.[targetNetwork] || "").trim();
  return networkSpecific || direct;
}

async function rpc(rpcUrl, method, params) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
  });
  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message || `rpc ${method} failed`);
  }
  return data.result;
}

async function main() {
  const rows = [];
  let failed = false;

  for (const app of FLAGSHIP_APPS) {
    const manifest = readJson(`apps/${app.slug}/neo-manifest.json`);
    const definition = readJson(`platform/host-app/public/miniapp-definitions/${app.slug}.json`);
    const targetNetwork = getTargetNetwork(manifest);
    const networkConfig = getNetworkConfig(targetNetwork);
    const network = networkConfig.key;
    const contractHash = getManifestContractHash(manifest, targetNetwork);
    const definitionHash = resolveDefinitionHash(definition, manifest, targetNetwork);

    const row = {
      brand: app.brand,
      manifestId: manifest.id,
      network,
      contractHash: contractHash || "missing",
      definitionHash: definitionHash || "missing",
      remoteContractName: null,
      readChecks: [],
      problems: [],
    };

    if (!contractHash) {
      row.problems.push("manifest missing active network contract hash");
      rows.push(row);
      failed = true;
      continue;
    }

    if (row.definitionHash !== contractHash) {
      row.problems.push("host definition hash mismatch");
    }

    try {
      const state = await rpc(networkConfig.rpcUrl, "getcontractstate", [contractHash]);
      row.remoteContractName = state?.manifest?.name || null;
      if (row.remoteContractName !== app.contractName) {
        row.problems.push(`remote contract name mismatch: ${row.remoteContractName || "missing"}`);
      }
    } catch (error) {
      row.problems.push(`getcontractstate failed: ${String(error.message || error)}`);
      rows.push(row);
      failed = true;
      continue;
    }

    for (const check of app.readChecks) {
      try {
        const result = await rpc(networkConfig.rpcUrl, "invokefunction", [contractHash, check.method, check.args]);
        const stackItem = result?.stack?.[0];
        const stackType = stackItem?.type || "missing";
        const checkRow = {
          method: check.method,
          vmstate: result?.state || "unknown",
          stackType,
        };
        row.readChecks.push(checkRow);

        if (result?.state !== "HALT") {
          row.problems.push(`${check.method} returned ${result?.state || "unknown"}`);
        }
        if (stackType !== check.expectedStackType) {
          row.problems.push(`${check.method} stack type mismatch: expected ${check.expectedStackType}, got ${stackType}`);
        }
      } catch (error) {
        row.readChecks.push({
          method: check.method,
          vmstate: "ERROR",
          stackType: "error",
        });
        row.problems.push(`${check.method} failed: ${String(error.message || error)}`);
      }
    }

    if (row.problems.length) {
      failed = true;
    }
    rows.push(row);
  }

  console.log(JSON.stringify(rows, null, 2));
  if (failed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

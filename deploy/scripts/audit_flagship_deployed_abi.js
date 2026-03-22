#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { getManifestContractHash, getNetworkConfig, getTargetNetwork } = require("./lib/neo_network");

const root = path.resolve(__dirname, "..", "..");

const items = [
  { brand: "LastSurvivor", manifest: "apps/last-survivor/neo-manifest.json", buildManifest: "contracts/build/MiniAppLastSurvivor.manifest.json" },
  { brand: "GASBOX", manifest: "apps/gasbox/neo-manifest.json", buildManifest: "contracts/build/MiniAppGASBox.manifest.json" },
  { brand: "Red Envelope", manifest: "apps/red-envelope/neo-manifest.json", buildManifest: "contracts/build/MiniAppRedEnvelope.manifest.json" },
  { brand: "Daily Check-in", manifest: "apps/daily-checkin/neo-manifest.json", buildManifest: "contracts/build/MiniAppDailyCheckin.manifest.json" },
  { brand: "FogPlay", manifest: "apps/fogplay/neo-manifest.json", buildManifest: "contracts/build/MiniAppFogPlay.manifest.json" },
  { brand: "SelfLoan", manifest: "apps/self-loan/neo-manifest.json", buildManifest: "contracts/build/MiniAppSelfLoan.manifest.json" },
  { brand: "NeoPay", manifest: "apps/neo-pay/neo-manifest.json", buildManifest: "contracts/build/MiniAppNeoPay.manifest.json" },
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

async function main() {
  const rows = [];
  let failed = false;

  for (const item of items) {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, item.manifest), "utf8"));
    const buildManifest = JSON.parse(fs.readFileSync(path.join(root, item.buildManifest), "utf8"));
    const targetNetwork = getTargetNetwork(manifest);
    const networkConfig = getNetworkConfig(targetNetwork);
    const deployedHash = getManifestContractHash(manifest, targetNetwork);
    if (!deployedHash) {
      rows.push({
        brand: item.brand,
        targetNetwork: networkConfig.key,
        deployedHash: "missing",
        problems: [`manifest missing ${networkConfig.key} hash`],
      });
      failed = true;
      continue;
    }

    try {
      const remote = await getContractState(networkConfig.rpcUrl, deployedHash);
      const toSignature = (method) => `${method.name}/${Array.isArray(method.parameters) ? method.parameters.length : 0}`;
      const localMethods = buildManifest.abi.methods || [];
      const remoteMethods = remote.manifest?.abi?.methods || [];
      const localSignatures = localMethods.map(toSignature);
      const remoteSignatures = remoteMethods.map(toSignature);
      const missing = localSignatures.filter((sig) => !remoteSignatures.includes(sig));
      const extra = remoteSignatures.filter((sig) => !localSignatures.includes(sig));
      const problems = [];
      if (missing.length) problems.push(`missing signatures: ${missing.slice(0, 10).join(",")}`);
      if (extra.length) problems.push(`extra signatures: ${extra.slice(0, 10).join(",")}`);
      if (problems.length) failed = true;

      rows.push({
        brand: item.brand,
        targetNetwork: networkConfig.key,
        deployedHash,
        remoteContractName: remote.manifest?.name || null,
        localMethodCount: localSignatures.length,
        remoteMethodCount: remoteSignatures.length,
        problems,
      });
    } catch (error) {
      failed = true;
      rows.push({
        brand: item.brand,
        targetNetwork: networkConfig.key,
        deployedHash,
        problems: [error instanceof Error ? error.message : String(error)],
      });
    }
  }

  console.log(JSON.stringify(rows, null, 2));
  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

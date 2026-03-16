#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const rpcUrl = process.env.NEO_RPC_URL || "https://testnet1.neo.coz.io:443";

const items = [
  { brand: "LastSurvivor", manifest: "apps/doomsday-clock/neo-manifest.json", buildManifest: "contracts/build/MiniAppDoomsdayClock.manifest.json" },
  { brand: "GASBOX", manifest: "apps/neo-gacha/neo-manifest.json", buildManifest: "contracts/build/MiniAppNeoGacha.manifest.json" },
  { brand: "Red Envelope", manifest: "apps/red-envelope/neo-manifest.json", buildManifest: "contracts/build/MiniAppRedEnvelope.manifest.json" },
  { brand: "Daily Check-in", manifest: "apps/daily-checkin/neo-manifest.json", buildManifest: "contracts/build/MiniAppDailyCheckin.manifest.json" },
  { brand: "FogPlay", manifest: "apps/coin-flip/neo-manifest.json", buildManifest: "contracts/build/MiniAppCoinFlip.manifest.json" },
  { brand: "SelfLoan", manifest: "apps/self-loan/neo-manifest.json", buildManifest: "contracts/build/MiniAppSelfLoan.manifest.json" },
];

async function getContractState(hash) {
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
    const deployedHash = manifest.contracts?.["neo-n3-testnet"] || "";
    if (!deployedHash) {
      rows.push({ brand: item.brand, deployedHash: "missing", problems: ["manifest missing testnet hash"] });
      failed = true;
      continue;
    }

    try {
      const remote = await getContractState(deployedHash);
      const localMethods = buildManifest.abi.methods.map((m) => m.name);
      const remoteMethods = (remote.manifest?.abi?.methods || []).map((m) => m.name);
      const missing = localMethods.filter((m) => !remoteMethods.includes(m));
      const extra = remoteMethods.filter((m) => !localMethods.includes(m));
      const problems = [];
      if (missing.length) problems.push(`missing methods: ${missing.slice(0, 10).join(",")}`);
      if (extra.length) problems.push(`extra methods: ${extra.slice(0, 10).join(",")}`);
      if (problems.length) failed = true;

      rows.push({
        brand: item.brand,
        deployedHash,
        remoteContractName: remote.manifest?.name || null,
        localMethodCount: localMethods.length,
        remoteMethodCount: remoteMethods.length,
        problems,
      });
    } catch (error) {
      failed = true;
      rows.push({
        brand: item.brand,
        deployedHash,
        problems: [String(error.message || error)],
      });
    }
  }

  console.log(JSON.stringify(rows, null, 2));
  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

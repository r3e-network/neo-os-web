#!/usr/bin/env node
/**
 * Redeploy flagship miniapp contracts to Neo N3 Testnet.
 * Usage: DEPLOYER_WIF=... node deploy/scripts/deploy-featured-testnet.js
 */
const fs = require("fs");
const path = require("path");
const Neon = require("@cityofzion/neon-js");

const RPC_URL = "https://testnet1.neo.coz.io:443";
const NETWORK_MAGIC = 894710606;
const CONTRACT_MANAGEMENT = "0xfffdc93764dbaddd97c48f252a53ea4643faa3fd";

const DEPLOYER_WIF = process.env.DEPLOYER_WIF;
if (!DEPLOYER_WIF) {
  console.error("ERROR: DEPLOYER_WIF not set");
  process.exit(1);
}

const deployer = new Neon.wallet.Account(DEPLOYER_WIF);
const rpcClient = new Neon.rpc.RPCClient(RPC_URL);
const TARGET_FILTER = new Set(
  String(process.env.FEATURED_TARGETS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);

const CONTRACTS = [
  { name: "MiniAppLastSurvivor", appDir: "last-survivor", displayName: "LastSurvivor" },
  { name: "MiniAppGASBox", appDir: "gasbox", displayName: "GASBOX" },
  { name: "MiniAppRedEnvelope", appDir: "red-envelope", displayName: "Red Envelope" },
  { name: "MiniAppDailyCheckin", appDir: "daily-checkin", displayName: "Daily Check-in" },
  { name: "MiniAppFogPlay", appDir: "fogplay", displayName: "FogPlay" },
  { name: "MiniAppSelfLoan", appDir: "self-loan", displayName: "SelfLoan" },
  { name: "MiniAppNeoPay", appDir: "neo-pay", displayName: "NeoPay" },
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForTx(txid, maxMs = 120000) {
  const deadline = Date.now() + maxMs;
  let consecutiveErrors = 0;
  while (Date.now() < deadline) {
    try {
      const log = await rpcClient.getApplicationLog(txid);
      if (log && log.executions && log.executions.length > 0) {
        const exec = log.executions[0];
        if (exec.vmstate === "HALT") {
          process.stdout.write(" ✅\n");
          return exec;
        } else {
          process.stdout.write(` ❌ FAULT: ${exec.exception}\n`);
          return null;
        }
      }
      consecutiveErrors = 0;
    } catch (err) {
      consecutiveErrors++;
      if (consecutiveErrors <= 3 || consecutiveErrors % 10 === 0) {
        console.warn(`[warn] waitForTx polling error (attempt ${consecutiveErrors}): ${err.message}`);
      }
    }
    await sleep(3000);
    process.stdout.write(".");
  }
  process.stdout.write(" ⏰ TIMEOUT\n");
  return null;
}

async function deployContract(contract) {
  const nefPath = path.resolve(__dirname, `../../contracts/build/${contract.name}.nef`);
  const manifestPath = path.resolve(__dirname, `../../contracts/build/${contract.name}.manifest.json`);

  if (!fs.existsSync(nefPath) || !fs.existsSync(manifestPath)) {
    console.error(`  ❌ Missing .nef or .manifest.json for ${contract.name}`);
    return null;
  }

  const nefBytes = fs.readFileSync(nefPath);
  const manifestStr = fs.readFileSync(manifestPath, "utf-8");
  console.log(`  📦 NEF: ${nefBytes.length} bytes | Manifest: ${manifestStr.length} chars`);

  // Dry-run via invokefunction (proven pattern from red-envelope)
  console.log("  🔍 Dry-run...");
  const dryRun = await rpcClient.execute(
    new Neon.rpc.Query({
      method: "invokefunction",
      params: [
        CONTRACT_MANAGEMENT,
        "deploy",
        [
          { type: "ByteArray", value: nefBytes.toString("base64") },
          { type: "String", value: manifestStr },
        ],
        [{ account: deployer.scriptHash, scopes: "CalledByEntry" }],
      ],
    }),
  );

  if (dryRun.state !== "HALT") {
    console.error(`  ❌ Dry-run FAULT: ${dryRun.exception || "unknown"}`);
    return null;
  }

  console.log(`  ✅ Dry-run OK — gas: ${(Number(dryRun.gasconsumed) / 1e8).toFixed(4)} GAS`);

  // Extract contract hash from Deploy notification
  let newContractHash = null;
  for (const n of dryRun.notifications || []) {
    if (n.eventname === "Deploy") {
      const hashVal = n.state?.value?.[0]?.value;
      if (hashVal) {
        newContractHash = "0x" + Neon.u.reverseHex(Buffer.from(hashVal, "base64").toString("hex"));
      }
    }
  }

  // Build TX from verified dry-run script
  const verifiedScript = Buffer.from(dryRun.script, "base64").toString("hex");
  const currentHeight = await rpcClient.getBlockCount();

  const tx = new Neon.tx.Transaction({
    signers: [{ account: deployer.scriptHash, scopes: Neon.tx.WitnessScope.CalledByEntry }],
    validUntilBlock: currentHeight + 100,
    script: verifiedScript,
  });

  tx.systemFee = Neon.u.BigInteger.fromNumber(Math.ceil(Number(dryRun.gasconsumed) * 1.5));
  tx.networkFee = Neon.u.BigInteger.fromNumber(5000000);

  tx.sign(deployer, NETWORK_MAGIC);
  const result = await rpcClient.sendRawTransaction(tx);
  const txid = result.hash || result;
  process.stdout.write(`  📤 TX: ${txid}`);

  const execResult = await waitForTx(txid);
  if (execResult && !newContractHash) {
    // Try extracting from on-chain result
    for (const n of execResult.notifications || []) {
      if (n.eventname === "Deploy") {
        const hashVal = n.state?.value?.[0]?.value;
        if (hashVal) {
          newContractHash = "0x" + Neon.u.reverseHex(Buffer.from(hashVal, "base64").toString("hex"));
        }
      }
    }
  }

  return newContractHash;
}

async function main() {
  console.log("\n🚀 Redeploying flagship contracts to Neo N3 Testnet");
  console.log(`   Deployer: ${deployer.address}`);
  console.log(`   RPC: ${RPC_URL}\n`);

  const results = {};

  const selectedContracts = TARGET_FILTER.size
    ? CONTRACTS.filter((contract) =>
        [contract.displayName, contract.appDir, contract.name].some((value) => TARGET_FILTER.has(String(value).toLowerCase())),
      )
    : CONTRACTS;

  for (const contract of selectedContracts) {
    console.log(`\n━━━ ${contract.displayName} (${contract.name}) ━━━`);
    try {
      const hash = await deployContract(contract);
      if (hash) {
        console.log(`  🎉 Contract Hash: ${hash}`);
        results[contract.appDir] = hash;
      }
    } catch (err) {
      console.error(`  ❌ Error: ${err instanceof Error ? err.message : String(err)}`);
    }
    await sleep(5000);
  }

  // Update manifests
  console.log("\n\n📋 Updating manifests...");
  for (const [appDir, hash] of Object.entries(results)) {
    const manifestPath = path.resolve(__dirname, `../../apps/${appDir}/neo-manifest.json`);
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      manifest.contracts["neo-n3-testnet"] = hash;
      if (!manifest.supported_networks.includes("neo-n3-testnet")) {
        manifest.supported_networks.push("neo-n3-testnet");
      }
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
      console.log(`  ✅ ${appDir} → ${hash}`);
    }
  }

  console.log("\n✅ Deployment complete!");
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

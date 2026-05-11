#!/usr/bin/env node

import fs from "fs";
import path from "path";
import CozNeon from "@cityofzion/neon-js";
import Neon from "./lib/neon-compat.mjs";
import liveNeo from "./lib/live_neo.js";
import { getNetworkConfig, normalizeNetworkName } from "./lib/neo_network.js";

const { stackValue, createWaitForLog, asTxid } = liveNeo;

const root = path.resolve(new URL(".", import.meta.url).pathname, "..", "..");
const network = normalizeNetworkName(process.env.ANCHOR_MIGRATION_NETWORK || process.env.NEO_TARGET_NETWORK || "mainnet");
const config = getNetworkConfig(network);
const rpcUrl = firstConfigured(
  network === "mainnet"
    ? firstConfigured(process.env.NEO_MAINNET_RPC_URL, process.env.NEO_RPC_MAINNET)
    : firstConfigured(process.env.NEO_TESTNET_RPC_URL, process.env.NEO_RPC_TESTNET, process.env.NEO_RPC_URL),
  config.rpcUrl
);
const networkMagic = Number(config.networkMagic);
const aaCoreHash = firstConfigured(
  process.env.AA_CORE_HASH,
  network === "mainnet" ? process.env.AA_CORE_HASH_MAINNET : process.env.AA_CORE_HASH_TESTNET,
  config.aaCoreHash
);
const anchorHash = firstConfigured(
  process.env.PLATFORM_ANCHOR_HASH,
  process.env[`PLATFORM_ANCHOR_${network.toUpperCase()}_HASH`],
  readManifestContract("apps/profitanchor/neo-manifest.json", config.key),
  readManifestContract("apps/trustanchor/neo-manifest.json", config.key)
);
const signerWif = firstConfigured(
  process.env.ANCHOR_MIGRATION_WIF,
  network === "mainnet" ? process.env.NEO_MAINNET_WIF : process.env.NEO_TESTNET_WIF,
  process.env.MINIAPP_MAINNET_DEPLOY_WIF,
  process.env.FLAGSHIP_MAINNET_WIF,
  process.env.FLAGSHIP_LIVE_WIF
);
const dryRun = truthy(process.env.ANCHOR_MIGRATION_DRY_RUN);
const confirmPhrase = "I_UNDERSTAND_THIS_WRITES_CHAIN";
const apps = [
  { appId: "miniapp-profitanchor", label: "ProfitAnchor" },
  { appId: "miniapp-trustanchor", label: "TrustAnchor" },
];

if (!dryRun && process.env.CONFIRM_ANCHOR_AGENT_MIGRATION !== confirmPhrase) {
  throw new Error(`set CONFIRM_ANCHOR_AGENT_MIGRATION=${confirmPhrase} to write chain`);
}
if (!network) throw new Error("unsupported network");
if (!anchorHash) throw new Error("PlatformAnchor hash is required");
if (!signerWif) throw new Error("anchor migration signer WIF is required");

const rpcClient = new Neon.rpc.RPCClient(rpcUrl);
const signer = new Neon.wallet.Account(signerWif);
const contract = new Neon.experimental.SmartContract(anchorHash, {
  rpcAddress: rpcUrl,
  networkMagic,
  account: signer,
});
const waitForLog = createWaitForLog({
  getApplicationLog: (txid) => rpcClient.getApplicationLog(txid),
  label: "anchor_agent_migration",
});

const report = {
  generatedAt: new Date().toISOString(),
  network,
  rpcUrl,
  anchorHash,
  aaCoreHash,
  signer: signer.address,
  signerHash: normalizeHash160(`0x${signer.scriptHash}`),
  dryRun,
  apps: {},
  transactions: [],
};

await assertNetworkMagic();
await assertAdmin();

for (const app of apps) {
  report.apps[app.appId] = await migrateApp(app);
}

const reportPath = path.join(root, "docs", "reports", `anchor-aa-proxy-migration-${network}.json`);
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));

async function migrateApp({ appId, label }) {
  const count = toBigIntValue(await invokeRead("getAgentCount", [Neon.sc.ContractParam.string(appId)]));
  if (count !== 21n) {
    throw new Error(`${label} expected 21 agents, got ${count.toString()}`);
  }

  const rows = [];
  for (let i = 1; i <= Number(count); i++) {
    const agent = await readAgent(appId, i);
    const expectedProxy = deriveAaProxyHash(agent.accountId);
    const needsMigration = agent.account !== expectedProxy || agent.storedAccountId !== agent.accountId;
    const row = {
      agentId: i,
      accountId: agent.accountId,
      storedAccountId: agent.storedAccountId,
      currentAccount: agent.account,
      expectedProxyAccount: expectedProxy,
      migrated: false,
      txid: null,
      skippedReason: needsMigration ? null : "already migrated",
    };
    if (needsMigration && !dryRun) {
      const txid = await contract.invoke("setAgentAccount", [
        Neon.sc.ContractParam.string(appId),
        Neon.sc.ContractParam.integer(String(i)),
        Neon.sc.ContractParam.hash160(expectedProxy),
        Neon.sc.ContractParam.byteArray(Neon.u.HexString.fromHex(stripHexPrefix(agent.accountId))),
      ]);
      const normalizedTxid = asTxid(txid);
      const log = await waitForLog(normalizedTxid);
      if (log.execution.vmstate !== "HALT") {
        throw new Error(log.execution.exception || `${label} agent ${i} migration failed`);
      }
      row.migrated = true;
      row.txid = normalizedTxid;
      report.transactions.push({ label: `${label} agent ${i} AA proxy migration`, txid: normalizedTxid });
    }
    rows.push(row);
  }
  return rows;
}

async function readAgent(appId, agentId) {
  const value = await invokeRead("getAgent", [
    Neon.sc.ContractParam.string(appId),
    Neon.sc.ContractParam.integer(String(agentId)),
  ]);
  const account = normalizeHash160(value.account);
  const storedAccountId = normalizeHash160(value.verificationScriptHash);
  const accountId = resolveAnchorAccountId(account, storedAccountId);
  return {
    account,
    storedAccountId,
    accountId,
    active: Boolean(value.active),
  };
}

async function invokeRead(method, args = []) {
  const res = await rpcClient.invokeFunction(anchorHash, method, args);
  if (String(res?.state || "").toUpperCase() === "FAULT") {
    throw new Error(`${method} faulted: ${res.exception || "unknown error"}`);
  }
  return res.stack?.[0] ? stackValue(res.stack[0]) : null;
}

async function assertNetworkMagic() {
  const version = await rpcClient.send("getversion", []);
  const actualMagic = Number(version?.protocol?.network);
  if (actualMagic !== networkMagic) {
    throw new Error(`RPC network magic mismatch: expected ${networkMagic}, got ${actualMagic}`);
  }
}

async function assertAdmin() {
  const admin = normalizeHash160(await invokeRead("admin"));
  if (admin !== report.signerHash) {
    throw new Error("migration signer is not PlatformAnchor admin");
  }
}

function readManifestContract(rel, key) {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
    return String(manifest?.contracts?.[key] || "").trim();
  } catch {
    return "";
  }
}

function buildAaVerifyScript(accountIdHash) {
  const accountId = stripHexPrefix(normalizeHash160(accountIdHash));
  const core = stripHexPrefix(normalizeHash160(aaCoreHash));
  if (!/^[0-9a-f]{40}$/.test(accountId)) throw new Error(`invalid accountId ${accountIdHash}`);
  if (!/^[0-9a-f]{40}$/.test(core)) throw new Error(`invalid AA core hash ${aaCoreHash}`);
  return `0c14${accountId}11c01f0c067665726966790c14${reverseHex(core)}41627d5b52`;
}

function deriveAaProxyHash(accountIdHash) {
  return normalizeHash160(CozNeon.wallet.getScriptHashFromVerificationScript(buildAaVerifyScript(accountIdHash)));
}

function resolveAnchorAccountId(account, storedAccountId) {
  if (!storedAccountId) return "";
  if (account && deriveAaProxyHash(storedAccountId) === account) return storedAccountId;
  const reversed = normalizeHash160(reverseHex(storedAccountId));
  if (account && deriveAaProxyHash(reversed) === account) return reversed;
  return storedAccountId;
}

function normalizeHash160(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return "";
  if (text.startsWith("0x")) return text;
  return /^[0-9a-f]{40}$/.test(text) ? `0x${text}` : text;
}

function stripHexPrefix(value) {
  return String(value || "").trim().replace(/^0x/i, "").toLowerCase();
}

function reverseHex(value) {
  return stripHexPrefix(value).match(/../g)?.reverse().join("") || "";
}

function firstConfigured(...values) {
  return values.map((value) => String(value || "").trim()).find(Boolean) || "";
}

function toBigIntValue(value) {
  try {
    return BigInt(String(value ?? "0"));
  } catch {
    return 0n;
  }
}

function truthy(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const { wallet } = require("@cityofzion/neon-js");
const { MAINNET_MAGIC } = require("./lib/neo_network");

const ROOT = path.resolve(__dirname, "../..");
const APPS_DIR = path.join(ROOT, "apps");
const GENERATED_MORPHEUS_REGISTRY = path.join(
  ROOT,
  "apps",
  "shared",
  "constants",
  "generated-morpheus-registry.ts",
);
const REPORT_PATH = path.join(ROOT, "docs", "reports", "contract-domain-coverage-latest.json");
const LEGACY_REPORT_PATH = path.join(ROOT, "docs", "reports", "mainnet-domain-bindings-latest.json");
const MAINNET_KEY = "neo-n3-mainnet";
const NNS_CONTRACT_HASH = "0x50ac1c37690cc2cfc594472833cf57505d5f46de";
const NNS_RECORD_TYPE_TEXT = 16;
const RPC_CANDIDATES = [
  process.env.NEO_RPC_MAINNET,
  process.env.NEO_MAINNET_RPC_URL,
  process.env.NEO_N3_MAINNET_RPC_URL,
  "https://api.n3index.dev/mainnet",
  "https://mainnet2.neo.coz.io:443",
  "https://mainnet1.neo.coz.io:443",
]
  .map((value) => String(value || "").trim())
  .filter(Boolean)
  .filter((value, index, list) => list.indexOf(value) === index);

const ARCHIVED_APP_SLUGS = new Set(["neoburger", "neo-burger", "flamingo", "flaminggo"]);

const args = new Set(process.argv.slice(2));
const SKIP_RPC = args.has("--skip-rpc");
const FAIL_ON_CONFIG_MISSING = args.has("--fail-on-config-missing") || args.has("--strict");
const FAIL_ON_CHAIN_MISMATCH = args.has("--fail-on-chain-mismatch") || args.has("--strict");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(`${filePath}.tmp`, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(`${filePath}.tmp`, filePath);
}

function normalizeHash(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  return raw.startsWith("0x") ? raw : `0x${raw}`;
}

function hashToAddress(hash) {
  const normalized = normalizeHash(hash).replace(/^0x/, "");
  if (!/^[0-9a-f]{40}$/i.test(normalized)) return "";
  return wallet.getAddressFromScriptHash(normalized);
}

function getContractHashValue(value) {
  if (typeof value === "string") return normalizeHash(value);
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return normalizeHash(value.hash || value.contract_hash || value.address || value.contractAddress);
  }
  return "";
}

function getNetworkEntry(object, networkKey) {
  if (!object || typeof object !== "object" || Array.isArray(object)) return null;
  return object[networkKey] || object[networkKey === MAINNET_KEY ? "mainnet" : "testnet"] || null;
}

function getManifestMainnetDomain(manifest, contractHash) {
  const contractDomains = manifest.contract_domains || manifest.contractDomains || {};
  const directDomain = String(
    getNetworkEntry(contractDomains, MAINNET_KEY)
      || contractDomains[contractHash]
      || contractDomains[contractHash.replace(/^0x/, "")]
      || "",
  ).trim();
  if (directDomain) return directDomain;

  const deployment = getNetworkEntry(manifest.deployment, MAINNET_KEY);
  if (deployment && typeof deployment === "object" && !Array.isArray(deployment)) {
    const deploymentDomain = String(deployment.domain || deployment.nns || "").trim();
    if (deploymentDomain) return deploymentDomain;
  }

  const modules = Array.isArray(manifest.runtime?.modules) ? manifest.runtime.modules : [];
  for (const module of modules) {
    const network = getNetworkEntry(module.networks, MAINNET_KEY);
    if (!network || typeof network !== "object" || Array.isArray(network)) continue;
    const networkHash = normalizeHash(network.contract_hash || network.hash || network.contractAddress);
    const networkDomain = String(network.domain || network.nns || "").trim();
    if (networkDomain && (!networkHash || networkHash === contractHash)) return networkDomain;
  }

  return "";
}

function loadMiniAppRecords() {
  const records = [];
  for (const entry of fs.readdirSync(APPS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "shared") continue;
    if (ARCHIVED_APP_SLUGS.has(entry.name.trim().toLowerCase())) continue;

    const manifestPath = path.join(APPS_DIR, entry.name, "neo-manifest.json");
    if (!fs.existsSync(manifestPath)) continue;

    const manifest = readJson(manifestPath);
    const contractHash = getContractHashValue(getNetworkEntry(manifest.contracts, MAINNET_KEY));
    if (!contractHash) continue;

    records.push({
      source: "miniapp",
      id: manifest.id || `miniapp-${entry.name}`,
      name: manifest.name || entry.name,
      slug: entry.name,
      manifest_path: path.relative(ROOT, manifestPath),
      contract_key: "primary",
      contract_hash: contractHash,
      expected_address: hashToAddress(contractHash),
      domain: getManifestMainnetDomain(manifest, contractHash),
    });
  }
  return records.sort((a, b) => `${a.source}:${a.id}`.localeCompare(`${b.source}:${b.id}`));
}

function parseGeneratedMorpheusRegistry() {
  const text = fs.readFileSync(GENERATED_MORPHEUS_REGISTRY, "utf8");
  const match = text.match(/export const MORPHEUS_PUBLIC_REGISTRY = ([\s\S]*?) as const;/);
  if (!match) {
    throw new Error(`Unable to parse ${path.relative(ROOT, GENERATED_MORPHEUS_REGISTRY)}`);
  }
  return JSON.parse(match[1]);
}

function loadExternalRecords() {
  const registry = parseGeneratedMorpheusRegistry().mainnet;
  const bindings = [
    ["abstract-account:core", "AA Core", "aaCore", "aaCore"],
    ["abstract-account:web3auth", "AA Web3Auth verifier", "aaWeb3AuthVerifier", "aaWeb3AuthVerifier"],
    ["abstract-account:session-key", "AA Session Key verifier", "aaSessionKeyVerifier", "aaSessionKeyVerifier"],
    ["abstract-account:social-recovery", "AA Social Recovery verifier", "aaSocialRecoveryVerifier", "aaSocialRecoveryVerifier"],
    ["abstract-account:address-market", "AA Address Market", "aaAddressMarket", "aaAddressMarket"],
    ["abstract-account:paymaster", "AA Paymaster", "aaPaymaster", "aaPaymaster"],
    ["morpheus:oracle", "Morpheus Oracle", "morpheusOracle", "oracle"],
    ["morpheus:callback-consumer", "Morpheus Callback Consumer", "oracleCallbackConsumer", "callbackConsumer"],
    ["morpheus:datafeed", "Morpheus DataFeed", "morpheusDatafeed", "datafeed"],
    ["morpheus:neodid", "Morpheus NeoDID", "morpheusNeoDid", "neodid"],
  ];

  return bindings
    .map(([id, name, contractKey, domainKey]) => {
      const contractHash = normalizeHash(registry.contracts?.[contractKey]);
      return {
        source: id.startsWith("morpheus:") ? "morpheus" : "abstract-account",
        id,
        name,
        slug: id,
        manifest_path: path.relative(ROOT, GENERATED_MORPHEUS_REGISTRY),
        contract_key: contractKey,
        contract_hash: contractHash,
        expected_address: hashToAddress(contractHash),
        domain: String(registry.domains?.[domainKey] || "").trim(),
      };
    })
    .filter((record) => record.contract_hash);
}

async function fetchJsonRpc(rpcUrl, method, params = [], timeoutMs = 20000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: controller.signal,
    });
    const text = await response.text();
    if (!text.trim()) throw new Error(`${rpcUrl}: empty response for ${method}`);
    const json = JSON.parse(text);
    if (json.error) throw new Error(`${rpcUrl}: ${json.error.message || json.error.code || "rpc error"}`);
    return json.result;
  } finally {
    clearTimeout(timeout);
  }
}

function getVersionMagic(version) {
  return Number(version?.protocol?.network || version?.network || 0);
}

async function selectMainnetRpc() {
  const errors = [];
  for (const rpcUrl of RPC_CANDIDATES) {
    try {
      const version = await fetchJsonRpc(rpcUrl, "getversion", []);
      const magic = getVersionMagic(version);
      if (magic !== MAINNET_MAGIC) {
        throw new Error(`network magic mismatch: expected ${MAINNET_MAGIC}, got ${magic || "unknown"}`);
      }
      return { rpcUrl, magic };
    } catch (error) {
      errors.push(`${rpcUrl}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(`No usable Neo N3 mainnet RPC. ${errors.join("; ")}`);
}

function decodeStackText(stackItem) {
  if (!stackItem || stackItem.type === "Any" || stackItem.value == null) return "";
  if (stackItem.type === "ByteString") {
    return Buffer.from(String(stackItem.value), "base64").toString("utf8").trim();
  }
  return String(stackItem.value || "").trim();
}

function domainToTokenId(domain) {
  return Buffer.from(String(domain || "").trim().toLowerCase(), "utf8").toString("base64");
}

function parentDomain(domain) {
  const parts = String(domain || "").trim().toLowerCase().split(".").filter(Boolean);
  return parts.length > 2 ? parts.slice(1).join(".") : "";
}

function decodeOwnerAddress(stackItem) {
  if (!stackItem || stackItem.type !== "ByteString" || !stackItem.value) return "";
  const hex = Buffer.from(String(stackItem.value), "base64").toString("hex");
  if (!/^[0-9a-f]{40}$/i.test(hex)) return "";
  return wallet.getAddressFromScriptHash(hex);
}

async function resolveDomain(rpcUrl, domain) {
  if (!domain) return { resolved_address: "", nns_status: "config_missing", nns_error: null };
  try {
    const result = await fetchJsonRpc(rpcUrl, "invokefunction", [
      NNS_CONTRACT_HASH,
      "resolve",
      [
        { type: "String", value: domain },
        { type: "Integer", value: String(NNS_RECORD_TYPE_TEXT) },
      ],
    ]);
    if (String(result?.state || "").toUpperCase() !== "HALT") {
      return {
        resolved_address: "",
        nns_status: "error",
        nns_error: result?.exception || `VM state ${result?.state || "unknown"}`,
      };
    }
    const resolved = decodeStackText(result?.stack?.[0]);
    return {
      resolved_address: resolved,
      nns_status: resolved ? "resolved" : "missing",
      nns_error: null,
    };
  } catch (error) {
    return {
      resolved_address: "",
      nns_status: "error",
      nns_error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function getDomainOwner(rpcUrl, domain) {
  if (!domain) return { owner_address: "", owner_status: "config_missing", owner_error: null };
  try {
    const result = await fetchJsonRpc(rpcUrl, "invokefunction", [
      NNS_CONTRACT_HASH,
      "ownerOf",
      [
        { type: "ByteArray", value: domainToTokenId(domain) },
      ],
    ]);
    if (String(result?.state || "").toUpperCase() !== "HALT") {
      return {
        owner_address: "",
        owner_status: "unregistered",
        owner_error: result?.exception || `VM state ${result?.state || "unknown"}`,
      };
    }
    const owner = decodeOwnerAddress(result?.stack?.[0]);
    return {
      owner_address: owner,
      owner_status: owner ? "registered" : "unregistered",
      owner_error: null,
    };
  } catch (error) {
    return {
      owner_address: "",
      owner_status: "error",
      owner_error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function withConcurrency(items, limit, worker) {
  const out = new Array(items.length);
  let index = 0;
  async function run() {
    while (index < items.length) {
      const current = index;
      index += 1;
      out[current] = await worker(items[current], current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return out;
}

function classifyRecord(record) {
  if (!record.domain) return "config_missing";
  if (record.nns_status === "skipped") return "configured_unverified";
  if (record.nns_status === "error") return "chain_error";
  if (!record.resolved_address) return "chain_missing";
  if (record.resolved_address !== record.expected_address) return "chain_mismatch";
  return "ok";
}

function annotateResolvedMatch(record) {
  if (!record.resolved_address) return "";
  if (record.resolved_address === record.expected_address) return "address";
  return "";
}

function dedupeDomainBindings(records) {
  const seen = new Set();
  const out = [];
  for (const record of records) {
    const key = `${record.domain}|${record.expected_address}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(record);
  }
  return out;
}

async function main() {
  const startedAt = new Date().toISOString();
  const records = [...loadMiniAppRecords(), ...loadExternalRecords()];
  const configMissing = records.filter((record) => !record.domain);

  let rpc = null;
  if (!SKIP_RPC) {
    rpc = await selectMainnetRpc();
  }

  const resolved = SKIP_RPC
    ? records.map((record) => ({
        ...record,
        resolved_address: "",
        nns_status: record.domain ? "skipped" : "config_missing",
        nns_error: null,
        owner_address: "",
        owner_status: record.domain ? "skipped" : "config_missing",
        owner_error: null,
        parent_domain: parentDomain(record.domain),
        parent_owner_address: "",
        parent_owner_status: record.domain ? "skipped" : "config_missing",
        parent_owner_error: null,
      }))
    : await withConcurrency(records, 5, async (record) => {
        const parent = parentDomain(record.domain);
        const parentOwner = parent
          ? await getDomainOwner(rpc.rpcUrl, parent)
          : { owner_address: "", owner_status: "", owner_error: null };
        return {
          ...record,
          parent_domain: parent,
          ...(await resolveDomain(rpc.rpcUrl, record.domain)),
          ...(await getDomainOwner(rpc.rpcUrl, record.domain)),
          parent_owner_address: parentOwner.owner_address,
          parent_owner_status: parentOwner.owner_status,
          parent_owner_error: parentOwner.owner_error,
        };
      });

  const enriched = resolved.map((record) => {
    const resolved_match = annotateResolvedMatch(record);
    const normalizedRecord = { ...record, resolved_match };
    return {
      ...normalizedRecord,
      status: resolved_match ? "ok" : classifyRecord(normalizedRecord),
    };
  });
  const domainBindings = dedupeDomainBindings(enriched);
  const actionable = domainBindings.filter((record) => record.status !== "ok" && record.status !== "configured_unverified");

  const summary = {
    generated_at: new Date().toISOString(),
    started_at: startedAt,
    network: "neo-n3-mainnet",
    rpc_url: rpc?.rpcUrl || null,
    network_magic: rpc?.magic || MAINNET_MAGIC,
    total_contract_bindings: enriched.length,
    configured: enriched.filter((record) => record.domain).length,
    config_missing: enriched.filter((record) => record.status === "config_missing").length,
    chain_ok: enriched.filter((record) => record.status === "ok").length,
    chain_missing: enriched.filter((record) => record.status === "chain_missing").length,
    chain_mismatch: enriched.filter((record) => record.status === "chain_mismatch").length,
    chain_error: enriched.filter((record) => record.status === "chain_error").length,
    unique_domain_bindings: domainBindings.length,
    unique_configured_domains: domainBindings.filter((record) => record.domain).length,
    unique_chain_ok: domainBindings.filter((record) => record.status === "ok").length,
    unique_chain_missing: domainBindings.filter((record) => record.status === "chain_missing").length,
    unique_chain_mismatch: domainBindings.filter((record) => record.status === "chain_mismatch").length,
    unique_chain_error: domainBindings.filter((record) => record.status === "chain_error").length,
    unique_actionable: actionable.length,
    skipped_rpc: SKIP_RPC,
  };

  const report = {
    summary,
    records: enriched,
    domain_bindings: domainBindings,
    actionable,
  };

  writeJson(REPORT_PATH, report);
  writeJson(LEGACY_REPORT_PATH, report);

  const statusLine = [
    `contract domains: ${summary.configured}/${summary.total_contract_bindings} configured`,
    `unique=${summary.unique_configured_domains}/${summary.unique_domain_bindings}`,
    `chain ok=${summary.chain_ok}`,
    `missing=${summary.chain_missing}`,
    `mismatch=${summary.chain_mismatch}`,
    `errors=${summary.chain_error}`,
    `unique actionable=${summary.unique_actionable}`,
  ].join(", ");
  console.log(statusLine);
  console.log(`report: ${path.relative(ROOT, REPORT_PATH)}`);

  const shouldFailConfig = FAIL_ON_CONFIG_MISSING && configMissing.length > 0;
  const shouldFailChain =
    FAIL_ON_CHAIN_MISMATCH
    && enriched.some((record) => ["chain_missing", "chain_mismatch", "chain_error"].includes(record.status));
  if (shouldFailConfig || shouldFailChain) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

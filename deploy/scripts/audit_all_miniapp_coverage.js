#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const APPS_DIR = path.join(ROOT, "apps");
const CONTRACTS_DIR = path.join(ROOT, "contracts");
const TESTNET_NETWORK_MAGIC = 894710606;
const MAINNET_NETWORK_MAGIC = 860833102;
const TESTNET_RPC =
  process.env.NEO_RPC_TESTNET ||
  process.env.NEO_TESTNET_RPC_URL ||
  process.env.TESTNET_RPC_URL ||
  "https://api.n3index.dev/testnet";
const MAINNET_RPC =
  process.env.NEO_RPC_MAINNET ||
  process.env.NEO_MAINNET_RPC_URL ||
  process.env.MAINNET_RPC_URL ||
  "https://api.n3index.dev/mainnet";
const ARCHIVED_APP_SLUGS = new Set(["neoburger", "neo-burger", "flamingo", "flaminggo"]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function hasPlatformRuntimeSource(manifest) {
  const modules = Array.isArray(manifest?.runtime?.modules) ? manifest.runtime.modules : [];
  return modules.some((module) => {
    const platform = String(module?.platform || "").trim();
    if (!platform) return false;
    return fs.existsSync(path.join(CONTRACTS_DIR, "platform", platform, `${platform}.csproj`));
  });
}

function hasContractSource(appName, manifest) {
  const slug = appName.replace(/-/g, "").toLowerCase();
  const dedicatedSource = fs.readdirSync(CONTRACTS_DIR).some((entry) => {
    const csproj = path.join(CONTRACTS_DIR, entry, `${entry}.csproj`);
    if (!fs.existsSync(csproj)) return false;
    const norm = entry.toLowerCase().replace(/miniapp/g, "");
    return norm.includes(slug) || slug.includes(norm);
  });
  return dedicatedSource || hasPlatformRuntimeSource(manifest);
}

function readReadme(appName, fileName = "README.md") {
  const filePath = path.join(APPS_DIR, appName, fileName);
  if (!fs.existsSync(filePath)) return "";
  return fs.readFileSync(filePath, "utf8");
}

function sectionIncludesHash(text, sectionHeading, hash) {
  const normalizedHash = String(hash || "").trim().toLowerCase();
  if (!text || !sectionHeading || !normalizedHash) return true;

  const normalized = String(text).toLowerCase();
  const marker = sectionHeading.toLowerCase();
  const sectionStart = normalized.indexOf(marker);
  if (sectionStart === -1) return true;

  const nextHeading = normalized.indexOf("\n##", sectionStart + marker.length);
  const section = normalized.slice(sectionStart, nextHeading === -1 ? normalized.length : nextHeading);
  return section.includes(normalizedHash);
}

async function contractExists(rpcUrl, hash) {
  if (!hash) return { exists: false, name: null, error: null };
  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getcontractstate",
        params: [hash],
      }),
    });
    const data = await response.json();
    if (data.error) {
      return { exists: false, name: null, error: data.error.message || "rpc error" };
    }
    return { exists: true, name: data.result?.manifest?.name || null, error: null };
  } catch (error) {
    return { exists: false, name: null, error: error instanceof Error ? error.message : String(error) };
  }
}

async function rpcCall(rpcUrl, method, params = []) {
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
  if (data.error) throw new Error(data.error.message || "rpc error");
  return data.result;
}

async function assertRpcNetwork(rpcUrl, expectedMagic, label) {
  const version = await rpcCall(rpcUrl, "getversion");
  const networkMagic = Number(version?.protocol?.network);
  if (networkMagic !== expectedMagic) {
    throw new Error(
      `${label} RPC network magic mismatch: expected ${expectedMagic}, got ${networkMagic || "unknown"}`
    );
  }
  return networkMagic;
}

function classify(manifest, testnetState, mainnetState, sourcePresent) {
  const testnetHash = String(manifest.contracts?.["neo-n3-testnet"] || "").trim();
  const mainnetHash = String(manifest.contracts?.["neo-n3-mainnet"] || "").trim();
  if (!testnetHash && !mainnetHash) {
    return sourcePresent ? "source-only" : "frontend-only";
  }
  if (testnetHash && testnetState.exists && mainnetHash && mainnetState.exists) {
    return "testnet+mainnet";
  }
  if (testnetHash && testnetState.exists && (!mainnetHash || !mainnetState.exists)) {
    return "testnet-only";
  }
  if ((!testnetHash || !testnetState.exists) && mainnetHash && mainnetState.exists) {
    return sourcePresent ? "mainnet-only-needs-testnet" : "mainnet-only-no-source";
  }
  return "stale-or-missing";
}

function deploymentStatus(manifest, network) {
  const deployment = manifest.deployment;
  if (!deployment || typeof deployment !== "object" || Array.isArray(deployment)) return "";
  const entry = deployment[network] || deployment[network === "neo-n3-mainnet" ? "mainnet" : "testnet"];
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return "";
  return String(entry.status || "").trim();
}

function deploymentReason(manifest, network) {
  const deployment = manifest.deployment;
  if (!deployment || typeof deployment !== "object" || Array.isArray(deployment)) return "";
  const entry = deployment[network] || deployment[network === "neo-n3-mainnet" ? "mainnet" : "testnet"];
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return "";
  return String(entry.reason || "").trim();
}

async function main() {
  const [testnetMagic, mainnetMagic] = await Promise.all([
    assertRpcNetwork(TESTNET_RPC, TESTNET_NETWORK_MAGIC, "testnet"),
    assertRpcNetwork(MAINNET_RPC, MAINNET_NETWORK_MAGIC, "mainnet"),
  ]);

  const apps = fs.readdirSync(APPS_DIR)
    .filter((name) => !ARCHIVED_APP_SLUGS.has(String(name).trim().toLowerCase()))
    .filter((name) => fs.existsSync(path.join(APPS_DIR, name, "neo-manifest.json")));
  const rows = [];

  for (const app of apps) {
    const manifest = readJson(path.join(APPS_DIR, app, "neo-manifest.json"));
    const sourcePresent = hasContractSource(app, manifest);
    const testnetHash = String(manifest.contracts?.["neo-n3-testnet"] || "").trim();
    const mainnetHash = String(manifest.contracts?.["neo-n3-mainnet"] || "").trim();
    const [testnetState, mainnetState] = await Promise.all([
      contractExists(TESTNET_RPC, testnetHash),
      contractExists(MAINNET_RPC, mainnetHash),
    ]);

    const readme = readReadme(app);
    const readmeZh = readReadme(app, "README.zh-CN.md");
    const staleReadmeFlags = [];
    if (/Not deployed|未部署/.test(readme) || /未部署/.test(readmeZh)) staleReadmeFlags.push("not-deployed-marker");
    if (/PaymentHub/.test(readme) || /PaymentHub/.test(readmeZh)) staleReadmeFlags.push("paymenthub-reference");
    if (testnetHash && (!sectionIncludesHash(readme, "### Testnet", testnetHash) || !sectionIncludesHash(readmeZh, "### Testnet", testnetHash))) {
      staleReadmeFlags.push("testnet-contract-hash-mismatch");
    }
    if (mainnetHash && (!sectionIncludesHash(readme, "### Mainnet", mainnetHash) || !sectionIncludesHash(readmeZh, "### Mainnet", mainnetHash))) {
      staleReadmeFlags.push("mainnet-contract-hash-mismatch");
    }

    const classification = classify(manifest, testnetState, mainnetState, sourcePresent);
    rows.push({
      app,
      app_id: manifest.id || "",
      classification,
      source_present: sourcePresent,
      stateless: Boolean(manifest.features?.stateless),
      testnet_hash: testnetHash || null,
      testnet_exists: testnetState.exists,
      testnet_name: testnetState.name,
      mainnet_hash: mainnetHash || null,
      mainnet_exists: mainnetState.exists,
      mainnet_name: mainnetState.name,
      mainnet_release_status: deploymentStatus(manifest, "neo-n3-mainnet") || null,
      mainnet_release_reason: deploymentReason(manifest, "neo-n3-mainnet") || null,
      action_required:
        classification === "testnet-only" && deploymentStatus(manifest, "neo-n3-mainnet") !== "deferred"
          ? "decide-mainnet-release-or-mark-deferred"
          : null,
      stale_readme_flags: staleReadmeFlags,
    });
  }

  rows.sort((a, b) => a.app.localeCompare(b.app));
  console.log(JSON.stringify({
    generated_at: new Date().toISOString(),
    testnet_rpc: TESTNET_RPC,
    mainnet_rpc: MAINNET_RPC,
    testnet_network_magic: testnetMagic,
    mainnet_network_magic: mainnetMagic,
    summary: rows.reduce((acc, row) => {
      acc[row.classification] = (acc[row.classification] || 0) + 1;
      return acc;
    }, {}),
    action_required: rows.filter((row) => row.action_required),
    rows,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

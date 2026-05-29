#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const APPS_DIR = path.join(ROOT, "apps");
const CONTRACTS_DIR = path.join(ROOT, "contracts");
const TESTNET_NETWORK_MAGIC = 894710606;
const MAINNET_NETWORK_MAGIC = 860833102;
const DEFAULT_TESTNET_RPC_CANDIDATES = [
  "https://api.n3index.dev/testnet",
  "https://testnet1.neo.coz.io:443",
];
const DEFAULT_MAINNET_RPC_CANDIDATES = [
  "https://api.n3index.dev/mainnet",
  "https://mainnet2.neo.coz.io:443",
  "https://mainnet1.neo.coz.io:443",
];
const TESTNET_RPC_CANDIDATES = buildRpcCandidates(
  [
    process.env.NEO_RPC_TESTNET,
    process.env.NEO_TESTNET_RPC_URL,
    process.env.NEO_N3_TESTNET_RPC_URL,
    process.env.TESTNET_RPC_URL,
  ],
  DEFAULT_TESTNET_RPC_CANDIDATES,
);
const MAINNET_RPC_CANDIDATES = buildRpcCandidates(
  [
    process.env.NEO_RPC_MAINNET,
    process.env.NEO_MAINNET_RPC_URL,
    process.env.NEO_N3_MAINNET_RPC_URL,
    process.env.MAINNET_RPC_URL,
  ],
  DEFAULT_MAINNET_RPC_CANDIDATES,
);
const ARCHIVED_APP_SLUGS = new Set([
  "neoburger",
  "neo-burger",
  "flamingo",
  "flaminggo",
]);

function buildRpcCandidates(values, defaults) {
  return [...values, ...defaults]
    .flatMap((value) => String(value || "").split(","))
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function hasPlatformRuntimeSource(manifest) {
  const modules = Array.isArray(manifest?.runtime?.modules)
    ? manifest.runtime.modules
    : [];
  return modules.some((module) => {
    const platform = String(module?.platform || "").trim();
    if (!platform) return false;
    return fs.existsSync(
      path.join(CONTRACTS_DIR, "platform", platform, `${platform}.csproj`),
    );
  });
}

function hasExternalContractSource(manifest) {
  const source =
    manifest?.contract_source || manifest?.external_contract_source;
  if (!source || typeof source !== "object" || Array.isArray(source))
    return false;

  const repository = String(source.repository || "").trim();
  const sourcePath = String(source.path || source.project || "").trim();
  if (!repository || !sourcePath) return false;

  const repoCandidates = [
    path.resolve(ROOT, "..", repository),
    path.resolve(ROOT, "..", "..", repository),
    path.resolve("/Users/jinghuiliao/git", repository),
  ];

  return repoCandidates.some((repoRoot) =>
    fs.existsSync(path.join(repoRoot, sourcePath)),
  );
}

function hasContractSource(appName, manifest) {
  const slug = appName.replace(/-/g, "").toLowerCase();
  const dedicatedSource = fs.readdirSync(CONTRACTS_DIR).some((entry) => {
    const csproj = path.join(CONTRACTS_DIR, entry, `${entry}.csproj`);
    if (!fs.existsSync(csproj)) return false;
    const norm = entry.toLowerCase().replace(/miniapp/g, "");
    return norm.includes(slug) || slug.includes(norm);
  });
  return (
    dedicatedSource ||
    hasPlatformRuntimeSource(manifest) ||
    hasExternalContractSource(manifest)
  );
}

function readReadme(appName, fileName = "README.md") {
  const filePath = path.join(APPS_DIR, appName, fileName);
  if (!fs.existsSync(filePath)) return "";
  return fs.readFileSync(filePath, "utf8");
}

function sectionIncludesHash(text, sectionHeading, hash) {
  const normalizedHash = String(hash || "")
    .trim()
    .toLowerCase();
  if (!text || !sectionHeading || !normalizedHash) return true;

  const normalized = String(text).toLowerCase();
  const marker = sectionHeading.toLowerCase();
  const sectionStart = normalized.indexOf(marker);
  if (sectionStart === -1) return true;

  const nextHeading = normalized.indexOf("\n##", sectionStart + marker.length);
  const section = normalized.slice(
    sectionStart,
    nextHeading === -1 ? normalized.length : nextHeading,
  );
  return section.includes(normalizedHash);
}

async function contractExists(rpcUrl, hash) {
  if (!hash) return { exists: false, name: null, error: null };
  try {
    const result = await rpcCall(rpcUrl, "getcontractstate", [hash], {
      timeoutMs: 8000,
      attempts: 2,
    });
    return {
      exists: true,
      name: result?.manifest?.name || null,
      error: null,
      rpc_url: rpcUrl,
    };
  } catch (error) {
    return {
      exists: false,
      name: null,
      error: error instanceof Error ? error.message : String(error),
      rpc_url: rpcUrl,
    };
  }
}

async function rpcCall(
  rpcUrl,
  method,
  params = [],
  { timeoutMs = 8000, attempts = 3 } = {},
) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method,
          params,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const data = await response.json();
      if (data?.error) throw new Error(data.error.message || "rpc error");
      return data?.result;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
      }
    }
  }
  throw new Error(
    lastError instanceof Error
      ? lastError.message
      : String(lastError || "rpc error"),
  );
}

async function assertRpcNetwork(rpcUrl, expectedMagic, label) {
  const version = await rpcCall(rpcUrl, "getversion", [], {
    timeoutMs: 8000,
    attempts: 3,
  });
  const networkMagic = Number(version?.protocol?.network);
  if (networkMagic !== expectedMagic) {
    throw new Error(
      `${label} RPC network magic mismatch: expected ${expectedMagic}, got ${networkMagic || "unknown"}`,
    );
  }
  return networkMagic;
}

async function resolveRpcCandidates(rpcUrls, expectedMagic, label) {
  const resolved = [];
  const errors = [];
  for (const rpcUrl of rpcUrls) {
    try {
      const networkMagic = await assertRpcNetwork(rpcUrl, expectedMagic, label);
      resolved.push({ rpcUrl, networkMagic });
    } catch (error) {
      errors.push(
        `${rpcUrl}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  if (!resolved.length) {
    throw new Error(`No usable ${label} RPC. ${errors.join("; ")}`);
  }
  return resolved;
}

async function contractExistsAcrossCandidates(rpcCandidates, hash) {
  if (!hash) return { exists: false, name: null, error: null, errors: [] };
  const errors = [];
  for (const candidate of rpcCandidates) {
    const state = await contractExists(candidate.rpcUrl, hash);
    if (state.exists) {
      return { ...state, errors };
    }
    if (state.error) {
      errors.push(state.error);
    }
  }
  return { exists: false, name: null, error: errors[0] || null, errors };
}

function classify(manifest, testnetState, mainnetState, sourcePresent) {
  const testnetHash = String(
    manifest.contracts?.["neo-n3-testnet"] || "",
  ).trim();
  const mainnetHash = String(
    manifest.contracts?.["neo-n3-mainnet"] || "",
  ).trim();
  if (!testnetHash && !mainnetHash) {
    return sourcePresent ? "source-only" : "frontend-only";
  }
  if (
    testnetHash &&
    testnetState.exists &&
    mainnetHash &&
    mainnetState.exists
  ) {
    return "testnet+mainnet";
  }
  if (
    testnetHash &&
    testnetState.exists &&
    (!mainnetHash || !mainnetState.exists)
  ) {
    return "testnet-only";
  }
  if (
    (!testnetHash || !testnetState.exists) &&
    mainnetHash &&
    mainnetState.exists
  ) {
    if (deploymentStatus(manifest, "neo-n3-testnet") === "deferred") {
      return sourcePresent
        ? "mainnet-only-testnet-deferred"
        : "mainnet-only-no-source-testnet-deferred";
    }
    return sourcePresent
      ? "mainnet-only-needs-testnet"
      : "mainnet-only-no-source";
  }
  return "stale-or-missing";
}

function deploymentStatus(manifest, network) {
  const deployment = manifest.deployment;
  if (
    !deployment ||
    typeof deployment !== "object" ||
    Array.isArray(deployment)
  )
    return "";
  const entry =
    deployment[network] ||
    deployment[network === "neo-n3-mainnet" ? "mainnet" : "testnet"];
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return "";
  return String(entry.status || "").trim();
}

function deploymentReason(manifest, network) {
  const deployment = manifest.deployment;
  if (
    !deployment ||
    typeof deployment !== "object" ||
    Array.isArray(deployment)
  )
    return "";
  const entry =
    deployment[network] ||
    deployment[network === "neo-n3-mainnet" ? "mainnet" : "testnet"];
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return "";
  return String(entry.reason || "").trim();
}

async function main() {
  const [testnetRpcCandidates, mainnetRpcCandidates] = await Promise.all([
    resolveRpcCandidates(
      TESTNET_RPC_CANDIDATES,
      TESTNET_NETWORK_MAGIC,
      "testnet",
    ),
    resolveRpcCandidates(
      MAINNET_RPC_CANDIDATES,
      MAINNET_NETWORK_MAGIC,
      "mainnet",
    ),
  ]);
  const testnetMagic = testnetRpcCandidates[0].networkMagic;
  const mainnetMagic = mainnetRpcCandidates[0].networkMagic;

  const apps = fs
    .readdirSync(APPS_DIR)
    .filter(
      (name) => !ARCHIVED_APP_SLUGS.has(String(name).trim().toLowerCase()),
    )
    .filter((name) =>
      fs.existsSync(path.join(APPS_DIR, name, "neo-manifest.json")),
    );
  const rows = [];

  const startedAt = Date.now();
  for (const app of apps) {
    if (rows.length > 0 && rows.length % 5 === 0) {
      const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
      console.error(
        `[audit:miniapps:coverage] progress ${rows.length}/${apps.length} elapsed=${elapsedSec}s`,
      );
    }

    const manifest = readJson(path.join(APPS_DIR, app, "neo-manifest.json"));
    const sourcePresent = hasContractSource(app, manifest);
    const testnetHash = String(
      manifest.contracts?.["neo-n3-testnet"] || "",
    ).trim();
    const mainnetHash = String(
      manifest.contracts?.["neo-n3-mainnet"] || "",
    ).trim();
    const [testnetState, mainnetState] = await Promise.all([
      contractExistsAcrossCandidates(testnetRpcCandidates, testnetHash),
      contractExistsAcrossCandidates(mainnetRpcCandidates, mainnetHash),
    ]);
    const contractErrors = [
      ...testnetState.errors.map((error) => `testnet: ${error}`),
      ...mainnetState.errors.map((error) => `mainnet: ${error}`),
    ];

    const readme = readReadme(app);
    const readmeZh = readReadme(app, "README.zh-CN.md");
    const staleReadmeFlags = [];
    if (/Not deployed|未部署/.test(readme) || /未部署/.test(readmeZh))
      staleReadmeFlags.push("not-deployed-marker");
    if (/PaymentHub/.test(readme) || /PaymentHub/.test(readmeZh))
      staleReadmeFlags.push("paymenthub-reference");
    if (
      testnetHash &&
      (!sectionIncludesHash(readme, "### Testnet", testnetHash) ||
        !sectionIncludesHash(readmeZh, "### Testnet", testnetHash))
    ) {
      staleReadmeFlags.push("testnet-contract-hash-mismatch");
    }
    if (
      mainnetHash &&
      (!sectionIncludesHash(readme, "### Mainnet", mainnetHash) ||
        !sectionIncludesHash(readmeZh, "### Mainnet", mainnetHash))
    ) {
      staleReadmeFlags.push("mainnet-contract-hash-mismatch");
    }

    const classification = classify(
      manifest,
      testnetState,
      mainnetState,
      sourcePresent,
    );
    rows.push({
      app,
      app_id: manifest.id || "",
      classification,
      source_present: sourcePresent,
      stateless: Boolean(manifest.features?.stateless),
      testnet_hash: testnetHash || null,
      testnet_exists: testnetState.exists,
      testnet_name: testnetState.name,
      testnet_rpc_source: testnetState.rpc_url || null,
      mainnet_hash: mainnetHash || null,
      mainnet_exists: mainnetState.exists,
      mainnet_name: mainnetState.name,
      mainnet_rpc_source: mainnetState.rpc_url || null,
      mainnet_release_status:
        deploymentStatus(manifest, "neo-n3-mainnet") || null,
      mainnet_release_reason:
        deploymentReason(manifest, "neo-n3-mainnet") || null,
      action_required:
        classification === "testnet-only" &&
        deploymentStatus(manifest, "neo-n3-mainnet") !== "deferred"
          ? "decide-mainnet-release-or-mark-deferred"
          : null,
      stale_readme_flags: staleReadmeFlags,
      contract_errors: contractErrors,
    });
  }

  rows.sort((a, b) => a.app.localeCompare(b.app));
  console.log(
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        testnet_rpc: testnetRpcCandidates[0].rpcUrl,
        mainnet_rpc: mainnetRpcCandidates[0].rpcUrl,
        testnet_rpc_candidates: testnetRpcCandidates.map(
          (candidate) => candidate.rpcUrl,
        ),
        mainnet_rpc_candidates: mainnetRpcCandidates.map(
          (candidate) => candidate.rpcUrl,
        ),
        testnet_network_magic: testnetMagic,
        mainnet_network_magic: mainnetMagic,
        summary: rows.reduce((acc, row) => {
          acc[row.classification] = (acc[row.classification] || 0) + 1;
          return acc;
        }, {}),
        rpc_unknown: [],
        action_required: rows.filter((row) => row.action_required),
        rows,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

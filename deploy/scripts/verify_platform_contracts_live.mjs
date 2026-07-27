#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readAppManifest } from "./lib/app-manifests.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const expectedNetworkMagic = 894710606;

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

function requiredHash(value, label) {
  const hash = String(value ?? "").trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(hash)) {
    throw new Error(`${label} is not a valid UInt160 hash`);
  }
  return hash;
}

export function readNefChecksum(filePath) {
  const bytes = fs.readFileSync(filePath);
  if (bytes.length < 4) throw new Error(`${filePath} is not a valid NEF file`);
  return bytes.readUInt32LE(bytes.length - 4);
}

function localArtifact(name) {
  const manifestPath = path.join(repoRoot, "contracts", "build", `${name}.manifest.json`);
  const nefPath = path.join(repoRoot, "contracts", "build", `${name}.nef`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  return {
    manifestPath: path.relative(repoRoot, manifestPath),
    nefPath: path.relative(repoRoot, nefPath),
    checksum: readNefChecksum(nefPath),
    methodNames: [...new Set((manifest.abi?.methods ?? []).map((method) => method.name))].sort(),
  };
}

export function loadPlatformTargets() {
  const registryReportPath = "deploy/config/platform-registry-testnet-2026-07-19.json";
  const gameReportPath = "contracts/build/testnet_game_deployment.json";
  const anchorReportPath = "contracts/build/testnet_anchor_deployment.json";
  const registryReport = readJson(registryReportPath);
  const gameReport = readJson(gameReportPath);
  const anchorReport = readJson(anchorReportPath);
  // The consumer apps live in neo-miniapps; the committed snapshot is this
  // repo's copy of their manifests and refresh-manifest-snapshot.mjs --check
  // fails when it drifts.
  const factorySlugs = ["asset-factory", "miniapp-factory", "nft-factory"];
  const factoryHashes = new Set(
    factorySlugs.map((slug) =>
      requiredHash(
        readAppManifest(slug).contracts?.["neo-n3-testnet"],
        `${slug} testnet contract`,
      ),
    ),
  );
  if (factoryHashes.size !== 1) {
    throw new Error("factory consumers do not agree on one testnet contract hash");
  }

  const registryHash = requiredHash(
    registryReport.platform_registry,
    `${registryReportPath} platform_registry`,
  );
  const registryAdmin = requiredHash(
    registryReport.signer_hash,
    `${registryReportPath} signer_hash`,
  );
  const anchorAdmin = requiredHash(
    anchorReport.deployer_hash,
    `${anchorReportPath} deployer_hash`,
  );

  return [
    {
      name: "PlatformRegistry",
      kind: "contract",
      hash: registryHash,
      expectedAdmin: registryAdmin,
      evidence: [registryReportPath],
      local: localArtifact("PlatformRegistry"),
    },
    {
      name: "AppAccount",
      kind: "registry-artifact",
      registryHash,
      evidence: [registryReportPath],
      local: localArtifact("AppAccount"),
    },
    {
      name: "MiniAppFactory",
      kind: "contract",
      hash: [...factoryHashes][0],
      // The snapshot is the evidence file now; the slugs say which entries.
      evidence: ["platform/host-app/public/miniapp-manifests.json"],
      evidenceApps: factorySlugs,
      local: localArtifact("MiniAppFactory"),
    },
    {
      name: "PlatformAnchor",
      kind: "contract",
      hash: requiredHash(
        anchorReport.platform_anchor,
        `${anchorReportPath} platform_anchor`,
      ),
      expectedAdmin: anchorAdmin,
      evidence: [anchorReportPath],
      local: localArtifact("PlatformAnchor"),
    },
    {
      name: "PlatformGame",
      kind: "contract",
      hash: requiredHash(gameReport.platform_game, `${gameReportPath} platform_game`),
      expectedAdmin: requiredHash(
        gameReport.signer_hash,
        `${gameReportPath} signer_hash`,
      ),
      evidence: [gameReportPath],
      local: localArtifact("PlatformGame"),
    },
    {
      name: "PlatformDeFi",
      kind: "contract",
      hash: requiredHash(anchorReport.platform_defi, `${anchorReportPath} platform_defi`),
      expectedAdmin: anchorAdmin,
      evidence: [anchorReportPath],
      local: localArtifact("PlatformDeFi"),
    },
    {
      name: "PlatformSocial",
      kind: "undeployed",
      evidence: [],
      local: localArtifact("PlatformSocial"),
    },
  ];
}

export function defaultRpcCandidates(env = process.env) {
  return [
    env.NEO_TESTNET_RPC_URL,
    env.NEO_RPC_TESTNET,
    "https://testnet1.neo.coz.io:443",
    "https://api.n3index.dev/testnet",
  ]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index);
}

export async function fetchJsonRpc(rpcUrl, method, params, { timeoutMs = 15_000 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
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
      if (!text.trim()) throw new Error(`empty response (status=${response.status})`);
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        throw new Error(`non-JSON response (status=${response.status})`);
      }
      if (body.error) {
        throw new Error(body.error.message || String(body.error.code || "RPC error"));
      }
      if (body.result == null) throw new Error(`${method} returned no result`);
      return body.result;
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`${rpcUrl} ${method}: ${lastError?.message ?? "unknown RPC error"}`);
}

function networkMagic(version) {
  return Number(version?.protocol?.network ?? version?.protocol?.networkmagic);
}

export async function selectTestnetRpc(rpcCandidates, rpcCall = fetchJsonRpc) {
  const failures = [];
  for (const rpcUrl of rpcCandidates) {
    try {
      const version = await rpcCall(rpcUrl, "getversion", []);
      const magic = networkMagic(version);
      if (magic !== expectedNetworkMagic) {
        failures.push(`${rpcUrl}: network magic ${magic || "missing"}`);
        continue;
      }
      return { rpcUrl, networkMagic: magic, userAgent: version.useragent ?? "" };
    } catch (error) {
      failures.push(error.message);
    }
  }
  throw new Error(`no Neo N3 testnet RPC available: ${failures.join("; ")}`);
}

function integerStackValue(invocation, method) {
  if (invocation?.state !== "HALT") {
    throw new Error(`${method} did not HALT: ${invocation?.exception || invocation?.state || "unknown"}`);
  }
  const item = invocation.stack?.[0];
  if (item?.type !== "Integer" || !/^-?\d+$/.test(String(item.value ?? ""))) {
    throw new Error(`${method} did not return an Integer`);
  }
  return Number(item.value);
}

function hash160StackValue(invocation, method) {
  if (invocation?.state !== "HALT") {
    throw new Error(`${method} did not HALT: ${invocation?.exception || invocation?.state || "unknown"}`);
  }
  const item = invocation.stack?.[0];
  if (!["ByteString", "Buffer"].includes(item?.type) || !item.value) {
    throw new Error(`${method} did not return a Hash160 byte string`);
  }
  const bytes = Buffer.from(item.value, "base64");
  if (bytes.length !== 20) throw new Error(`${method} returned ${bytes.length} bytes`);
  return `0x${Buffer.from(bytes).reverse().toString("hex")}`;
}

function compareMethods(localNames, remoteManifest) {
  const remoteNames = [...new Set((remoteManifest?.abi?.methods ?? []).map((method) => method.name))].sort();
  return {
    local_count: localNames.length,
    on_chain_count: remoteNames.length,
    missing_on_chain: localNames.filter((name) => !remoteNames.includes(name)),
    extra_on_chain: remoteNames.filter((name) => !localNames.includes(name)),
  };
}

async function verifyContract(target, rpcUrl, rpcCall) {
  const state = await rpcCall(rpcUrl, "getcontractstate", [target.hash]);
  const methodNames = new Set(
    (state.manifest?.abi?.methods ?? []).map((method) => method.name),
  );
  let admin = null;
  if (methodNames.has("admin")) {
    const invocation = await rpcCall(rpcUrl, "invokefunction", [target.hash, "admin", []]);
    admin = hash160StackValue(invocation, `${target.name}.admin`);
  }
  const onChainChecksum = Number(state.nef?.checksum);
  const artifactMatches = onChainChecksum === target.local.checksum;
  return {
    name: target.name,
    kind: target.kind,
    evidence: target.evidence,
    hash: target.hash,
    contract_id: state.id,
    update_counter: state.updatecounter,
    on_chain_name: state.manifest?.name ?? "",
    manifest_name_matches: state.manifest?.name === target.name,
    admin,
    expected_admin: target.expectedAdmin ?? null,
    expected_admin_matches:
      target.expectedAdmin == null ? null : admin === target.expectedAdmin,
    local_nef_checksum: target.local.checksum,
    on_chain_nef_checksum: onChainChecksum,
    current_local_artifact_match: artifactMatches,
    abi: compareMethods(target.local.methodNames, state.manifest),
    status: artifactMatches ? "live-artifact-match" : "live-artifact-drift",
  };
}

async function verifyRegistryArtifact(target, rpcUrl, rpcCall) {
  const [checksumInvocation, versionInvocation] = await Promise.all([
    rpcCall(rpcUrl, "invokefunction", [target.registryHash, "artifactChecksum", []]),
    rpcCall(rpcUrl, "invokefunction", [target.registryHash, "artifactVersion", []]),
  ]);
  const onChainChecksum = integerStackValue(checksumInvocation, "artifactChecksum");
  const artifactMatches = onChainChecksum === target.local.checksum;
  return {
    name: target.name,
    kind: target.kind,
    evidence: target.evidence,
    registry_hash: target.registryHash,
    artifact_version: integerStackValue(versionInvocation, "artifactVersion"),
    local_nef_checksum: target.local.checksum,
    on_chain_nef_checksum: onChainChecksum,
    current_local_artifact_match: artifactMatches,
    status: artifactMatches ? "active-artifact-match" : "active-artifact-drift",
  };
}

export async function verifyPlatformContractsLive({
  targets = loadPlatformTargets(),
  rpcCandidates = defaultRpcCandidates(),
  rpcCall = fetchJsonRpc,
  now = () => new Date(),
} = {}) {
  const selected = await selectTestnetRpc(rpcCandidates, rpcCall);
  const rows = [];
  for (const target of targets) {
    if (target.kind === "contract") {
      rows.push(await verifyContract(target, selected.rpcUrl, rpcCall));
    } else if (target.kind === "registry-artifact") {
      rows.push(await verifyRegistryArtifact(target, selected.rpcUrl, rpcCall));
    } else {
      rows.push({
        name: target.name,
        kind: target.kind,
        evidence: target.evidence,
        local_nef_checksum: target.local.checksum,
        current_local_artifact_match: false,
        status: "no-deployment-record",
      });
    }
  }

  const adminDomains = [
    ...new Set(rows.map((row) => row.admin).filter(Boolean)),
  ].sort();

  return {
    generated_at_utc: now().toISOString(),
    network: "neo-n3-testnet",
    read_only: true,
    chain_writes_performed: false,
    rpc_url: selected.rpcUrl,
    network_magic: selected.networkMagic,
    rpc_user_agent: selected.userAgent,
    summary: {
      contracts: rows.length,
      live_contracts_found: rows.filter((row) => row.kind === "contract").length,
      active_registry_artifacts: rows.filter((row) => row.kind === "registry-artifact").length,
      current_local_artifact_matches: rows.filter(
        (row) => row.current_local_artifact_match,
      ).length,
      artifact_drifts: rows.filter((row) => row.status.endsWith("artifact-drift")).length,
      no_deployment_record: rows.filter((row) => row.status === "no-deployment-record").length,
      admin_domains: adminDomains.length,
    },
    admin_domains: adminDomains,
    contracts: rows,
    boundary:
      "Read-only RPC evidence proves current testnet contract identity and NEF checksum only. It does not prove funded lifecycle behavior, mainnet parity, or operational health.",
  };
}

export function renderLiveMarkdown(report) {
  const lines = [
    "# Platform Contract Testnet Live Verification",
    "",
    `Generated: ${report.generated_at_utc}`,
    "",
    "## Summary",
    "",
    `- Network: ${report.network} (magic ${report.network_magic})`,
    `- Read-only: ${report.read_only === true ? "yes" : "no"}`,
    `- Chain writes performed: ${report.chain_writes_performed === true ? "yes" : "no"}`,
    `- RPC: ${report.rpc_url}`,
    `- Live contracts found: ${report.summary.live_contracts_found}`,
    `- Active Registry artifacts: ${report.summary.active_registry_artifacts}`,
    `- Current local artifact matches: ${report.summary.current_local_artifact_matches}/${report.summary.contracts}`,
    `- Artifact drifts: ${report.summary.artifact_drifts}`,
    `- No deployment record: ${report.summary.no_deployment_record}`,
    `- Distinct contract-admin domains: ${report.summary.admin_domains}`,
    `- Boundary: ${report.boundary}`,
    "",
    "## Ledger",
    "",
    "| Contract | Evidence kind | Testnet target | Admin | Local checksum | Testnet checksum | Update | ABI missing on-chain | Status |",
    "| --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- |",
  ];

  for (const row of report.contracts) {
    lines.push(
      `| ${row.name} | ${row.kind} | ${row.hash ?? row.registry_hash ?? "none"} | ${row.admin ?? "n/a"} | ${row.local_nef_checksum} | ${row.on_chain_nef_checksum ?? "n/a"} | ${row.update_counter ?? "n/a"} | ${row.abi?.missing_on_chain.length ?? "n/a"} | ${row.status} |`,
    );
  }
  return `${lines.join("\n")}\n`;
}

export function writeLiveReport(report) {
  const jsonPath = path.join(repoRoot, "docs", "reports", "platform-contract-testnet-live-latest.json");
  const markdownPath = path.join(repoRoot, "docs", "reports", "platform-contract-testnet-live-latest.md");
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(markdownPath, renderLiveMarkdown(report));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await verifyPlatformContractsLive();
  writeLiveReport(report);
  console.log(
    `Platform testnet artifacts: ${report.summary.current_local_artifact_matches}/${report.summary.contracts} current; ${report.summary.artifact_drifts} drifted; ${report.summary.no_deployment_record} without deployment record.`,
  );
  if (process.argv.includes("--fail-on-drift") && report.summary.artifact_drifts > 0) {
    process.exitCode = 1;
  }
}

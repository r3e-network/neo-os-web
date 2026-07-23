#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const controlMethods = new Set([
  "_deploy",
  "_initialize",
  "onNEP17Payment",
  "proposeAbstractAccountCore",
  "setAbstractAccountCore",
  "cancelAbstractAccountCore",
  "proposeAppAccountArtifact",
  "setAppAccountArtifact",
  "cancelAppAccountArtifact",
  "proposeUpgradeAppAccount",
  "upgradeAppAccount",
  "cancelUpgradeAppAccount",
  "proposeEngine",
  "registerEngine",
  "proposeRetireEngine",
  "retireEngine",
  "cancelEnginePending",
  "proposeAdmin",
  "executeAdminChange",
  "cancelAdminChange",
  "setGlobalPaused",
  "scheduleUpdate",
  "update",
  "cancelUpdate",
  "registerAppByPlatform",
  "withdrawPlatformFees",
]);

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function configuredRegistryConsumers() {
  const appsDir = path.join(repoRoot, "apps");
  const consumers = [];
  for (const slug of fs.readdirSync(appsDir).sort()) {
    const mainPath = path.join(appsDir, slug, "src", "main.tsx");
    if (!fs.existsSync(mainPath)) continue;
    if (/\bregistry\s*:\s*\{/.test(fs.readFileSync(mainPath, "utf8"))) consumers.push(slug);
  }
  return consumers;
}

export function evaluatePlatformRegistryFramework({
  manifest,
  surfaceSource,
  typesSource,
  indexSource,
  miniAppRootSource,
  consumers = [],
}) {
  const abiMethods = (manifest.abi?.methods ?? [])
    .map((method) => method.name)
    .filter((name) => !controlMethods.has(name))
    .sort();
  const operationPattern = /\b(?:read|readHash|readInteger|invoke|tenantInvoke)\("([A-Za-z0-9_]+)"/g;
  const allOperations = [...surfaceSource.matchAll(operationPattern)].map((match) => match[1]);
  const nativeOperations = allOperations.filter((name) => name === "transfer").sort();
  const frameworkMethods = allOperations.filter((name) => name !== "transfer").sort();
  const frameworkSet = new Set(frameworkMethods);
  const abiSet = new Set(abiMethods);
  const missingMethods = abiMethods.filter((name) => !frameworkSet.has(name));
  const extraMethods = frameworkMethods.filter((name) => !abiSet.has(name));
  const wiring = {
    options_config: typesSource.includes("registry?: FrameworkRegistryConfig"),
    framework_surface: typesSource.includes("readonly registry: FrameworkRegistrySurface"),
    composition_root: indexSource.includes("createRegistrySurface") &&
      indexSource.includes("get registry()"),
    react_passthrough: miniAppRootSource.includes("registry?: MiniAppFrameworkOptions[\"registry\"]") &&
      miniAppRootSource.includes("registry, platformGame"),
    guarded_writes: surfaceSource.includes("guardedWrite") &&
      surfaceSource.includes("WRITE_PLATFORM_REGISTRY"),
  };
  return {
    passed: missingMethods.length === 0 && extraMethods.length === 0 &&
      nativeOperations.length === 1 && Object.values(wiring).every(Boolean),
    tenant_abi_method_count: abiMethods.length,
    framework_operation_count: frameworkMethods.length,
    tenant_abi_methods: abiMethods,
    framework_operations: frameworkMethods,
    native_operations: nativeOperations,
    missing_methods: missingMethods,
    extra_methods: extraMethods,
    wiring,
    configured_consumer_count: consumers.length,
    configured_consumers: consumers,
  };
}

export function buildPlatformRegistryFrameworkReport({ now = () => new Date() } = {}) {
  const live = JSON.parse(read("docs/reports/platform-contract-testnet-live-latest.json"));
  const deployment = (live.contracts ?? []).find((contract) => contract.name === "PlatformRegistry") ?? null;
  const evaluation = evaluatePlatformRegistryFramework({
    manifest: JSON.parse(read("contracts/build/PlatformRegistry.manifest.json")),
    surfaceSource: read("framework/registry-surface.ts"),
    typesSource: read("framework/types.ts"),
    indexSource: read("framework/index.ts"),
    miniAppRootSource: read("apps/shared/react/MiniAppRoot.tsx"),
    consumers: configuredRegistryConsumers(),
  });
  const missingOnChain = deployment?.abi?.missing_on_chain ?? [];
  const missingTenantOnChain = missingOnChain.filter((name) =>
    evaluation.tenant_abi_methods.includes(name));
  return {
    generated_at_utc: now().toISOString(),
    ...evaluation,
    deployment: deployment ? {
      hash: deployment.hash,
      status: deployment.status,
      local_nef_checksum: deployment.local_nef_checksum,
      on_chain_nef_checksum: deployment.on_chain_nef_checksum,
      current_local_artifact_match: deployment.current_local_artifact_match,
      missing_on_chain_methods: missingOnChain,
      missing_tenant_on_chain_methods: missingTenantOnChain,
      live_tenant_method_count: evaluation.tenant_abi_method_count - missingTenantOnChain.length,
    } : null,
    boundary: "The framework now covers every current local non-control-plane PlatformRegistry ABI method plus the native GAS credit prepayment required by permissionless registration. No production miniapp is configured against it: the retained testnet Registry checksum differs from the local artifact and lacks the shared-AA materialization and spend-threshold methods. Production binding remains closed until the exact Registry artifact is upgraded and verified, the reciprocal UnifiedSmartWallet registrar/core configuration matures, the 77-account dry-run proves uniqueness and reverse indexes, and a separately approved write run materializes accounts. Platform-admin governance, artifacts, engine registration, fees, and updates are intentionally not exposed through app.registry.",
    chain_writes_performed: false,
  };
}

export function renderPlatformRegistryFrameworkMarkdown(report) {
  return `${[
    "# PlatformRegistry Framework Interface",
    "",
    `Generated: ${report.generated_at_utc}`,
    "",
    `- Interface audit: **${report.passed ? "PASS" : "FAIL"}**`,
    `- Non-control-plane contract ABI: ${report.tenant_abi_method_count} methods`,
    `- Framework ABI operations: ${report.framework_operation_count} methods`,
    `- Native GAS credit operations: ${report.native_operations.length}`,
    `- Missing methods: ${report.missing_methods.join(", ") || "none"}`,
    `- Extra methods: ${report.extra_methods.join(", ") || "none"}`,
    `- Configured production consumers: ${report.configured_consumer_count}`,
    `- Live tenant ABI availability: ${report.deployment?.live_tenant_method_count ?? "unknown"}/${report.tenant_abi_method_count}`,
    `- Live deployment status: \`${report.deployment?.status ?? "unknown"}\``,
    `- Current local artifact match: ${report.deployment?.current_local_artifact_match ?? "unknown"}`,
    `- Chain writes performed: ${report.chain_writes_performed ? "yes" : "no"}`,
    "",
    "## Wiring",
    "",
    ...Object.entries(report.wiring).map(([name, passed]) => `- ${name}: ${passed ? "PASS" : "FAIL"}`),
    "",
    "## Live Missing Tenant Methods",
    "",
    report.deployment?.missing_tenant_on_chain_methods.join(", ") || "none",
    "",
    "## Boundary",
    "",
    report.boundary,
  ].join("\n")}\n`;
}

export function writePlatformRegistryFrameworkReport({ check = false } = {}) {
  const report = buildPlatformRegistryFrameworkReport();
  const jsonPath = path.join(repoRoot, "docs/reports/platform-registry-framework-interface-latest.json");
  const markdownPath = path.join(repoRoot, "docs/reports/platform-registry-framework-interface-latest.md");
  const json = `${JSON.stringify(report, null, 2)}\n`;
  const markdown = renderPlatformRegistryFrameworkMarkdown(report);
  if (check) {
    const existingJson = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    const currentJson = JSON.parse(json);
    delete existingJson.generated_at_utc;
    delete currentJson.generated_at_utc;
    if (JSON.stringify(existingJson) !== JSON.stringify(currentJson)) {
      throw new Error("PlatformRegistry framework JSON is stale");
    }
    const existingMarkdown = fs.readFileSync(markdownPath, "utf8")
      .replace(/^Generated: .*$/m, "Generated: <ignored>");
    const currentMarkdown = markdown.replace(/^Generated: .*$/m, "Generated: <ignored>");
    if (existingMarkdown !== currentMarkdown) {
      throw new Error("PlatformRegistry framework Markdown is stale");
    }
  } else {
    fs.writeFileSync(jsonPath, json);
    fs.writeFileSync(markdownPath, markdown);
  }
  if (!report.passed) throw new Error("PlatformRegistry framework interface audit failed");
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = writePlatformRegistryFrameworkReport({ check: process.argv.includes("--check") });
  console.log(`PlatformRegistry framework interface: ${report.framework_operation_count}/${report.tenant_abi_method_count} PASS; bindings=${report.configured_consumer_count}`);
}

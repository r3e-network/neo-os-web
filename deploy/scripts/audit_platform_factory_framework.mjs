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
  "admin",
  "setAdmin",
  "update",
  "registerTemplate",
  "registerTemplateArtifact",
]);

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

export function evaluatePlatformFactoryFramework({
  manifest,
  surfaceSource,
  typesSource,
  indexSource,
  sharedRuntimeSource,
  miniappSetupSource,
  mainSources,
}) {
  const abiMethods = (manifest.abi?.methods ?? [])
    .map((method) => method.name)
    .filter((name) => !controlMethods.has(name))
    .sort();
  const operationPattern = /\b(?:read|invoke)\([^,]+,\s*"([A-Za-z0-9_]+)"/g;
  const frameworkMethods = [...surfaceSource.matchAll(operationPattern)]
    .map((match) => match[1])
    .sort();
  const frameworkSet = new Set(frameworkMethods);
  const abiSet = new Set(abiMethods);
  const missingMethods = abiMethods.filter((name) => !frameworkSet.has(name));
  const extraMethods = frameworkMethods.filter((name) => !abiSet.has(name));
  const wiring = {
    options_config: typesSource.includes("platformFactory?: FrameworkPlatformFactoryConfig"),
    framework_surface: typesSource.includes("readonly platformFactory: FrameworkPlatformFactorySurface"),
    composition_root: indexSource.includes("createPlatformFactorySurface") &&
      indexSource.includes("get platformFactory()"),
    scoped_write_guard: surfaceSource.includes("WRITE_PLATFORM_FACTORY"),
  };
  const consumers = {
    shared_factory_runtime: sharedRuntimeSource.includes("ctx.framework.platformFactory.executeDeploymentCall") &&
      !sharedRuntimeSource.includes("ctx.services.chain.invoke("),
    miniapp_factory_runtime: miniappSetupSource.includes("ctx.framework.platformFactory.executeDeploymentCall") &&
      !miniappSetupSource.includes("ctx.framework.chain.invoke("),
    asset_factory_config: mainSources.asset.includes("platformFactory:") && mainSources.asset.includes("factoryContractFor"),
    nft_factory_config: mainSources.nft.includes("platformFactory:") && mainSources.nft.includes("factoryContractFor"),
    miniapp_factory_config: mainSources.miniapp.includes("platformFactory:") && mainSources.miniapp.includes("factoryContractFor"),
  };
  return {
    passed: missingMethods.length === 0 && extraMethods.length === 0 &&
      Object.values(wiring).every(Boolean) && Object.values(consumers).every(Boolean),
    tenant_abi_method_count: abiMethods.length,
    framework_operation_count: frameworkMethods.length,
    tenant_abi_methods: abiMethods,
    framework_operations: frameworkMethods,
    missing_methods: missingMethods,
    extra_methods: extraMethods,
    wiring,
    consumers,
  };
}

export function buildPlatformFactoryFrameworkReport({ now = () => new Date() } = {}) {
  const live = JSON.parse(read("docs/reports/platform-contract-testnet-live-latest.json"));
  const deployment = (live.contracts ?? []).find((contract) => contract.name === "MiniAppFactory") ?? null;
  const evaluation = evaluatePlatformFactoryFramework({
    manifest: JSON.parse(read("contracts/build/MiniAppFactory.manifest.json")),
    surfaceSource: read("framework/platform-factory-surface.ts"),
    typesSource: read("framework/types.ts"),
    indexSource: read("framework/index.ts"),
    sharedRuntimeSource: read("apps/shared/factory/runtime.tsx"),
    miniappSetupSource: read("apps/miniapp-factory/src/setup.ts"),
    mainSources: {
      asset: read("apps/asset-factory/src/main.tsx"),
      nft: read("apps/nft-factory/src/main.tsx"),
      miniapp: read("apps/miniapp-factory/src/main.tsx"),
    },
  });
  return {
    generated_at_utc: now().toISOString(),
    ...evaluation,
    configured_consumers: ["asset-factory", "nft-factory", "miniapp-factory"],
    deployment: deployment ? {
      hash: deployment.hash,
      status: deployment.status,
      local_nef_checksum: deployment.local_nef_checksum,
      on_chain_nef_checksum: deployment.on_chain_nef_checksum,
      current_local_artifact_match: deployment.current_local_artifact_match,
      missing_on_chain_methods: deployment.abi?.missing_on_chain ?? [],
    } : null,
    boundary: "All three Factory applications now route deployment writes through the guarded framework surface, but this does not unlock every product lane. The retained testnet Factory differs from the local artifact and lacks deployArtifactFromTemplate; Asset/NFT execution must remain closed until the governed artifacts, exact live ABI, durable recovery, event confirmation, record readback, and funded lifecycle are certified. Direct JSON-RPC remains only for read-only contract-state/signers fee probes that the wallet bridge cannot express.",
    chain_writes_performed: false,
  };
}

export function renderPlatformFactoryFrameworkMarkdown(report) {
  return `${[
    "# MiniAppFactory Framework Interface",
    "",
    `Generated: ${report.generated_at_utc}`,
    "",
    `- Interface audit: **${report.passed ? "PASS" : "FAIL"}**`,
    `- Tenant contract ABI: ${report.tenant_abi_method_count} methods`,
    `- Framework operations: ${report.framework_operation_count} methods`,
    `- Missing methods: ${report.missing_methods.join(", ") || "none"}`,
    `- Extra methods: ${report.extra_methods.join(", ") || "none"}`,
    `- Configured consumers: ${report.configured_consumers.join(", ")}`,
    `- Live deployment status: \`${report.deployment?.status ?? "unknown"}\``,
    `- Current local artifact match: ${report.deployment?.current_local_artifact_match ?? "unknown"}`,
    `- Chain writes performed: ${report.chain_writes_performed ? "yes" : "no"}`,
    "",
    "## Wiring",
    "",
    ...Object.entries(report.wiring).map(([name, passed]) => `- ${name}: ${passed ? "PASS" : "FAIL"}`),
    "",
    "## Consumers",
    "",
    ...Object.entries(report.consumers).map(([name, passed]) => `- ${name}: ${passed ? "PASS" : "FAIL"}`),
    "",
    "## Boundary",
    "",
    report.boundary,
  ].join("\n")}\n`;
}

export function writePlatformFactoryFrameworkReport({ check = false } = {}) {
  const report = buildPlatformFactoryFrameworkReport();
  const jsonPath = path.join(repoRoot, "docs/reports/platform-factory-framework-interface-latest.json");
  const markdownPath = path.join(repoRoot, "docs/reports/platform-factory-framework-interface-latest.md");
  const json = `${JSON.stringify(report, null, 2)}\n`;
  const markdown = renderPlatformFactoryFrameworkMarkdown(report);
  if (check) {
    const existingJson = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    const currentJson = JSON.parse(json);
    delete existingJson.generated_at_utc;
    delete currentJson.generated_at_utc;
    if (JSON.stringify(existingJson) !== JSON.stringify(currentJson)) {
      throw new Error("MiniAppFactory framework JSON is stale");
    }
    const existingMarkdown = fs.readFileSync(markdownPath, "utf8")
      .replace(/^Generated: .*$/m, "Generated: <ignored>");
    const currentMarkdown = markdown.replace(/^Generated: .*$/m, "Generated: <ignored>");
    if (existingMarkdown !== currentMarkdown) {
      throw new Error("MiniAppFactory framework Markdown is stale");
    }
  } else {
    fs.writeFileSync(jsonPath, json);
    fs.writeFileSync(markdownPath, markdown);
  }
  if (!report.passed) throw new Error("MiniAppFactory framework interface audit failed");
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = writePlatformFactoryFrameworkReport({ check: process.argv.includes("--check") });
  console.log(`MiniAppFactory framework interface: ${report.tenant_abi_method_count}/${report.tenant_abi_method_count} PASS`);
}

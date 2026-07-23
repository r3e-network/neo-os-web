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
  "isPaused",
  "abstractAccount",
  "setAdmin",
  "setPaused",
  "setAbstractAccount",
  "update",
  "registerAnchorApp",
  "registerCustomAnchorApp",
  "setAppPaused",
  "onNEP17Payment",
]);

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

export function evaluatePlatformAnchorFramework({
  manifest,
  surfaceSource,
  typesSource,
  indexSource,
  defineMiniAppSource,
  trustRuntimeSource,
  trustMainSource,
  profitRuntimeSource,
  profitMainSource,
}) {
  const abiMethods = (manifest.abi?.methods ?? [])
    .map((method) => method.name)
    .filter((name) => !controlMethods.has(name))
    .sort();
  const operationPattern = /\b(?:read|invoke)\("([A-Za-z0-9_]+)"/g;
  const allOperations = [...surfaceSource.matchAll(operationPattern)].map((match) => match[1]);
  const frameworkMethods = allOperations.filter((name) => name !== "transfer").sort();
  const nativeOperations = allOperations.filter((name) => name === "transfer").sort();
  const abiSet = new Set(abiMethods);
  const frameworkSet = new Set(frameworkMethods);
  const missingMethods = abiMethods.filter((name) => !frameworkSet.has(name));
  const extraMethods = frameworkMethods.filter((name) => !abiSet.has(name));
  const wiring = {
    options_config: typesSource.includes("platformAnchor?: FrameworkPlatformAnchorConfig"),
    framework_surface: typesSource.includes("readonly platformAnchor: FrameworkPlatformAnchorSurface"),
    composition_root: indexSource.includes("createPlatformAnchorSurface") &&
      indexSource.includes("get platformAnchor()"),
    manifest_binding: defineMiniAppSource.includes("platformAnchorConfigFromManifest") &&
      defineMiniAppSource.includes("platformAnchor={resolvedPlatformAnchor}"),
    scoped_write_guard: surfaceSource.includes("WRITE_PLATFORM_ANCHOR"),
  };
  const consumers = {
    trust_runtime_surface: trustRuntimeSource.includes("app.platformAnchor.stats()") &&
      trustRuntimeSource.includes("app.platformAnchor.stakeNeo") &&
      !/app\.chain\.(?:readRaw|invoke)\(/.test(trustRuntimeSource),
    trust_runtime_config: trustMainSource.includes("platformAnchor: { anchorHash: getMiniAppContractHash(APP_ID) }"),
    profit_runtime_shared: profitRuntimeSource.includes('export * from "../../trustanchor/src/anchor-runtime"'),
    profit_runtime_config: profitMainSource.includes("platformAnchor: { anchorHash: getMiniAppContractHash(APP_ID) }"),
  };
  return {
    passed: missingMethods.length === 0 && extraMethods.length === 0 &&
      nativeOperations.length === 1 && Object.values(wiring).every(Boolean) &&
      Object.values(consumers).every(Boolean),
    tenant_abi_method_count: abiMethods.length,
    framework_operation_count: frameworkMethods.length,
    tenant_abi_methods: abiMethods,
    framework_operations: frameworkMethods,
    native_operations: nativeOperations,
    missing_methods: missingMethods,
    extra_methods: extraMethods,
    wiring,
    consumers,
  };
}

export function buildPlatformAnchorFrameworkReport({ now = () => new Date() } = {}) {
  const live = JSON.parse(read("docs/reports/platform-contract-testnet-live-latest.json"));
  const deployment = (live.contracts ?? []).find((contract) => contract.name === "PlatformAnchor") ?? null;
  const evaluation = evaluatePlatformAnchorFramework({
    manifest: JSON.parse(read("contracts/build/PlatformAnchor.manifest.json")),
    surfaceSource: read("framework/platform-anchor-surface.ts"),
    typesSource: read("framework/types.ts"),
    indexSource: read("framework/index.ts"),
    defineMiniAppSource: read("apps/shared/react/defineMiniApp.tsx"),
    trustRuntimeSource: read("apps/trustanchor/src/anchor-runtime.ts"),
    trustMainSource: read("apps/trustanchor/src/main.tsx"),
    profitRuntimeSource: read("apps/profitanchor/src/anchor-runtime.ts"),
    profitMainSource: read("apps/profitanchor/src/main.tsx"),
  });
  return {
    generated_at_utc: now().toISOString(),
    ...evaluation,
    deployment: deployment ? {
      hash: deployment.hash,
      status: deployment.status,
      local_nef_checksum: deployment.local_nef_checksum,
      on_chain_nef_checksum: deployment.on_chain_nef_checksum,
      current_local_artifact_match: deployment.current_local_artifact_match,
      extra_on_chain_methods: deployment.abi?.extra_on_chain ?? [],
    } : null,
    boundary: deployment?.current_local_artifact_match === false
      ? "The framework and TrustAnchor/ProfitAnchor user runtimes cover the current local tenant ABI, but the retained testnet PlatformAnchor bytecode differs from the local artifact. The existing deployment must not be described as local-source compatible until an approved upgrade and live compatibility validation complete."
      : "Framework ABI coverage and consumer migration do not by themselves prove deployed runtime compatibility or funded lifecycle correctness.",
    chain_writes_performed: false,
  };
}

export function renderPlatformAnchorFrameworkMarkdown(report) {
  return `${[
    "# PlatformAnchor Framework Interface",
    "",
    `Generated: ${report.generated_at_utc}`,
    "",
    `- Interface audit: **${report.passed ? "PASS" : "FAIL"}**`,
    `- Tenant contract ABI: ${report.tenant_abi_method_count} methods`,
    `- Framework ABI operations: ${report.framework_operation_count} methods`,
    `- Native NEO deposit operations: ${report.native_operations.length}`,
    `- Missing methods: ${report.missing_methods.join(", ") || "none"}`,
    `- Extra methods: ${report.extra_methods.join(", ") || "none"}`,
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

export function writePlatformAnchorFrameworkReport({ check = false } = {}) {
  const report = buildPlatformAnchorFrameworkReport();
  const jsonPath = path.join(repoRoot, "docs/reports/platform-anchor-framework-interface-latest.json");
  const markdownPath = path.join(repoRoot, "docs/reports/platform-anchor-framework-interface-latest.md");
  const json = `${JSON.stringify(report, null, 2)}\n`;
  const markdown = renderPlatformAnchorFrameworkMarkdown(report);
  if (check) {
    const existingJson = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    const currentJson = JSON.parse(json);
    delete existingJson.generated_at_utc;
    delete currentJson.generated_at_utc;
    if (JSON.stringify(existingJson) !== JSON.stringify(currentJson)) {
      throw new Error("PlatformAnchor framework JSON is stale");
    }
    const existingMarkdown = fs.readFileSync(markdownPath, "utf8")
      .replace(/^Generated: .*$/m, "Generated: <ignored>");
    const currentMarkdown = markdown.replace(/^Generated: .*$/m, "Generated: <ignored>");
    if (existingMarkdown !== currentMarkdown) {
      throw new Error("PlatformAnchor framework Markdown is stale");
    }
  } else {
    fs.writeFileSync(jsonPath, json);
    fs.writeFileSync(markdownPath, markdown);
  }
  if (!report.passed) throw new Error("PlatformAnchor framework interface audit failed");
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = writePlatformAnchorFrameworkReport({ check: process.argv.includes("--check") });
  console.log(`PlatformAnchor framework interface: ${report.tenant_abi_method_count}/${report.tenant_abi_method_count} PASS`);
}

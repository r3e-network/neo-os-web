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
  "setAdmin",
  "setPaused",
  "update",
  "registerProduct",
  "getProductType",
  "getAppAdmin",
  "setAppPaused",
  "isAppPaused",
  "onNEP17Payment",
  "legacyCreditRecoveryState",
  "legacyCreditSnapshotHash",
  "legacyNeoCreditLiability",
  "legacyGasCreditLiability",
  "legacyNeoCreditRows",
  "legacyGasCreditRows",
  "getLegacyNeoCredit",
  "getLegacyGasCredit",
  "initializeLegacyCreditRecovery",
  "activateLegacyCreditRecovery",
  "withdrawLegacyNeoCredit",
  "withdrawLegacyGasCredit",
]);

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function sharedDeFiBindings() {
  const appsDir = path.join(repoRoot, "apps");
  const bindings = [];
  for (const slug of fs.readdirSync(appsDir).sort()) {
    const manifestPath = path.join(appsDir, slug, "src", "manifest.ts");
    if (!fs.existsSync(manifestPath)) continue;
    const source = fs.readFileSync(manifestPath, "utf8");
    if (!/mode:\s*["']shared["']/.test(source)) continue;
    if (!/moduleId:\s*["'](?:PlatformDeFi|platform-defi)["']/.test(source)) continue;
    bindings.push(slug);
  }
  return bindings;
}

export function evaluatePlatformDeFiFramework({
  manifest,
  surfaceSource,
  typesSource,
  indexSource,
  defineMiniAppSource,
  bindings = [],
}) {
  const abiMethods = (manifest.abi?.methods ?? [])
    .map((method) => method.name)
    .filter((name) => !controlMethods.has(name))
    .sort();
  const operationPattern = /\b(?:read|invoke)\("([A-Za-z0-9_]+)"/g;
  const allOperations = [...surfaceSource.matchAll(operationPattern)].map((match) => match[1]);
  const frameworkMethods = allOperations.filter((name) => name !== "transfer").sort();
  const nativeOperations = allOperations.filter((name) => name === "transfer").sort();
  const frameworkSet = new Set(frameworkMethods);
  const abiSet = new Set(abiMethods);
  const missingMethods = abiMethods.filter((name) => !frameworkSet.has(name));
  const extraMethods = frameworkMethods.filter((name) => !abiSet.has(name));
  const wiring = {
    options_config: typesSource.includes("platformDeFi?: FrameworkPlatformDeFiConfig"),
    framework_surface: typesSource.includes("readonly platformDeFi: FrameworkPlatformDeFiSurface"),
    composition_root: indexSource.includes("createPlatformDeFiSurface") &&
      indexSource.includes("get platformDeFi()"),
    manifest_binding: defineMiniAppSource.includes("platformDeFiConfigFromManifest") &&
      defineMiniAppSource.includes("platformDeFi={resolvedPlatformDeFi}"),
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
    shared_binding_count: bindings.length,
    shared_bindings: bindings,
  };
}

export function buildPlatformDeFiFrameworkReport({ now = () => new Date() } = {}) {
  const live = JSON.parse(read("docs/reports/platform-contract-testnet-live-latest.json"));
  const deployment = (live.contracts ?? []).find((contract) => contract.name === "PlatformDeFi") ?? null;
  const evaluation = evaluatePlatformDeFiFramework({
    manifest: JSON.parse(read("contracts/build/PlatformDeFi.manifest.json")),
    surfaceSource: read("framework/platform-defi-surface.ts"),
    typesSource: read("framework/types.ts"),
    indexSource: read("framework/index.ts"),
    defineMiniAppSource: read("apps/shared/react/defineMiniApp.tsx"),
    bindings: sharedDeFiBindings(),
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
      missing_on_chain_methods: deployment.abi?.missing_on_chain ?? [],
    } : null,
    boundary: "The framework covers the current local PlatformDeFi tenant ABI, exact appId:credit native deposits, app-scoped direct credits, tenant/global liabilities, and pause-immune withdrawals, but no miniapp manifest is bound to it. SelfLoan is now the named first-tenant source migration: PlatformDeFi v1.3 adds an explicit profile that enforces one active position and disables liquidation/abandonment, while the app keeps its standalone path and enables shared mode only after exact artifact attestation plus profile verification. Its deposit/create/read/recovery paths and atomic GAS-deposit-plus-repay lane have focused contract, framework, and composable tests. This is not live adoption: the retained deployment is artifact-drifted, shared bindings remain zero, and no registration, funding, or manifest cutover was performed. A fresh exact-artifact deployment, profile-1 tenant registration, funded lifecycle, rollback/drain proof, and explicit chain-write approval remain mandatory. FlashLoan and TimeCapsule still have materially different standalone ABIs and recovery state machines and require separate named migrations.",
    chain_writes_performed: false,
  };
}

export function renderPlatformDeFiFrameworkMarkdown(report) {
  return `${[
    "# PlatformDeFi Framework Interface",
    "",
    `Generated: ${report.generated_at_utc}`,
    "",
    `- Interface audit: **${report.passed ? "PASS" : "FAIL"}**`,
    `- Tenant contract ABI: ${report.tenant_abi_method_count} methods`,
    `- Framework ABI operations: ${report.framework_operation_count} methods`,
    `- Native prepaid deposit operations: ${report.native_operations.length}`,
    `- Missing methods: ${report.missing_methods.join(", ") || "none"}`,
    `- Extra methods: ${report.extra_methods.join(", ") || "none"}`,
    `- Shared miniapp bindings: ${report.shared_binding_count}`,
    `- Live deployment status: \`${report.deployment?.status ?? "unknown"}\``,
    `- Current local artifact match: ${report.deployment?.current_local_artifact_match ?? "unknown"}`,
    `- Chain writes performed: ${report.chain_writes_performed ? "yes" : "no"}`,
    "",
    "## Wiring",
    "",
    ...Object.entries(report.wiring).map(([name, passed]) => `- ${name}: ${passed ? "PASS" : "FAIL"}`),
    "",
    "## Boundary",
    "",
    report.boundary,
  ].join("\n")}\n`;
}

export function writePlatformDeFiFrameworkReport({ check = false } = {}) {
  const report = buildPlatformDeFiFrameworkReport();
  const jsonPath = path.join(repoRoot, "docs/reports/platform-defi-framework-interface-latest.json");
  const markdownPath = path.join(repoRoot, "docs/reports/platform-defi-framework-interface-latest.md");
  const json = `${JSON.stringify(report, null, 2)}\n`;
  const markdown = renderPlatformDeFiFrameworkMarkdown(report);
  if (check) {
    const existingJson = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    const currentJson = JSON.parse(json);
    delete existingJson.generated_at_utc;
    delete currentJson.generated_at_utc;
    if (JSON.stringify(existingJson) !== JSON.stringify(currentJson)) {
      throw new Error("PlatformDeFi framework JSON is stale");
    }
    const existingMarkdown = fs.readFileSync(markdownPath, "utf8")
      .replace(/^Generated: .*$/m, "Generated: <ignored>");
    const currentMarkdown = markdown.replace(/^Generated: .*$/m, "Generated: <ignored>");
    if (existingMarkdown !== currentMarkdown) {
      throw new Error("PlatformDeFi framework Markdown is stale");
    }
  } else {
    fs.writeFileSync(jsonPath, json);
    fs.writeFileSync(markdownPath, markdown);
  }
  if (!report.passed) throw new Error("PlatformDeFi framework interface audit failed");
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = writePlatformDeFiFrameworkReport({ check: process.argv.includes("--check") });
  console.log(`PlatformDeFi framework interface: ${report.tenant_abi_method_count}/${report.tenant_abi_method_count} PASS; bindings=${report.shared_binding_count}`);
}

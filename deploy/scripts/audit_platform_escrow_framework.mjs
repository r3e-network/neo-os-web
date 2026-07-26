#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const controlMethods = new Set([
  "_deploy", "_initialize", "admin", "registry", "isPaused", "appAdminOf",
  "isAppRegistered", "isAppPaused", "maxMilestonesOf", "approvalGracePeriodOf",
  "update", "scheduleUpdate", "cancelUpdate", "setRegistry", "setPaused",
  "registerApp", "activateApp", "validateAndApplyDescriptor", "setDescriptor",
  "setAppPaused", "onNEP17Payment",
]);

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

export function evaluatePlatformEscrowFramework({ manifest, surfaceSource, typesSource, indexSource }) {
  const abiMethods = (manifest.abi?.methods ?? [])
    .map((method) => method.name)
    .filter((name) => !controlMethods.has(name))
    .sort();
  const operations = [...surfaceSource.matchAll(/\b(?:read|invoke)\("([A-Za-z0-9_]+)"/g)]
    .map((match) => match[1]);
  const frameworkMethods = operations.filter((name) => name !== "transfer").sort();
  const frameworkSet = new Set(frameworkMethods);
  const abiSet = new Set(abiMethods);
  const missingMethods = abiMethods.filter((name) => !frameworkSet.has(name));
  const extraMethods = frameworkMethods.filter((name) => !abiSet.has(name));
  const wiring = {
    options_config: typesSource.includes("platformEscrow?: FrameworkPlatformEscrowConfig"),
    framework_surface: typesSource.includes("readonly platformEscrow: FrameworkPlatformEscrowSurface"),
    composition_root: indexSource.includes("createPlatformEscrowSurface") &&
      indexSource.includes("get platformEscrow()"),
    scoped_write_guard: surfaceSource.includes("WRITE_PLATFORM_ESCROW"),
  };
  return {
    passed: missingMethods.length === 0 && extraMethods.length === 0 &&
      operations.filter((name) => name === "transfer").length === 1 &&
      Object.values(wiring).every(Boolean),
    tenant_abi_method_count: abiMethods.length,
    framework_operation_count: frameworkMethods.length,
    tenant_abi_methods: abiMethods,
    framework_operations: frameworkMethods,
    missing_methods: missingMethods,
    extra_methods: extraMethods,
    native_operations: operations.filter((name) => name === "transfer"),
    wiring,
  };
}

export function buildPlatformEscrowFrameworkReport({ now = () => new Date() } = {}) {
  const live = JSON.parse(read("docs/reports/platform-contract-testnet-live-latest.json"));
  const deployment = (live.contracts ?? []).find((contract) => contract.name === "PlatformEscrow") ?? null;
  const evaluation = evaluatePlatformEscrowFramework({
    manifest: JSON.parse(read("contracts/build/PlatformEscrow.manifest.json")),
    surfaceSource: read("framework/platform-escrow-surface.ts"),
    typesSource: read("framework/types.ts"),
    indexSource: read("framework/index.ts"),
  });
  return {
    generated_at_utc: now().toISOString(),
    ...evaluation,
    configured_consumers: [],
    deployment: deployment ? {
      hash: deployment.hash,
      status: deployment.status,
      current_local_artifact_match: deployment.current_local_artifact_match,
      missing_on_chain_methods: deployment.abi?.missing_on_chain ?? [],
    } : null,
    boundary: "PlatformEscrow is source/build/test accepted and exposed through a guarded framework surface, but it has no retained deployment record or live binding. MiniAppMilestoneEscrow remains a separate legacy consumer until an approved migration, registry binding, funded lifecycle, and exact read-back are proven.",
    chain_writes_performed: false,
  };
}

export function renderPlatformEscrowFrameworkMarkdown(report) {
  return `${[
    "# PlatformEscrow Framework Interface",
    "",
    `Generated: ${report.generated_at_utc}`,
    "",
    `- Interface audit: **${report.passed ? "PASS" : "FAIL"}**`,
    `- Tenant contract ABI: ${report.tenant_abi_method_count} methods`,
    `- Framework ABI operations: ${report.framework_operation_count} methods`,
    `- Native funding operations: ${report.native_operations.length}`,
    `- Missing methods: ${report.missing_methods.join(", ") || "none"}`,
    `- Extra methods: ${report.extra_methods.join(", ") || "none"}`,
    `- Live deployment: ${report.deployment?.status ?? "no deployment record"}`,
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

export function writePlatformEscrowFrameworkReport({ check = false } = {}) {
  const report = buildPlatformEscrowFrameworkReport();
  const jsonPath = path.join(repoRoot, "docs/reports/platform-escrow-framework-interface-latest.json");
  const markdownPath = path.join(repoRoot, "docs/reports/platform-escrow-framework-interface-latest.md");
  const json = `${JSON.stringify(report, null, 2)}\n`;
  const markdown = renderPlatformEscrowFrameworkMarkdown(report);
  if (check) {
    const existingJson = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    const currentJson = JSON.parse(json);
    delete existingJson.generated_at_utc;
    delete currentJson.generated_at_utc;
    if (JSON.stringify(existingJson) !== JSON.stringify(currentJson)) throw new Error("PlatformEscrow framework JSON is stale");
    const existingMarkdown = fs.readFileSync(markdownPath, "utf8").replace(/^Generated: .*$/m, "Generated: <ignored>");
    const currentMarkdown = markdown.replace(/^Generated: .*$/m, "Generated: <ignored>");
    if (existingMarkdown !== currentMarkdown) throw new Error("PlatformEscrow framework Markdown is stale");
  } else {
    fs.writeFileSync(jsonPath, json);
    fs.writeFileSync(markdownPath, markdown);
  }
  if (!report.passed) throw new Error("PlatformEscrow framework interface audit failed");
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = writePlatformEscrowFrameworkReport({ check: process.argv.includes("--check") });
  console.log(`PlatformEscrow framework interface: ${report.tenant_abi_method_count}/${report.tenant_abi_method_count} PASS`);
}

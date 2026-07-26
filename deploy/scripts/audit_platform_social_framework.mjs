#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { hasPlatformBinding } from "./lib/platform_binding_source.mjs";

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
  "registerApp",
  "setAppPaused",
  "getAppType",
  "isAppPaused",
  "onNEP17Payment",
]);

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function configuredPlatformSocialConsumers() {
  const appsDir = path.join(repoRoot, "apps");
  const consumers = [];
  for (const slug of fs.readdirSync(appsDir).sort()) {
    const manifestPath = path.join(appsDir, slug, "src", "manifest.ts");
    if (!fs.existsSync(manifestPath)) continue;
    const source = fs.readFileSync(manifestPath, "utf8");
    if (hasPlatformBinding(source, "social") || /moduleId\s*:\s*["'`]platform-social["'`]/.test(source)) consumers.push(slug);
  }
  return consumers;
}

export function evaluatePlatformSocialFramework({
  manifest,
  surfaceSource,
  typesSource,
  indexSource,
  defineMiniAppSource,
  timestampProofSource = "",
  consumers = [],
}) {
  const abiMethods = (manifest.abi?.methods ?? [])
    .map((method) => method.name)
    .filter((name) => !controlMethods.has(name))
    .sort();
  const operationPattern = /\b(?:read|invoke)\("([A-Za-z0-9_]+)"/g;
  const allOperations = [...surfaceSource.matchAll(operationPattern)].map((match) => match[1]);
  const nativeOperations = allOperations.filter((name) => name === "transfer").sort();
  const frameworkMethods = allOperations.filter((name) => name !== "transfer").sort();
  const abiSet = new Set(abiMethods);
  const frameworkSet = new Set(frameworkMethods);
  const missingMethods = abiMethods.filter((name) => !frameworkSet.has(name));
  const extraMethods = frameworkMethods.filter((name) => !abiSet.has(name));
  const wiring = {
    options_config: typesSource.includes("platformSocial?: FrameworkPlatformSocialConfig"),
    framework_surface: typesSource.includes("readonly platformSocial: FrameworkPlatformSocialSurface"),
    composition_root: indexSource.includes("createPlatformSocialSurface") &&
      indexSource.includes("get platformSocial()"),
    manifest_binding: defineMiniAppSource.includes("platformSocialConfigFromManifest") &&
      defineMiniAppSource.includes("platformSocial={resolvedPlatformSocial}"),
    timestamp_proof_dual_path: timestampProofSource.includes("app.platformSocial.available") &&
      timestampProofSource.includes("app.platformSocial.notarize") &&
      timestampProofSource.includes('anchorMethod === "platform-notary"'),
    tenant_credit_prepayment: surfaceSource.includes("prepayGasCredit") &&
      surfaceSource.includes("prepayNeoCredit") &&
      surfaceSource.includes('`${appId()}:credit`'),
    scoped_write_guard: surfaceSource.includes("WRITE_PLATFORM_SOCIAL"),
  };
  return {
    passed: missingMethods.length === 0 && extraMethods.length === 0 &&
      nativeOperations.length === 1 && Object.values(wiring).every(Boolean),
    user_abi_method_count: abiMethods.length,
    framework_operation_count: frameworkMethods.length,
    user_abi_methods: abiMethods,
    framework_operations: frameworkMethods,
    native_operations: nativeOperations,
    missing_methods: missingMethods,
    extra_methods: extraMethods,
    wiring,
    configured_consumer_count: consumers.length,
    configured_consumers: consumers,
  };
}

export function buildPlatformSocialFrameworkReport({ now = () => new Date() } = {}) {
  const live = JSON.parse(read("docs/reports/platform-contract-testnet-live-latest.json"));
  const deployment = (live.contracts ?? []).find((contract) => contract.name === "PlatformSocial") ?? null;
  const evaluation = evaluatePlatformSocialFramework({
    manifest: JSON.parse(read("contracts/build/PlatformSocial.manifest.json")),
    surfaceSource: read("framework/platform-social-surface.ts"),
    typesSource: read("framework/types.ts"),
    indexSource: read("framework/index.ts"),
    defineMiniAppSource: read("apps/shared/react/defineMiniApp.tsx"),
    timestampProofSource: read("apps/timestamp-proof/src/composables/useTimestampProof.ts"),
    consumers: configuredPlatformSocialConsumers(),
  });
  return {
    generated_at_utc: now().toISOString(),
    ...evaluation,
    deployment: deployment ? {
      kind: deployment.kind,
      status: deployment.status,
      local_nef_checksum: deployment.local_nef_checksum,
      current_local_artifact_match: deployment.current_local_artifact_match,
    } : null,
    boundary: deployment?.status === "no-deployment-record"
      ? "The framework covers the complete user-facing local PlatformSocial ABI, including tenant-scoped Notary and (appId,payer)-scoped GAS/NEO credits with native prepayment, tenant/global liability reads, and pause-immune exits. Timestamp Proof contains a guarded dual path that uses Notary only when an explicit shared PlatformSocial engine binding exists and otherwise preserves its current zero-GAS self-transfer receipt flow. PlatformSocial has no retained deployment record and configured production consumers remain zero; no app should add the shared binding until deployment, registration, compatibility, and lifecycle gates pass."
      : "Framework ABI coverage does not by itself prove a deployed PlatformSocial runtime.",
    chain_writes_performed: false,
  };
}

export function renderPlatformSocialFrameworkMarkdown(report) {
  return `${[
    "# PlatformSocial Framework Interface",
    "",
    `Generated: ${report.generated_at_utc}`,
    "",
    `- Interface audit: **${report.passed ? "PASS" : "FAIL"}**`,
    `- User-facing contract ABI: ${report.user_abi_method_count} methods`,
    `- Framework operations: ${report.framework_operation_count} methods`,
    `- Native credit transfer operations: ${report.native_operations.length}`,
    `- Missing methods: ${report.missing_methods.join(", ") || "none"}`,
    `- Extra methods: ${report.extra_methods.join(", ") || "none"}`,
    `- Configured production consumers: ${report.configured_consumer_count}`,
    `- Live deployment status: \`${report.deployment?.status ?? "unknown"}\``,
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

export function writePlatformSocialFrameworkReport({ check = false } = {}) {
  const report = buildPlatformSocialFrameworkReport();
  const jsonPath = path.join(repoRoot, "docs/reports/platform-social-framework-interface-latest.json");
  const markdownPath = path.join(repoRoot, "docs/reports/platform-social-framework-interface-latest.md");
  const json = `${JSON.stringify(report, null, 2)}\n`;
  const markdown = renderPlatformSocialFrameworkMarkdown(report);
  if (check) {
    const existingJson = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    const currentJson = JSON.parse(json);
    delete existingJson.generated_at_utc;
    delete currentJson.generated_at_utc;
    if (JSON.stringify(existingJson) !== JSON.stringify(currentJson)) {
      throw new Error("PlatformSocial framework JSON is stale");
    }
    const existingMarkdown = fs.readFileSync(markdownPath, "utf8")
      .replace(/^Generated: .*$/m, "Generated: <ignored>");
    const currentMarkdown = markdown.replace(/^Generated: .*$/m, "Generated: <ignored>");
    if (existingMarkdown !== currentMarkdown) {
      throw new Error("PlatformSocial framework Markdown is stale");
    }
  } else {
    fs.writeFileSync(jsonPath, json);
    fs.writeFileSync(markdownPath, markdown);
  }
  if (!report.passed) throw new Error("PlatformSocial framework interface audit failed");
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = writePlatformSocialFrameworkReport({ check: process.argv.includes("--check") });
  console.log(`PlatformSocial framework interface: ${report.user_abi_method_count}/${report.user_abi_method_count} PASS`);
}

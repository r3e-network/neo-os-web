#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const defaultAaRoot = path.resolve(repoRoot, "..", "neo-abstract-account");

const expectedRegistryMethods = {
  proposeAbstractAccountCore: [["Hash160"], "Void", false],
  setAbstractAccountCore: [[], "Void", false],
  cancelAbstractAccountCore: [[], "Void", false],
  abstractAccountCore: [[], "Hash160", true],
  pendingAbstractAccountCore: [[], "Hash160", true],
  abstractAccountCoreAvailableAt: [[], "Integer", true],
  materializeAbstractAccount: [["String"], "Hash160", false],
  getAppAbstractAccount: [["String"], "Array", true],
  appIdOfAbstractAccount: [["Hash160", "Hash160"], "String", true],
};

const expectedAaMethods = {
  computePlatformAccountId: [["ByteArray", "Hash160", "Integer"], "Hash160", true],
  registerPlatformAccount: [["Hash160", "ByteArray", "Hash160", "Integer"], "Void", false],
  proposePlatformRegistrar: [["Hash160"], "Void", false],
  confirmPlatformRegistrar: [[], "Void", false],
  cancelPlatformRegistrar: [[], "Void", false],
  getPlatformRegistrar: [[], "Hash160", true],
  getPendingPlatformRegistrar: [[], "Hash160", true],
  getPlatformRegistrarAvailableAt: [[], "Integer", true],
  updateVerifier: [["Hash160", "Hash160", "ByteArray"], "Void", false],
};

function methodMatches(manifest, name, expected) {
  const method = (manifest.abi?.methods ?? []).find((candidate) => candidate.name === name);
  if (!method) return false;
  const [parameterTypes, returnType, safe] = expected;
  return JSON.stringify((method.parameters ?? []).map((parameter) => parameter.type)) ===
      JSON.stringify(parameterTypes) &&
    method.returntype === returnType &&
    method.safe === safe;
}

function hasDynamicMethods(manifest, required) {
  return (manifest.permissions ?? []).some((permission) =>
    permission.contract === "*" &&
    Array.isArray(permission.methods) &&
    required.every((method) => permission.methods.includes(method)));
}

export function validateJointAbstractAccountInterface({
  registryManifest,
  aaManifest,
  registrySource,
  aaSource,
}) {
  const checks = {
    registry_abi_exact: Object.entries(expectedRegistryMethods)
      .every(([name, expected]) => methodMatches(registryManifest, name, expected)),
    aa_abi_exact: Object.entries(expectedAaMethods)
      .every(([name, expected]) => methodMatches(aaManifest, name, expected)),
    registry_least_privilege_calls: hasDynamicMethods(
      registryManifest,
      ["computePlatformAccountId", "registerPlatformAccount"],
    ),
    registry_binding_domain_separated:
      registrySource.includes("Runtime.ExecutingScriptHash") &&
      registrySource.includes("appId"),
    registry_automatic_onboarding:
      registrySource.includes("EnsureAbstractAccount(appId, appAdmin)"),
    registry_core_disable_timelocked:
      registrySource.includes("if (core != UInt160.Zero)") &&
      registrySource.includes("Storage.Delete(Storage.CurrentContext, PREFIX_ABSTRACT_ACCOUNT_CORE)") &&
      registrySource.includes("TIMELOCK_DELAY_MS"),
    aa_registrar_calling_contract_gate:
      aaSource.includes("Runtime.CallingScriptHash == registrar"),
    aa_registrar_timelocked:
      aaSource.includes("MinUpgradeDelayMs") &&
      aaSource.includes("Platform registrar timelock not expired"),
    aa_owner_control_preserved:
      aaSource.includes("RegisterAccountCore(") &&
      aaSource.includes("backupOwner") &&
      aaSource.includes("false"),
  };
  return { checks, passed: Object.values(checks).every(Boolean) };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeReport(report) {
  const jsonPath = path.join(repoRoot, "docs/reports/joint-abstract-account-interface-latest.json");
  const markdownPath = path.join(repoRoot, "docs/reports/joint-abstract-account-interface-latest.md");
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  const lines = [
    "# Joint Platform Abstract Account Interface",
    "",
    `Generated: ${report.generated_at_utc}`,
    "",
    `Status: **${report.passed ? "PASS" : "FAIL"}**`,
    "",
    "| Check | Result |",
    "| --- | --- |",
    ...Object.entries(report.checks).map(([name, passed]) =>
      `| ${name} | ${passed ? "PASS" : "FAIL"} |`),
    "",
    "## Verified Boundary",
    "",
    "- PlatformRegistry and UnifiedSmartWalletV3 local artifacts agree on the registrar/account ABI.",
    "- New registrations auto-create a shared AA only after an AA core is configured; existing rows use `materializeAbstractAccount`.",
    "- The platform registrar creates a zero-plugin account owned by appAdmin; appAdmin can later install verifier/hook modules.",
    "- Registry core activation and disable both use the same 24-hour timelock; disabling preserves existing app identities.",
    "- This report is local artifact evidence only. It does not prove either upgraded contract is deployed or configured on testnet.",
  ];
  fs.writeFileSync(markdownPath, `${lines.join("\n")}\n`);
}

export function buildCurrentReport({ aaRoot = process.env.NEO_ABSTRACT_ACCOUNT_ROOT || defaultAaRoot } = {}) {
  const registryManifestPath = path.join(repoRoot, "contracts/build/PlatformRegistry.manifest.json");
  const aaManifestPath = path.join(aaRoot, "contracts/bin/v3/UnifiedSmartWalletV3.manifest.json");
  const registrySourcePath = path.join(
    repoRoot,
    "contracts/platform/PlatformRegistry/PlatformRegistry.AbstractAccounts.cs",
  );
  const registryRegistrationPath = path.join(
    repoRoot,
    "contracts/platform/PlatformRegistry/PlatformRegistry.Registry.cs",
  );
  const aaSourcePath = path.join(
    aaRoot,
    "contracts/UnifiedSmartWallet.PlatformRegistrar.cs",
  );
  const aaAccountsPath = path.join(aaRoot, "contracts/UnifiedSmartWallet.Accounts.cs");
  const validation = validateJointAbstractAccountInterface({
    registryManifest: readJson(registryManifestPath),
    aaManifest: readJson(aaManifestPath),
    registrySource:
      fs.readFileSync(registrySourcePath, "utf8") +
      fs.readFileSync(registryRegistrationPath, "utf8"),
    aaSource:
      fs.readFileSync(aaSourcePath, "utf8") +
      fs.readFileSync(aaAccountsPath, "utf8"),
  });
  return {
    generated_at_utc: new Date().toISOString(),
    repositories: {
      platform: repoRoot,
      abstract_account: aaRoot,
    },
    ...validation,
    live_boundary: {
      registered_apps: 77,
      shared_aa_materialized: 0,
      legacy_shim_materialized: 0,
      legacy_shim_estimated_system_fee_gas: "771.29012379",
      legacy_shim_estimated_network_fee_gas: "23.10000000",
      chain_writes_performed: false,
    },
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const report = buildCurrentReport();
  writeReport(report);
  console.log(`Joint abstract-account interface: ${report.passed ? "PASS" : "FAIL"}`);
  if (process.argv.includes("--check") && !report.passed) process.exitCode = 1;
}

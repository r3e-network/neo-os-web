#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const liveTestnetReportPath = "docs/reports/platform-contract-testnet-live-latest.json";

const contracts = [
  {
    name: "PlatformRegistry",
    moneyContract: true,
    deploymentEvidenceClass: "deployment-report",
    deploymentStatus: "testnet registry report retained; fresh live read documented separately",
    deploymentEvidence: ["deploy/config/platform-registry-testnet-2026-07-19.json"],
  },
  {
    name: "AppAccount",
    moneyContract: true,
    deploymentEvidenceClass: "artifact-activation",
    deploymentStatus: "artifact active on testnet registry; no fleet accounts materialized",
    deploymentEvidence: ["deploy/config/platform-registry-testnet-2026-07-19.json"],
  },
  {
    name: "MiniAppFactory",
    moneyContract: false,
    deploymentEvidenceClass: "consumer-binding",
    deploymentStatus: "consumer bindings exist; no dedicated deployment report retained",
    deploymentEvidence: [
      "apps/asset-factory/neo-manifest.json",
      "apps/miniapp-factory/neo-manifest.json",
      "apps/nft-factory/neo-manifest.json",
    ],
  },
  {
    name: "PlatformAnchor",
    moneyContract: true,
    deploymentEvidenceClass: "deployment-report",
    deploymentStatus: "testnet and mainnet deployment reports retained",
    deploymentEvidence: [
      "contracts/build/testnet_anchor_deployment.json",
      "contracts/build/mainnet_anchor_deployment.json",
    ],
  },
  {
    name: "PlatformGame",
    moneyContract: true,
    deploymentEvidenceClass: "deployment-report",
    deploymentStatus: "testnet and mainnet deployment reports retained; testnet Registry row active",
    deploymentEvidence: [
      "contracts/build/testnet_game_deployment.json",
      "contracts/build/mainnet_game_deployment.json",
      "deploy/config/platform-registry-testnet-2026-07-19.json",
    ],
  },
  {
    name: "PlatformDeFi",
    moneyContract: true,
    deploymentEvidenceClass: "deployment-report",
    deploymentStatus: "testnet hash retained in anchor deployment report; no live app bindings",
    deploymentEvidence: ["contracts/build/testnet_anchor_deployment.json"],
  },
  {
    name: "PlatformSocial",
    moneyContract: true,
    deploymentEvidenceClass: "none",
    deploymentStatus: "no deployment record",
    deploymentEvidence: [],
  },
];

const factoryTemplates = [
  {
    key: "nep17",
    name: "FactoryNep17Token",
    supportedStandard: "NEP-17",
  },
  {
    key: "nep11",
    name: "FactoryNep11Collection",
    supportedStandard: "NEP-11",
  },
];

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(repoRoot, relativePath));
}

function sourceFiles(name) {
  const directory = path.join(repoRoot, "contracts", "platform", name);
  return fs
    .readdirSync(directory)
    .filter((file) => file.endsWith(".cs"))
    .sort()
    .map((file) => path.join("contracts", "platform", name, file));
}

function templateSourceFiles(name) {
  const directory = path.join(repoRoot, "contracts", "templates", name);
  return fs
    .readdirSync(directory)
    .filter((file) => file.endsWith(".cs"))
    .sort()
    .map((file) => path.join("contracts", "templates", name, file));
}

function matchingTests(name) {
  const directory = path.join(repoRoot, "contracts", "__tests__");
  return fs
    .readdirSync(directory)
    .filter((file) => file.endsWith(".cs") || file.endsWith(".ts"))
    .filter((file) => read(path.join("contracts", "__tests__", file)).includes(name))
    .sort()
    .map((file) => path.join("contracts", "__tests__", file));
}

function manifestMethodNames(manifest) {
  return new Set((manifest.abi?.methods ?? []).map((method) => method.name));
}

function permissionHasWildcardMethod(permission) {
  return permission.methods === "*" || permission.methods?.includes?.("*");
}

function lineCount(text) {
  if (text.length === 0) return 0;
  const lines = text.split(/\r?\n/).length;
  return text.endsWith("\n") ? lines - 1 : lines;
}

function sha256Hex(value) {
  return `0x${crypto.createHash("sha256").update(value).digest("hex")}`;
}

function buildFactoryTemplateLedger() {
  const generatedArtifactsPath =
    "apps/shared/factory/generated-template-artifacts.ts";
  const generatedArtifacts = read(generatedArtifactsPath);
  return factoryTemplates.map((template) => {
    const manifestPath = `contracts/build/${template.name}.manifest.json`;
    const nefPath = `contracts/build/${template.name}.nef`;
    const csprojPath =
      `contracts/templates/${template.name}/${template.name}.csproj`;
    const files = templateSourceFiles(template.name);
    const manifest = JSON.parse(read(manifestPath));
    const nefHash = sha256Hex(fs.readFileSync(path.join(repoRoot, nefPath)));
    const manifestHash = sha256Hex(
      Buffer.from(JSON.stringify(manifest), "utf8"),
    );
    const tests = matchingTests(template.name);
    const oversizedFiles = files.filter((file) => lineCount(read(file)) > 300);
    const wildcardMethodPermissions = (manifest.permissions ?? []).filter(
      permissionHasWildcardMethod,
    );
    const checks = {
      source_project_present: exists(csprojPath) && files.length > 0,
      build_artifacts_present: exists(manifestPath) && exists(nefPath),
      manifest_name_matches: manifest.name === template.name,
      supported_standard_present:
        (manifest.supportedstandards ?? []).includes(template.supportedStandard),
      lifecycle_tests_present: tests.length > 0,
      source_files_within_300_lines: oversizedFiles.length === 0,
      no_wildcard_method_permission: wildcardMethodPermissions.length === 0,
      generated_hashes_fresh:
        generatedArtifacts.includes(`\"${template.key}\"`) &&
        generatedArtifacts.includes(`\"contractName\": \"${template.name}\"`) &&
        generatedArtifacts.includes(`\"nefSha256\": \"${nefHash}\"`) &&
        generatedArtifacts.includes(`\"manifestSha256\": \"${manifestHash}\"`),
    };
    return {
      key: template.key,
      name: template.name,
      supported_standard: template.supportedStandard,
      source_files: files,
      build_artifacts: [nefPath, manifestPath],
      generated_artifacts: generatedArtifactsPath,
      artifact_hashes: {
        nef_sha256: nefHash,
        manifest_sha256: manifestHash,
      },
      test_files: tests,
      abi: {
        methods: manifest.abi?.methods?.length ?? 0,
        events: manifest.abi?.events?.length ?? 0,
        permissions: manifest.permissions?.length ?? 0,
        supported_standards: manifest.supportedstandards ?? [],
      },
      checks,
      source_acceptance: Object.values(checks).every(Boolean),
      oversized_files: oversizedFiles,
      wildcard_method_permissions: wildcardMethodPermissions,
      boundary:
        "Template source/build/lifecycle acceptance does not prove the current testnet Factory exposes the six-argument deployment ABI or that a funded deployment has recovered end to end.",
    };
  });
}

export function buildAcceptanceLedger() {
  const liveTestnetReport = exists(liveTestnetReportPath)
    ? JSON.parse(read(liveTestnetReportPath))
    : null;
  const liveTestnetRows = new Map(
    (liveTestnetReport?.contracts ?? []).map((row) => [row.name, row]),
  );
  const rows = contracts.map((contract) => {
    const manifestPath = `contracts/build/${contract.name}.manifest.json`;
    const nefPath = `contracts/build/${contract.name}.nef`;
    const csprojPath = `contracts/platform/${contract.name}/${contract.name}.csproj`;
    const files = sourceFiles(contract.name);
    const source = files.map(read).join("\n");
    const manifest = JSON.parse(read(manifestPath));
    const methods = manifestMethodNames(manifest);
    const oversizedFiles = files.filter((file) => lineCount(read(file)) > 300);
    const wildcardMethodPermissions = (manifest.permissions ?? []).filter(
      permissionHasWildcardMethod,
    );
    const tests = matchingTests(contract.name);
    const liveTestnet = liveTestnetRows.get(contract.name);
    const checks = {
      source_project_present: exists(csprojPath) && files.length > 0,
      build_artifacts_present: exists(manifestPath) && exists(nefPath),
      manifest_name_matches: manifest.name === contract.name,
      update_in_abi: methods.has("update"),
      update_in_source: source.includes("ContractManagement.Update"),
      destroy_absent: !source.includes("ContractManagement.Destroy"),
      source_files_within_300_lines: oversizedFiles.length === 0,
      no_wildcard_method_permission: wildcardMethodPermissions.length === 0,
      money_callback_present:
        !contract.moneyContract || methods.has("onNEP17Payment"),
      contract_tests_present: tests.length > 0,
      deployment_evidence_paths_present: contract.deploymentEvidence.every(exists),
    };
    return {
      name: contract.name,
      source_files: files,
      abi: {
        methods: manifest.abi?.methods?.length ?? 0,
        events: manifest.abi?.events?.length ?? 0,
        permissions: manifest.permissions?.length ?? 0,
        supported_standards: manifest.supportedstandards ?? [],
      },
      money_contract: contract.moneyContract,
      test_files: tests,
      deployment_status: contract.deploymentStatus,
      deployment_evidence_class: contract.deploymentEvidenceClass,
      deployment_evidence: contract.deploymentEvidence,
      live_testnet: liveTestnet
        ? {
            status: liveTestnet.status,
            kind: liveTestnet.kind,
            hash: liveTestnet.hash ?? liveTestnet.registry_hash ?? null,
            local_nef_checksum: liveTestnet.local_nef_checksum,
            on_chain_nef_checksum: liveTestnet.on_chain_nef_checksum ?? null,
            current_local_artifact_match:
              liveTestnet.current_local_artifact_match,
            missing_on_chain_methods:
              liveTestnet.abi?.missing_on_chain ?? [],
          }
        : null,
      checks,
      source_acceptance: Object.entries(checks)
        .filter(([key]) => key !== "deployment_evidence_paths_present")
        .every(([, value]) => value),
      deployment_report_present:
        contract.deploymentEvidenceClass === "deployment-report" &&
        checks.deployment_evidence_paths_present,
      oversized_files: oversizedFiles,
      wildcard_method_permissions: wildcardMethodPermissions,
    };
  });
  const templateRows = buildFactoryTemplateLedger();

  return {
    generated_at_utc: new Date().toISOString(),
    scope: "current source/build/test evidence plus retained deployment artifacts",
    summary: {
      contracts: rows.length,
      source_accepted: rows.filter((row) => row.source_acceptance).length,
      deployment_reports_present: rows.filter(
        (row) => row.deployment_report_present,
      ).length,
      partial_operational_evidence: rows.filter((row) =>
        ["artifact-activation", "consumer-binding"].includes(
          row.deployment_evidence_class,
        ),
      ).length,
      no_deployment_record: rows.filter(
        (row) => row.deployment_evidence.length === 0,
      ).length,
      current_testnet_artifact_matches: rows.filter(
        (row) => row.live_testnet?.current_local_artifact_match,
      ).length,
      testnet_artifact_drifts: rows.filter((row) =>
        row.live_testnet?.status.endsWith("artifact-drift"),
      ).length,
      factory_templates: templateRows.length,
      factory_templates_source_accepted: templateRows.filter(
        (row) => row.source_acceptance,
      ).length,
    },
    live_testnet_evidence: liveTestnetReport
      ? {
          path: liveTestnetReportPath,
          generated_at_utc: liveTestnetReport.generated_at_utc,
          network: liveTestnetReport.network,
          network_magic: liveTestnetReport.network_magic,
        }
      : null,
    contracts: rows,
    factory_templates: templateRows,
    boundary:
      "Source acceptance and read-only testnet checks do not prove funded lifecycle behavior, mainnet parity, or operational health. A retained deployment report is historical evidence, not current bytecode equality.",
  };
}

export function renderAcceptanceMarkdown(ledger) {
  const lines = [
    "# Platform Contract Acceptance Ledger",
    "",
    `Generated: ${ledger.generated_at_utc}`,
    "",
    "## Summary",
    "",
    `- Contracts inventoried: ${ledger.summary.contracts}`,
    `- Source/build/test acceptance: ${ledger.summary.source_accepted}/${ledger.summary.contracts}`,
    `- Retained deployment reports: ${ledger.summary.deployment_reports_present}/${ledger.summary.contracts}`,
    `- Partial operational evidence: ${ledger.summary.partial_operational_evidence}/${ledger.summary.contracts}`,
    `- No deployment record: ${ledger.summary.no_deployment_record}`,
    `- Current testnet artifact matches: ${ledger.summary.current_testnet_artifact_matches}/${ledger.summary.contracts}`,
    `- Testnet artifact drifts: ${ledger.summary.testnet_artifact_drifts}`,
    `- Factory templates source/build/lifecycle acceptance: ${ledger.summary.factory_templates_source_accepted}/${ledger.summary.factory_templates}`,
    `- Boundary: ${ledger.boundary}`,
    "",
    "## Ledger",
    "",
    "| Contract | ABI methods/events | Permissions | Money callback | Update | Tests | Source acceptance | Testnet artifact | Evidence class | Deployment evidence |",
    "| --- | ---: | ---: | --- | --- | ---: | --- | --- | --- | --- |",
  ];

  for (const row of ledger.contracts) {
    lines.push(
      `| ${row.name} | ${row.abi.methods}/${row.abi.events} | ${row.abi.permissions} | ${row.checks.money_callback_present ? "yes" : "no"} | ${row.checks.update_in_abi && row.checks.update_in_source ? "yes" : "no"} | ${row.test_files.length} | ${row.source_acceptance ? "accepted" : "incomplete"} | ${row.live_testnet?.status ?? "not checked"} | ${row.deployment_evidence_class} | ${row.deployment_status} |`,
    );
  }

  lines.push("", "## Factory Templates", "");
  lines.push(
    "| Template | Standard | ABI methods/events | Tests | Generated hashes | Source acceptance |",
    "| --- | --- | ---: | ---: | --- | --- |",
  );
  for (const row of ledger.factory_templates) {
    lines.push(
      `| ${row.name} | ${row.supported_standard} | ${row.abi.methods}/${row.abi.events} | ${row.test_files.length} | ${row.checks.generated_hashes_fresh ? "fresh" : "stale"} | ${row.source_acceptance ? "accepted" : "incomplete"} |`,
    );
  }

  lines.push("", "## Evidence Detail", "");
  for (const row of ledger.contracts) {
    lines.push(`### ${row.name}`, "");
    lines.push(`- Source files: ${row.source_files.length}`);
    lines.push(`- Test files: ${row.test_files.length ? row.test_files.map((file) => `\`${file}\``).join(", ") : "none"}`);
    lines.push(`- Deployment evidence: ${row.deployment_evidence.length ? row.deployment_evidence.map((file) => `\`${file}\``).join(", ") : "none"}`);
    lines.push(`- Current testnet artifact: ${row.live_testnet?.status ?? "not checked"}`);
    if (row.live_testnet?.missing_on_chain_methods.length) {
      lines.push(`- Methods missing on current testnet deployment: ${row.live_testnet.missing_on_chain_methods.join(", ")}`);
    }
    const failedChecks = Object.entries(row.checks)
      .filter(([, value]) => !value)
      .map(([key]) => key);
    lines.push(`- Failed checks: ${failedChecks.length ? failedChecks.join(", ") : "none"}`);
    lines.push("");
  }
  lines.push("## Factory Template Evidence", "");
  for (const row of ledger.factory_templates) {
    lines.push(`### ${row.name}`, "");
    lines.push(`- Standard: ${row.supported_standard}`);
    lines.push(`- Source files: ${row.source_files.length}`);
    lines.push(`- Lifecycle tests: ${row.test_files.map((file) => `\`${file}\``).join(", ") || "none"}`);
    lines.push(`- Generated artifact hashes: ${row.checks.generated_hashes_fresh ? "fresh" : "stale"}`);
    lines.push(`- Boundary: ${row.boundary}`, "");
  }
  if (lines[lines.length - 1] === "") lines.pop();
  return `${lines.join("\n")}\n`;
}

export function writeAcceptanceLedger({ check = false } = {}) {
  const ledger = buildAcceptanceLedger();
  const jsonPath = path.join(repoRoot, "docs", "reports", "platform-contract-acceptance-latest.json");
  const markdownPath = path.join(repoRoot, "docs", "reports", "platform-contract-acceptance-latest.md");
  const json = `${JSON.stringify(ledger, null, 2)}\n`;
  const markdown = renderAcceptanceMarkdown(ledger);

  if (check) {
    const existingJson = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    const currentJson = JSON.parse(json);
    delete existingJson.generated_at_utc;
    delete currentJson.generated_at_utc;
    if (JSON.stringify(existingJson) !== JSON.stringify(currentJson)) {
      throw new Error("platform contract acceptance JSON is stale");
    }
    const existingMarkdown = fs
      .readFileSync(markdownPath, "utf8")
      .replace(/^Generated: .*$/m, "Generated: <ignored>");
    const currentMarkdown = markdown.replace(
      /^Generated: .*$/m,
      "Generated: <ignored>",
    );
    if (existingMarkdown !== currentMarkdown) {
      throw new Error("platform contract acceptance Markdown is stale");
    }
    return ledger;
  }

  fs.writeFileSync(jsonPath, json);
  fs.writeFileSync(markdownPath, markdown);
  return ledger;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const ledger = writeAcceptanceLedger({ check: process.argv.includes("--check") });
  console.log(
    `Platform contract acceptance: ${ledger.summary.source_accepted}/${ledger.summary.contracts} source-accepted; ${ledger.summary.deployment_reports_present}/${ledger.summary.contracts} with retained deployment reports.`,
  );
}

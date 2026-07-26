import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const contractsRoot = path.join(repoRoot, "contracts", "platform");

export const PLATFORM_ENGINE_CONTRACTS = [
  { id: "PlatformGame", directory: "PlatformGame" },
  { id: "PlatformSocial", directory: "PlatformSocial" },
  { id: "PlatformDeFi", directory: "PlatformDeFi" },
  { id: "PlatformAnchor", directory: "PlatformAnchor" },
  { id: "PlatformVesting", directory: "PlatformVesting" },
  { id: "PlatformEscrow", directory: "PlatformEscrow" },
];

const readSources = (directory) => fs
  .readdirSync(directory)
  .filter((file) => file.endsWith(".cs"))
  .sort()
  .map((file) => ({ file, source: fs.readFileSync(path.join(directory, file), "utf8") }));

const count = (source, pattern) => [...source.matchAll(pattern)].length;

export function inspectPlatformEngine({ id, directory }) {
  const absoluteDirectory = path.join(contractsRoot, directory);
  const files = readSources(absoluteDirectory);
  const source = files.map(({ source: content }) => content).join("\n");
  const declaration = files.find(({ source: content }) =>
    new RegExp(`class\\s+${id}Contract?\\s*:`).test(content) ||
    new RegExp(`class\\s+${id}\\s*:`).test(content),
  );
  const classSource = declaration?.source ?? source;
  const usesEngineBase = /:\s*MiniAppEngineBase\b/.test(classSource);
  const appKeyHelpers = count(
    source,
    /(?:private|protected)\s+static\s+(?:byte\[\]|ByteString)\s+AppKey\s*\(/g,
  );
  const sharedKeyDelegates = count(source, /MiniAppStorageKeys\.(?:AppKey|AppKeyValue|HashedAppKey|LengthDelimitedId)\s*\(/g);
  const hasTenantRegistration = /Register(?:Game|Social|Anchor|Product|App|Escrow|Vesting)/.test(source);
  const hasTenantAdmin = /(?:APP_ADMIN|GAME_ADMIN|TENANT_ADMIN|appAdmin|app admin)/i.test(source);
  const hasCreditLiability = id === "PlatformAnchor"
    ? /AppKey\(appId,[^\n]*PREFIX_APP_(?:TOTAL_)?(?:NEO|GAS)_CREDIT/.test(source) &&
      /GetAppTotal(?:Neo|Gas)Credit/.test(source)
    : /liability/i.test(source) && /Credit|credit/.test(source);
  const hasPauseGate = /Paused|paused/.test(source);
  const hasReentrancyGuard = /reentrancy|Acquire(?:Tenant|Account|Contract)Lock/.test(source);

  return {
    id,
    directory,
    files: files.length,
    uses_engine_base: usesEngineBase,
    app_key_helpers: appKeyHelpers,
    shared_key_delegates: sharedKeyDelegates,
    storage_key_strategy: usesEngineBase
      ? "MiniAppEngineBase"
      : sharedKeyDelegates > 0
        ? "MiniAppStorageKeys"
        : "local",
    has_tenant_registration: hasTenantRegistration,
    has_tenant_admin: hasTenantAdmin,
    has_tenant_credit_liability: hasCreditLiability,
    has_pause_gate: hasPauseGate,
    has_reentrancy_guard: hasReentrancyGuard,
    duplicate_storage_kit: !usesEngineBase && appKeyHelpers > 0 && sharedKeyDelegates === 0,
  };
}

export function buildPlatformEngineBaseReport() {
  const engines = PLATFORM_ENGINE_CONTRACTS.map(inspectPlatformEngine);
  const unresolved = engines
    .filter((engine) => engine.duplicate_storage_kit)
    .map((engine) => `${engine.id}:duplicate-AppKey`);
  const missingCapabilities = engines.flatMap((engine) => [
    ...(engine.has_tenant_registration ? [] : [`${engine.id}:tenant-registration`]),
    ...(engine.has_tenant_admin ? [] : [`${engine.id}:tenant-admin`]),
    ...(engine.has_tenant_credit_liability ? [] : [`${engine.id}:tenant-credit-liability`]),
    ...(engine.has_pause_gate ? [] : [`${engine.id}:pause-gate`]),
    ...(engine.has_reentrancy_guard ? [] : [`${engine.id}:reentrancy-guard`]),
  ]);

  return {
    generated_at: new Date().toISOString(),
    scope: "source-only platform engine conformance",
    canonical_base: "contracts/MiniApp.DevPack/MiniAppEngineBase.cs",
    engines,
    summary: {
      engine_count: engines.length,
      base_adopters: engines.filter((engine) => engine.uses_engine_base).length,
      duplicate_storage_kits: engines.filter((engine) => engine.duplicate_storage_kit).length,
      unresolved,
      missing_capabilities: missingCapabilities,
      status: unresolved.length === 0 && missingCapabilities.length === 0 ? "complete" : "incomplete",
    },
  };
}

function main() {
  const report = buildPlatformEngineBaseReport();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (process.argv.includes("--strict") && report.summary.status !== "complete") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

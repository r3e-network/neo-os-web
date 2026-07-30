#!/usr/bin/env node

import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  defaultRpcCandidates,
  fetchJsonRpc,
  loadPlatformTargets,
  selectTestnetRpc,
} from "./verify_platform_contracts_live.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const defaultAaRoot = path.resolve(repoRoot, "..", "neo-abstract-account");
// PlatformRegistry is built in neo-os-contracts; this repo has no contracts/.
const contractsRoot = process.env.NEO_OS_CONTRACTS_DIR
  || path.resolve(repoRoot, "..", "neo-os-contracts");
const defaultAaTestnetHash = "0xdbf38e7b2117186bf7a5e17ead702322c0c5b6f2";
const zeroHash = `0x${"0".repeat(40)}`;

export const requiredRegistryMethods = [
  "abstractAccountCore",
  "pendingAbstractAccountCore",
  "abstractAccountCoreAvailableAt",
  "proposeAbstractAccountCore",
  "setAbstractAccountCore",
  "cancelAbstractAccountCore",
  "materializeAbstractAccount",
  "getAppAbstractAccount",
  "appIdOfAbstractAccount",
];

export const requiredAaMethods = [
  "computePlatformAccountId",
  "computeStablePlatformAccountId",
  "registerPlatformAccount",
  "registerStablePlatformAccount",
  "rotatePlatformAccountOwner",
  "getPlatformRegistrar",
  "getPendingPlatformRegistrar",
  "getPlatformRegistrarAvailableAt",
  "proposePlatformRegistrar",
  "confirmPlatformRegistrar",
  "cancelPlatformRegistrar",
];

function normalizeHash(value, label) {
  const raw = String(value ?? "").trim().toLowerCase();
  const hash = raw.startsWith("0x") ? raw : `0x${raw}`;
  if (!/^0x[0-9a-f]{40}$/.test(hash)) throw new Error(`${label} is not a UInt160 hash`);
  return hash;
}

function isZero(hash) {
  return normalizeHash(hash, "hash") === zeroHash;
}

function missingMethods(methods, required) {
  const available = new Set(methods);
  return required.filter((method) => !available.has(method));
}

export function classifyAaUpgradeRoute(methods) {
  const available = new Set(methods);
  if (available.has("proposeUpdate") && available.has("update")) return "timelocked";
  if (available.has("update")) return "legacy_direct";
  return "unavailable";
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalJson).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalJson(value[key])]));
  }
  return value;
}

function methodSignature(method) {
  const parameters = (method.parameters ?? []).map((parameter) => parameter.type).join(",");
  return `${method.name}(${parameters}):${method.returntype}:${method.safe ? "read" : "write"}`;
}

function eventSignature(event) {
  const parameters = (event.parameters ?? []).map((parameter) => parameter.type).join(",");
  return `${event.name}(${parameters})`;
}

function sortedSignatures(values, signature) {
  return (values ?? []).map(signature).sort();
}

function difference(left, right) {
  const rightValues = new Set(right);
  return left.filter((value) => !rightValues.has(value));
}

export function compareAaManifests({ liveManifest, baselineManifest, candidateManifest }) {
  const liveMethods = sortedSignatures(liveManifest.abi?.methods, methodSignature);
  const baselineMethods = sortedSignatures(baselineManifest.abi?.methods, methodSignature);
  const candidateMethods = sortedSignatures(candidateManifest.abi?.methods, methodSignature);
  const liveEvents = sortedSignatures(liveManifest.abi?.events, eventSignature);
  const baselineEvents = sortedSignatures(baselineManifest.abi?.events, eventSignature);
  const candidateEvents = sortedSignatures(candidateManifest.abi?.events, eventSignature);
  const permissionsMatch = JSON.stringify(canonicalJson(liveManifest.permissions ?? [])) ===
    JSON.stringify(canonicalJson(baselineManifest.permissions ?? []));
  const trustsMatch = JSON.stringify(canonicalJson(liveManifest.trusts ?? [])) ===
    JSON.stringify(canonicalJson(baselineManifest.trusts ?? []));
  const methodsMatch = JSON.stringify(liveMethods) === JSON.stringify(baselineMethods);
  const eventsMatch = JSON.stringify(liveEvents) === JSON.stringify(baselineEvents);

  return {
    semantic_baseline_matches_live: methodsMatch && eventsMatch && permissionsMatch && trustsMatch,
    baseline_match: {
      methods: methodsMatch,
      events: eventsMatch,
      permissions: permissionsMatch,
      trusts: trustsMatch,
    },
    candidate_abi_delta: {
      added_methods: difference(candidateMethods, liveMethods),
      removed_methods: difference(liveMethods, candidateMethods),
      added_events: difference(candidateEvents, liveEvents),
      removed_events: difference(liveEvents, candidateEvents),
    },
  };
}

function parseStoragePrefixes(sources) {
  const prefixes = new Map();
  const pattern = /\b(Prefix_[A-Za-z0-9_]+)\s*=\s*new byte\[\]\s*\{\s*(0x[0-9A-Fa-f]{2})\s*\}/g;
  for (const source of sources) {
    for (const match of source.matchAll(pattern)) prefixes.set(match[1], match[2].toLowerCase());
  }
  return prefixes;
}

function parseLegacyStoragePrefixes(sources) {
  const prefixes = new Map();
  const pattern = /\b(LegacyStoragePrefix[A-Za-z0-9_]+)\s*=\s*new byte\[\]\s*\{\s*(0x[0-9A-Fa-f]{2})\s*\}/g;
  for (const source of sources) {
    for (const match of source.matchAll(pattern)) prefixes.set(match[1], match[2].toLowerCase());
  }
  return prefixes;
}

function hasStorageOperation(source, operation, prefix) {
  return source
    .split(/\r?\n/)
    .some((line) => line.includes(`Storage.${operation}`) && line.includes(prefix));
}

function parseStoredRecordLayouts(sources) {
  const layouts = new Map();
  for (const source of sources) {
    const classPattern = /\bpublic\s+(?:class|struct)\s+([A-Za-z0-9_]+)/g;
    for (const match of source.matchAll(classPattern)) {
      const name = match[1];
      if (name === "UnifiedSmartWallet") continue;
      const open = source.indexOf("{", match.index + match[0].length);
      if (open < 0) continue;
      let depth = 1;
      let close = open + 1;
      while (close < source.length && depth > 0) {
        if (source[close] === "{") depth += 1;
        if (source[close] === "}") depth -= 1;
        close += 1;
      }
      const body = source.slice(open + 1, close - 1);
      const fields = [];
      const fieldPattern = /^\s*public\s+([A-Za-z0-9_<>,.?\[\]]+)\s+([A-Za-z0-9_]+)\s*(?:=|;)/gm;
      for (const field of body.matchAll(fieldPattern)) fields.push(`${field[1]} ${field[2]}`);
      if (fields.length) layouts.set(name, fields);
    }
  }
  return layouts;
}

export function compareAaStorageSources({ baselineSources, candidateSources }) {
  const baselinePrefixes = parseStoragePrefixes(baselineSources);
  const candidatePrefixes = parseStoragePrefixes(candidateSources);
  const legacyPrefixes = parseLegacyStoragePrefixes(candidateSources);
  const baselineLayouts = parseStoredRecordLayouts(baselineSources);
  const candidateLayouts = parseStoredRecordLayouts(candidateSources);
  const existingPrefixesChanged = [...baselinePrefixes].flatMap(([name, value]) => {
    const candidate = candidatePrefixes.get(name);
    return candidate && candidate !== value ? [{ name, baseline: value, candidate }] : [];
  });
  const legacyPrefixMigrations = existingPrefixesChanged.flatMap((change) => {
    const aliases = [...legacyPrefixes]
      .filter(([, value]) => value === change.baseline)
      .map(([name]) => name);
    const alias = aliases.find((name) => (
      candidateSources.some((source) => hasStorageOperation(source, "Get", name)) &&
      candidateSources.some((source) => hasStorageOperation(source, "Delete", name))
    ));
    const activeWrite = candidateSources.some((source) => (
      hasStorageOperation(source, "Put", change.name) ||
      (source.includes(`Helper.Concat(${change.name}`) &&
        source.split(/\r?\n/).some((line) => line.includes("Storage.Put")))
    ));
    return alias && activeWrite
      ? [{ ...change, legacy_alias: alias, read_fallback: true, legacy_cleanup: true, active_write: true }]
      : [];
  });
  const migratedNames = new Set(legacyPrefixMigrations.map(({ name }) => name));
  const unmigratedExistingPrefixes = existingPrefixesChanged.filter(({ name }) => !migratedNames.has(name));
  const addedPrefixes = [...candidatePrefixes].flatMap(([name, value]) => (
    baselinePrefixes.has(name) ? [] : [{ name, value }]
  ));
  const storedRecordLayoutsChanged = [...baselineLayouts].flatMap(([name, fields]) => {
    const candidate = candidateLayouts.get(name);
    return candidate && JSON.stringify(candidate) !== JSON.stringify(fields)
      ? [{ name, baseline: fields, candidate }]
      : [];
  });
  return {
    existing_prefixes_changed: existingPrefixesChanged,
    legacy_prefix_migrations: legacyPrefixMigrations,
    unmigrated_existing_prefixes: unmigratedExistingPrefixes,
    added_prefixes: addedPrefixes,
    stored_record_layouts_changed: storedRecordLayoutsChanged,
  };
}

function conflict(phase, reason) {
  return {
    phase,
    next_action: "stop_and_review_configuration",
    safe_to_materialize: false,
    reason,
  };
}

export function evaluateSharedAaUpgradeState({
  registryHash,
  aaHash,
  registryMethods,
  aaMethods,
  registryCore = zeroHash,
  registryPendingCore = zeroHash,
  registryCoreAvailableAt = 0,
  aaRegistrar = zeroHash,
  aaPendingRegistrar = zeroHash,
  aaRegistrarAvailableAt = 0,
  chainTimeMs = 0,
}) {
  const registry = normalizeHash(registryHash, "registryHash");
  const aa = normalizeHash(aaHash, "aaHash");
  const currentCore = normalizeHash(registryCore, "registryCore");
  const pendingCore = normalizeHash(registryPendingCore, "registryPendingCore");
  const currentRegistrar = normalizeHash(aaRegistrar, "aaRegistrar");
  const pendingRegistrar = normalizeHash(aaPendingRegistrar, "aaPendingRegistrar");
  const registryMissing = missingMethods(registryMethods, requiredRegistryMethods);
  const aaMissing = missingMethods(aaMethods, requiredAaMethods);

  if (registryMissing.length || aaMissing.length) {
    return {
      phase: "upgrade_contracts",
      next_action: "upgrade_aa_then_registry_and_rerun_preflight",
      safe_to_materialize: false,
      missing_methods: { registry: registryMissing, abstract_account: aaMissing },
      reason: "live contracts do not expose the reciprocal shared-AA configuration ABI",
    };
  }

  if (!isZero(currentRegistrar) && currentRegistrar !== registry) {
    return conflict("aa_registrar_conflict", "AA core is controlled by a different platform registrar");
  }
  if (!isZero(pendingRegistrar) && pendingRegistrar !== registry) {
    return conflict("aa_pending_registrar_conflict", "AA core has a pending registrar for another contract");
  }
  if (!isZero(currentCore) && currentCore !== aa) {
    return conflict("registry_core_conflict", "Registry points to a different abstract-account core");
  }
  if (!isZero(pendingCore) && pendingCore !== aa) {
    return conflict("registry_pending_core_conflict", "Registry has a pending abstract-account core for another contract");
  }

  if (currentRegistrar !== registry) {
    if (pendingRegistrar === registry) {
      const ready = Number(chainTimeMs) >= Number(aaRegistrarAvailableAt);
      return {
        phase: ready ? "confirm_aa_registrar" : "wait_aa_registrar_timelock",
        next_action: ready ? "confirmPlatformRegistrar" : "wait",
        safe_to_materialize: false,
        available_at_ms: Number(aaRegistrarAvailableAt),
        reason: "Registry core must remain disabled until AA authorizes Registry as registrar",
      };
    }
    return {
      phase: "propose_aa_registrar",
      next_action: "proposePlatformRegistrar",
      safe_to_materialize: false,
      reason: "AA registrar authorization is the first configuration step",
    };
  }

  if (currentCore !== aa) {
    if (pendingCore === aa) {
      const ready = Number(chainTimeMs) >= Number(registryCoreAvailableAt);
      return {
        phase: ready ? "set_registry_core" : "wait_registry_core_timelock",
        next_action: ready ? "setAbstractAccountCore" : "wait",
        safe_to_materialize: false,
        available_at_ms: Number(registryCoreAvailableAt),
        reason: "AA registrar is active; Registry core activation remains timelocked",
      };
    }
    return {
      phase: "propose_registry_core",
      next_action: "proposeAbstractAccountCore",
      safe_to_materialize: false,
      reason: "AA already authorizes Registry, so Registry may now propose the AA core",
    };
  }

  return {
    phase: "ready_to_materialize_dry_run",
    next_action: "run_77_app_materialize_abstract_accounts_dry_run",
    safe_to_materialize: true,
    reason: "Registry and AA core are reciprocally configured",
  };
}

function hash160StackValue(invocation, method) {
  if (invocation?.state !== "HALT") {
    throw new Error(`${method} did not HALT: ${invocation?.exception || invocation?.state || "unknown"}`);
  }
  const item = invocation.stack?.[0];
  if (!["ByteString", "Buffer"].includes(item?.type) || !item.value) {
    throw new Error(`${method} did not return Hash160 bytes`);
  }
  const bytes = Buffer.from(item.value, "base64");
  if (bytes.length !== 20) throw new Error(`${method} returned ${bytes.length} bytes`);
  return `0x${Buffer.from(bytes).reverse().toString("hex")}`;
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

async function invokeRead(rpcUrl, contractHash, method, decode, rpcCall) {
  const invocation = await rpcCall(rpcUrl, "invokefunction", [contractHash, method, []]);
  return decode(invocation, method);
}

async function simulateLegacyAaUpdate({ rpcUrl, aaHash, signer, aaRoot, rpcCall }) {
  const nef = fs.readFileSync(path.join(aaRoot, "contracts/bin/v3/UnifiedSmartWalletV3.nef"));
  const manifest = fs.readFileSync(
    path.join(aaRoot, "contracts/bin/v3/UnifiedSmartWalletV3.manifest.json"),
    "utf8",
  );
  const invocation = await rpcCall(rpcUrl, "invokefunction", [
    aaHash,
    "update",
    [
      { type: "ByteArray", value: nef.toString("base64") },
      { type: "String", value: manifest },
    ],
    [{ account: signer, scopes: "Global" }],
  ]);
  return {
    method: "update",
    route: "legacy_direct",
    signer_hash: signer,
    signer_input: "public-hash-simulation",
    state: invocation.state,
    gas_consumed_datoshi: Number(invocation.gasconsumed ?? 0),
    exception: invocation.exception || "",
    transaction: null,
  };
}

function artifactEvidence(aaRoot) {
  const artifacts = {
    registry: {
      nef: path.join(contractsRoot, "contracts/build/PlatformRegistry.nef"),
      manifest: path.join(contractsRoot, "contracts/build/PlatformRegistry.manifest.json"),
    },
    abstract_account: {
      nef: path.join(aaRoot, "contracts/bin/v3/UnifiedSmartWalletV3.nef"),
      manifest: path.join(aaRoot, "contracts/bin/v3/UnifiedSmartWalletV3.manifest.json"),
    },
  };
  return Object.fromEntries(Object.entries(artifacts).map(([name, files]) => {
    const nef = fs.readFileSync(files.nef);
    const manifest = fs.readFileSync(files.manifest);
    const parsed = JSON.parse(manifest.toString("utf8"));
    return [name, {
      nef_path: `neo-os-contracts/${path.relative(contractsRoot, files.nef)}`,
      manifest_path: `neo-os-contracts/${path.relative(contractsRoot, files.manifest)}`,
      nef_sha256: `0x${crypto.createHash("sha256").update(nef).digest("hex")}`,
      manifest_sha256: `0x${crypto.createHash("sha256").update(manifest).digest("hex")}`,
      methods: [...new Set((parsed.abi?.methods ?? []).map((method) => method.name))].sort(),
    }];
  }));
}

function gitOutput(aaRoot, args, encoding = "utf8") {
  return execFileSync("git", ["-C", aaRoot, ...args], { encoding });
}

function nefChecksum(nef) {
  return nef.readUInt32LE(nef.length - 4);
}

function aaUpgradeCompatibility({ aaRoot, liveManifest, liveNefChecksum }) {
  const baselineRevision = gitOutput(aaRoot, [
    "log", "-1", "--format=%H", "--", "contracts/build/UnifiedSmartWalletV3.nef",
  ]).trim();
  const baselineManifest = JSON.parse(gitOutput(aaRoot, [
    "show", `${baselineRevision}:contracts/build/UnifiedSmartWalletV3.manifest.json`,
  ]));
  const baselineNef = gitOutput(aaRoot, [
    "show", `${baselineRevision}:contracts/build/UnifiedSmartWalletV3.nef`,
  ], null);
  const candidateManifest = JSON.parse(fs.readFileSync(
    path.join(aaRoot, "contracts/bin/v3/UnifiedSmartWalletV3.manifest.json"),
    "utf8",
  ));
  const sourcePaths = gitOutput(aaRoot, [
    "ls-tree", "-r", "--name-only", baselineRevision, "--", "contracts",
  ]).split("\n").filter((sourcePath) => /^contracts\/UnifiedSmartWallet(?:\..+)?\.cs$/.test(sourcePath));
  const baselineSources = sourcePaths.map((sourcePath) => gitOutput(aaRoot, [
    "show", `${baselineRevision}:${sourcePath}`,
  ]));
  const contractsDir = path.join(aaRoot, "contracts");
  const candidateSources = fs.readdirSync(contractsDir)
    .filter((name) => /^UnifiedSmartWallet(?:\..+)?\.cs$/.test(name))
    .map((name) => fs.readFileSync(path.join(contractsDir, name), "utf8"));
  const manifestComparison = compareAaManifests({ liveManifest, baselineManifest, candidateManifest });
  const storageComparison = compareAaStorageSources({ baselineSources, candidateSources });
  const baselineChecksum = nefChecksum(baselineNef);
  const exactLiveSourceRevisionKnown = baselineChecksum === Number(liveNefChecksum);
  const storageCompatible = storageComparison.unmigrated_existing_prefixes.length === 0 &&
    storageComparison.stored_record_layouts_changed.length === 0;
  const compatible = manifestComparison.semantic_baseline_matches_live && storageCompatible;

  return {
    compatibility: compatible ? "conditional" : "unproven",
    source_provenance: exactLiveSourceRevisionKnown ? "exact_binary" : "semantic_proxy_only",
    exact_live_source_revision_known: exactLiveSourceRevisionKnown,
    semantic_baseline_revision: baselineRevision,
    live_nef_checksum: Number(liveNefChecksum),
    semantic_baseline_nef_checksum: baselineChecksum,
    ...manifestComparison,
    storage: storageComparison,
    boundary: exactLiveSourceRevisionKnown
      ? "The tracked baseline NEF checksum matches the live contract."
      : "The tracked historical manifest is a semantic proxy for the live ABI, not exact deployed-source provenance; compatibility remains conditional on the recorded ABI and storage invariants.",
  };
}

export async function buildLivePreflight({
  env = process.env,
  rpcCall = fetchJsonRpc,
  aaRoot = env.NEO_ABSTRACT_ACCOUNT_ROOT || defaultAaRoot,
} = {}) {
  const registryHash = loadPlatformTargets().find((target) => target.name === "PlatformRegistry").hash;
  const aaHash = normalizeHash(env.AA_TESTNET_CORE_HASH || defaultAaTestnetHash, "AA_TESTNET_CORE_HASH");
  const selected = await selectTestnetRpc(defaultRpcCandidates(env), rpcCall);
  const [registryState, aaState, blockCount] = await Promise.all([
    rpcCall(selected.rpcUrl, "getcontractstate", [registryHash]),
    rpcCall(selected.rpcUrl, "getcontractstate", [aaHash]),
    rpcCall(selected.rpcUrl, "getblockcount", []),
  ]);
  const latestBlock = await rpcCall(selected.rpcUrl, "getblock", [Number(blockCount) - 1, 1]);
  const registryMethods = (registryState.manifest?.abi?.methods ?? []).map((method) => method.name);
  const aaMethods = (aaState.manifest?.abi?.methods ?? []).map((method) => method.name);
  const aaUpgradeRoute = classifyAaUpgradeRoute(aaMethods);
  const aaCompatibility = aaUpgradeCompatibility({
    aaRoot,
    liveManifest: aaState.manifest,
    liveNefChecksum: aaState.nef?.checksum,
  });
  const registryHasState = [
    "abstractAccountCore",
    "pendingAbstractAccountCore",
    "abstractAccountCoreAvailableAt",
  ].every((method) => registryMethods.includes(method));
  const aaHasState = [
    "getPlatformRegistrar",
    "getPendingPlatformRegistrar",
    "getPlatformRegistrarAvailableAt",
  ].every((method) => aaMethods.includes(method));
  const registryValues = registryHasState ? {
    registryCore: await invokeRead(selected.rpcUrl, registryHash, "abstractAccountCore", hash160StackValue, rpcCall),
    registryPendingCore: await invokeRead(selected.rpcUrl, registryHash, "pendingAbstractAccountCore", hash160StackValue, rpcCall),
    registryCoreAvailableAt: await invokeRead(selected.rpcUrl, registryHash, "abstractAccountCoreAvailableAt", integerStackValue, rpcCall),
  } : {};
  const aaValues = aaHasState ? {
    aaRegistrar: await invokeRead(selected.rpcUrl, aaHash, "getPlatformRegistrar", hash160StackValue, rpcCall),
    aaPendingRegistrar: await invokeRead(selected.rpcUrl, aaHash, "getPendingPlatformRegistrar", hash160StackValue, rpcCall),
    aaRegistrarAvailableAt: await invokeRead(selected.rpcUrl, aaHash, "getPlatformRegistrarAvailableAt", integerStackValue, rpcCall),
  } : {};
  const aaAdmin = aaMethods.includes("getContractAdmin")
    ? await invokeRead(selected.rpcUrl, aaHash, "getContractAdmin", hash160StackValue, rpcCall)
    : null;
  const aaUpdateSimulation = aaUpgradeRoute === "legacy_direct" && aaAdmin
    ? await simulateLegacyAaUpdate({
      rpcUrl: selected.rpcUrl,
      aaHash,
      signer: aaAdmin,
      aaRoot,
      rpcCall,
    })
    : null;
  const aaUnauthorizedUpdateSimulation = aaUpgradeRoute === "legacy_direct" && aaAdmin
    ? await simulateLegacyAaUpdate({
      rpcUrl: selected.rpcUrl,
      aaHash,
      signer: registryHash,
      aaRoot,
      rpcCall,
    })
    : null;
  const chainTimeMs = Number(latestBlock.time);
  let evaluation = evaluateSharedAaUpgradeState({
    registryHash,
    aaHash,
    registryMethods,
    aaMethods,
    chainTimeMs,
    ...registryValues,
    ...aaValues,
  });
  const aaUpgradeControlVerified = aaUpgradeRoute !== "legacy_direct" || (
    aaUpdateSimulation?.state === "HALT" &&
    aaUnauthorizedUpdateSimulation?.state === "FAULT"
  );
  if (!aaUpgradeControlVerified) {
    evaluation = conflict(
      "aa_upgrade_control_failure",
      "legacy AA update did not preserve the expected admin-only control boundary",
    );
  } else if (aaCompatibility.compatibility === "unproven") {
    evaluation = conflict(
      "aa_upgrade_compatibility_unproven",
      "AA upgrade compatibility could not be established from the semantic ABI and storage invariants",
    );
  }
  return {
    generated_at_utc: new Date().toISOString(),
    network: { rpc_url: selected.rpcUrl, magic: selected.networkMagic, chain_time_ms: chainTimeMs },
    contracts: {
      registry: { hash: registryHash, contract_id: registryState.id, methods: registryMethods.sort(), ...registryValues },
      abstract_account: {
        hash: aaHash,
        contract_id: aaState.id,
        update_counter: aaState.updatecounter,
        nef_checksum: Number(aaState.nef?.checksum),
        methods: aaMethods.sort(),
        admin: aaAdmin,
        ...aaValues,
      },
    },
    local_artifacts: artifactEvidence(aaRoot),
    aa_upgrade: {
      route: aaUpgradeRoute,
      exact_artifact_simulation: aaUpdateSimulation,
      unauthorized_simulation: aaUnauthorizedUpdateSimulation,
      admin_control_verified: aaUpgradeControlVerified,
      compatibility: aaCompatibility,
      boundary: aaUpgradeRoute === "legacy_direct"
        ? "The current live AA core has no proposeUpdate method. Its one-time bootstrap to the local artifact is a direct admin update; the local artifact makes subsequent upgrades seven-day timelocked."
        : "AA upgrade governance is not a legacy direct route.",
    },
    evaluation,
    required_order: [
      "review and execute the current AA governance route, then verify the exact on-chain ABI/checksum",
      "upgrade PlatformRegistry with abstractAccountCore still disabled",
      "propose then confirm PlatformRegistry as AA platform registrar",
      "propose then set UnifiedSmartWallet as Registry abstract-account core",
      "run the 77-app materialization dry-run and verify uniqueness/reverse indexes",
      "broadcast materialization only under a separately reviewed write authorization",
    ],
    rollback: {
      before_activation: "cancel either pending registrar/core proposal",
      after_activation: "propose zero Registry core, wait 24 hours, then set it; existing identities remain indexed",
      aa_registrar: "do not rotate away from Registry until Registry core is disabled",
    },
    chain_writes_performed: false,
  };
}

function writeReport(report) {
  const jsonPath = path.join(repoRoot, "docs/reports/shared-aa-upgrade-preflight-latest.json");
  const markdownPath = path.join(repoRoot, "docs/reports/shared-aa-upgrade-preflight-latest.md");
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  const lines = [
    "# Shared AA Upgrade Preflight",
    "",
    `Generated: ${report.generated_at_utc}`,
    "",
    `Phase: **${report.evaluation.phase}**`,
    `Safe to materialize: **${report.evaluation.safe_to_materialize ? "YES" : "NO"}**`,
    `Next action: \`${report.evaluation.next_action}\``,
    "",
    `Reason: ${report.evaluation.reason}`,
    "",
    "## AA Upgrade Governance",
    "",
    `- Live route: \`${report.aa_upgrade.route}\`.`,
    `- Boundary: ${report.aa_upgrade.boundary}`,
    `- Exact local-artifact simulation: \`${report.aa_upgrade.exact_artifact_simulation?.state ?? "not available"}\`; no transaction was created.`,
    `- Non-admin control simulation: \`${report.aa_upgrade.unauthorized_simulation?.state ?? "not available"}\` (must remain FAULT).`,
    `- Upgrade compatibility: \`${report.aa_upgrade.compatibility.compatibility}\`.`,
    `- Exact live source revision known: **${report.aa_upgrade.compatibility.exact_live_source_revision_known ? "YES" : "NO"}**.`,
    `- Candidate ABI removals: ${report.aa_upgrade.compatibility.candidate_abi_delta.removed_methods.map((method) => `\`${method}\``).join(", ") || "none"}.`,
    `- Changed existing storage prefixes: ${report.aa_upgrade.compatibility.storage.existing_prefixes_changed.length}.`,
    `- Legacy prefix migrations with read/cleanup proof: ${report.aa_upgrade.compatibility.storage.legacy_prefix_migrations.length}.`,
    `- Unmigrated existing storage prefixes: ${report.aa_upgrade.compatibility.storage.unmigrated_existing_prefixes.length}.`,
    `- Changed stored-record layouts: ${report.aa_upgrade.compatibility.storage.stored_record_layouts_changed.length}.`,
    `- Provenance boundary: ${report.aa_upgrade.compatibility.boundary}`,
    "",
    "## Required Order",
    "",
    ...report.required_order.map((step, index) => `${index + 1}. ${step}`),
    "",
    "## Rollback Boundary",
    "",
    `- Before activation: ${report.rollback.before_activation}.`,
    `- After activation: ${report.rollback.after_activation}.`,
    `- Registrar rotation: ${report.rollback.aa_registrar}.`,
    "- This preflight made no chain writes and is not authorization to sign or broadcast.",
  ];
  fs.writeFileSync(markdownPath, `${lines.join("\n")}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const report = await buildLivePreflight();
  writeReport(report);
  console.log(`Shared AA preflight: ${report.evaluation.phase}`);
}

/**
 * MiniApp Logic Integrity — read-only integration tests.
 *
 * Verifies that every bundled MiniApp exposes host operations which map to
 * real deployed Neo N3 testnet ABI methods, that declared MiniApp logic
 * dependencies/state sources are resolvable, and that known Oracle consumers
 * are wired to the canonical Morpheus Oracle contract.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  ROOT,
  ORACLE_HASH,
  getContractState,
  invokeRead,
  isHalt,
  stackHash160,
} from "./helpers.mjs";

const APPS_DIR = path.join(ROOT, "apps");
const DEFINITIONS_DIR = path.join(
  ROOT,
  "platform",
  "host-app",
  "public",
  "miniapp-definitions",
);

const NEO_TESTNET_KEY = "neo-n3-testnet";
const UINT160_ZERO = "0x" + "00".repeat(20);

const OPERATION_TYPE_TO_ABI = new Map([
  ["integer", "Integer"],
  ["amount", "Integer"],
  ["hash160", "Hash160"],
  ["hash256", "Hash256"],
  ["boolean", "Boolean"],
  ["address", "String"],
  ["string", "String"],
]);

// These apps make live use of Morpheus Oracle-backed randomness/data feeds.
// They must not silently drift to UInt160.Zero or another Oracle hash.
const KNOWN_ORACLE_CONSUMERS = [
  "fogplay",
  "gasbox",
  "red-envelope",
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function listMiniAppSlugs() {
  return fs
    .readdirSync(APPS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((slug) => fs.existsSync(path.join(APPS_DIR, slug, "neo-manifest.json")))
    .sort();
}

function readManifest(slug) {
  return readJson(path.join(APPS_DIR, slug, "neo-manifest.json"));
}

function readDefinition(slug) {
  const filePath = path.join(DEFINITIONS_DIR, `${slug}.json`);
  return fs.existsSync(filePath) ? readJson(filePath) : null;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}

function extractHostOperations(definition, manifest) {
  const frontendSpec = definition?.frontend_spec || manifest?.frontend_spec || {};
  const detailTemplate = definition?.detail_template || manifest?.detail_template || {};

  const candidates = [
    definition?.operations,
    definition?.operation_schema,
    frontendSpec.operations,
    frontendSpec.operation_schema,
    manifest?.operations,
    manifest?.operation_schema,
    frontendSpec.operation_panel?.operations,
    definition?.operation_panel?.operations,
    detailTemplate.operation_panel?.operations,
  ];

  for (const candidate of candidates) {
    const operations = asArray(candidate).filter((operation) => operation?.method);
    if (operations.length > 0) return operations;
  }
  return [];
}

function contractComposition(definition, manifest) {
  return asObject(
    definition?.contract_composition ||
      definition?.manifest?.contract_composition ||
      manifest?.contract_composition,
  );
}

function sharedOperationRecipes(definition, manifest) {
  const frontendComposition = asObject(
    definition?.frontend_composition ||
      definition?.manifest?.frontend_composition ||
      manifest?.frontend_composition,
  );
  return asArray(frontendComposition.operation_recipes).filter(
    (recipe) => recipe?.operation && recipe?.binding && recipe?.method,
  );
}

function expectedAbiParamTypes(operation) {
  return asArray(operation.params).map((param) => {
    const type = String(param?.type || "string").trim().toLowerCase();
    return OPERATION_TYPE_TO_ABI.get(type) || "String";
  });
}

function methodSignatures(contractState) {
  return asArray(contractState?.manifest?.abi?.methods).map((method) => ({
    name: String(method?.name || ""),
    params: asArray(method?.parameters).map((param) => String(param?.type || "")),
  }));
}

function hasMatchingSignature(methods, operation) {
  const expectedTypes = expectedAbiParamTypes(operation);
  return methods.some(
    (method) =>
      method.name === operation.method &&
      method.params.length === expectedTypes.length &&
      method.params.every((type, index) => type === expectedTypes[index]),
  );
}

function declaredLogicDependencies(definition, manifest) {
  return [
    ...asArray(definition?.logic?.depends_on),
    ...asArray(manifest?.logic?.depends_on),
  ].filter(Boolean);
}

function declaredStateSource(definition, manifest) {
  return definition?.stateSource || manifest?.stateSource || null;
}

test("every bundled MiniApp operation maps to a deployed testnet ABI method", async () => {
  const failures = [];
  const stateCache = new Map();
  let checkedOperations = 0;

  for (const slug of listMiniAppSlugs()) {
    const manifest = readManifest(slug);
    const definition = readDefinition(slug);
    const operations = extractHostOperations(definition, manifest);
    if (operations.length === 0) continue;

    const contractHash = String(manifest.contracts?.[NEO_TESTNET_KEY] || "").trim();
    if (!contractHash) {
      const composition = contractComposition(definition, manifest);
      if (String(composition.mode || "").toLowerCase() === "shared") {
        const recipes = sharedOperationRecipes(definition, manifest);
        for (const operation of operations) {
          checkedOperations++;
          if (!recipes.some((recipe) => recipe.operation === operation.method)) {
            failures.push(`${slug}.${operation.method} has no shared runtime operation recipe`);
          }
        }
        continue;
      }
      failures.push(`${slug}: exposes ${operations.length} operation(s) but has no ${NEO_TESTNET_KEY} contract hash`);
      continue;
    }

    if (!stateCache.has(contractHash)) {
      stateCache.set(contractHash, await getContractState(contractHash));
    }
    const methods = methodSignatures(stateCache.get(contractHash));

    for (const operation of operations) {
      checkedOperations++;
      if (!hasMatchingSignature(methods, operation)) {
        failures.push(
          `${slug}.${operation.method}(${expectedAbiParamTypes(operation).join(",")}) is not present in ${contractHash}`,
        );
      }
    }
  }

  assert.ok(checkedOperations > 0, "expected to check at least one host operation");
  assert.equal(failures.length, 0, failures.join("\n"));
});

test("MiniApp logic dependencies and external state sources are internally resolvable", () => {
  const slugs = listMiniAppSlugs();
  const appIds = new Set(slugs.map((slug) => readManifest(slug).id));
  const failures = [];

  for (const slug of slugs) {
    const manifest = readManifest(slug);
    const definition = readDefinition(slug);

    for (const dependency of declaredLogicDependencies(definition, manifest)) {
      if (!appIds.has(dependency)) {
        failures.push(`${slug}: logic.depends_on references unknown MiniApp ${dependency}`);
      }
    }

    const stateSource = declaredStateSource(definition, manifest);
    if (stateSource) {
      const chain = String(stateSource.chain || "").trim();
      const supported = asArray(manifest.supported_networks);
      if (chain && supported.length > 0 && !supported.includes(chain)) {
        failures.push(`${slug}: stateSource.chain ${chain} is not in supported_networks`);
      }
      for (const endpoint of asArray(stateSource.endpoints)) {
        if (!/^https:\/\//i.test(String(endpoint))) {
          failures.push(`${slug}: stateSource endpoint must be https: ${endpoint}`);
        }
      }
    }
  }

  assert.equal(failures.length, 0, failures.join("\n"));
});

test("known Oracle-consuming MiniApps are wired to the canonical Morpheus Oracle", async () => {
  assert.match(ORACLE_HASH, /^0x[0-9a-f]{40}$/i, "canonical testnet Oracle hash must be configured");

  const failures = [];
  for (const slug of KNOWN_ORACLE_CONSUMERS) {
    const manifest = readManifest(slug);
    const contractHash = String(manifest.contracts?.[NEO_TESTNET_KEY] || "").trim();
    assert.ok(contractHash, `${slug} must have a testnet contract hash`);

    const result = await invokeRead(contractHash, "oracle");
    if (!isHalt(result)) {
      failures.push(`${slug}: oracle() returned ${result.state}: ${result.exception || "no exception"}`);
      continue;
    }

    const configuredOracle = stackHash160(result.stack?.[0]);
    if (!configuredOracle || configuredOracle === UINT160_ZERO) {
      failures.push(`${slug}: oracle() returned an empty Oracle hash`);
      continue;
    }
    if (configuredOracle.toLowerCase() !== ORACLE_HASH.toLowerCase()) {
      failures.push(`${slug}: oracle()=${configuredOracle}, expected ${ORACLE_HASH}`);
    }
  }

  assert.equal(failures.length, 0, failures.join("\n"));
});

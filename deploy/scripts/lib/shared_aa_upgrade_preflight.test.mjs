import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyAaUpgradeRoute,
  compareAaManifests,
  compareAaStorageSources,
  evaluateSharedAaUpgradeState,
  requiredAaMethods,
  requiredRegistryMethods,
} from "../audit_shared_aa_upgrade_preflight.mjs";

const registryHash = "0x1111111111111111111111111111111111111111";
const aaHash = "0x2222222222222222222222222222222222222222";
const zeroHash = "0x0000000000000000000000000000000000000000";

function evaluate(overrides = {}) {
  return evaluateSharedAaUpgradeState({
    registryHash,
    aaHash,
    registryMethods: requiredRegistryMethods,
    aaMethods: requiredAaMethods,
    registryCore: zeroHash,
    registryPendingCore: zeroHash,
    aaRegistrar: zeroHash,
    aaPendingRegistrar: zeroHash,
    chainTimeMs: 1_000,
    ...overrides,
  });
}

test("missing live ABI requires upgrades before configuration", () => {
  const result = evaluate({ registryMethods: [], aaMethods: [] });
  assert.equal(result.phase, "upgrade_contracts");
  assert.equal(result.safe_to_materialize, false);
  assert.deepEqual(result.missing_methods.registry, requiredRegistryMethods);
  assert.deepEqual(result.missing_methods.abstract_account, requiredAaMethods);
});

test("AA upgrade governance distinguishes legacy direct and timelocked routes", () => {
  assert.equal(classifyAaUpgradeRoute(["update"]), "legacy_direct");
  assert.equal(classifyAaUpgradeRoute(["proposeUpdate", "update"]), "timelocked");
  assert.equal(classifyAaUpgradeRoute([]), "unavailable");
});

test("AA compatibility audit separates semantic ABI and storage deltas", () => {
  const method = (name) => ({ name, parameters: [], returntype: "Void", safe: false });
  const liveManifest = {
    abi: { methods: [method("update"), method("transferAdmin")], events: [] },
    permissions: [{ contract: "*", methods: "*" }],
    trusts: [],
  };
  const baselineManifest = JSON.parse(JSON.stringify(liveManifest));
  const candidateManifest = {
    ...liveManifest,
    abi: { methods: [method("update"), method("proposeUpdate")], events: [] },
  };
  const manifests = compareAaManifests({ liveManifest, baselineManifest, candidateManifest });
  assert.equal(manifests.semantic_baseline_matches_live, true);
  assert.deepEqual(manifests.candidate_abi_delta.removed_methods, ["transferAdmin():Void:write"]);
  assert.deepEqual(manifests.candidate_abi_delta.added_methods, ["proposeUpdate():Void:write"]);

  const storage = compareAaStorageSources({
    baselineSources: [
      "private static readonly byte[] Prefix_State = new byte[] { 0x01 }; public class State { public UInt160 Owner; }",
    ],
    candidateSources: [
      "private static readonly byte[] Prefix_State = new byte[] { 0x01 }; private static readonly byte[] Prefix_New = new byte[] { 0x02 }; public class State { public UInt160 Owner; }",
    ],
  });
  assert.deepEqual(storage.existing_prefixes_changed, []);
  assert.deepEqual(storage.added_prefixes, [{ name: "Prefix_New", value: "0x02" }]);
  assert.deepEqual(storage.stored_record_layouts_changed, []);
});

test("AA registrar must be configured before Registry core", () => {
  assert.equal(evaluate().phase, "propose_aa_registrar");
  assert.equal(evaluate({
    aaPendingRegistrar: registryHash,
    aaRegistrarAvailableAt: 2_000,
  }).phase, "wait_aa_registrar_timelock");
  assert.equal(evaluate({
    aaPendingRegistrar: registryHash,
    aaRegistrarAvailableAt: 900,
  }).phase, "confirm_aa_registrar");
});

test("Registry core activation follows active AA registrar", () => {
  assert.equal(evaluate({ aaRegistrar: registryHash }).phase, "propose_registry_core");
  assert.equal(evaluate({
    aaRegistrar: registryHash,
    registryPendingCore: aaHash,
    registryCoreAvailableAt: 2_000,
  }).phase, "wait_registry_core_timelock");
  assert.equal(evaluate({
    aaRegistrar: registryHash,
    registryPendingCore: aaHash,
    registryCoreAvailableAt: 900,
  }).phase, "set_registry_core");
});

test("materialization is safe only after reciprocal configuration", () => {
  const result = evaluate({ aaRegistrar: registryHash, registryCore: aaHash });
  assert.equal(result.phase, "ready_to_materialize_dry_run");
  assert.equal(result.safe_to_materialize, true);
});

test("conflicting live configuration fails closed", () => {
  const other = "0x3333333333333333333333333333333333333333";
  assert.equal(evaluate({ aaRegistrar: other }).phase, "aa_registrar_conflict");
  assert.equal(evaluate({ aaPendingRegistrar: other }).phase, "aa_pending_registrar_conflict");
  assert.equal(evaluate({ registryCore: other }).phase, "registry_core_conflict");
  assert.equal(evaluate({ registryPendingCore: other }).phase, "registry_pending_core_conflict");
});

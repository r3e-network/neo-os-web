import test from "node:test";
import assert from "node:assert/strict";
import { validateJointAbstractAccountInterface } from "../audit_joint_abstract_account_interface.mjs";

function method(name, parameters, returntype, safe) {
  return {
    name,
    parameters: parameters.map((type, index) => ({ name: `arg${index}`, type })),
    returntype,
    safe,
  };
}

test("joint AA validator accepts the exact registrar ABI and security gates", () => {
  const registryManifest = {
    abi: { methods: [
      method("proposeAbstractAccountCore", ["Hash160"], "Void", false),
      method("setAbstractAccountCore", [], "Void", false),
      method("cancelAbstractAccountCore", [], "Void", false),
      method("abstractAccountCore", [], "Hash160", true),
      method("pendingAbstractAccountCore", [], "Hash160", true),
      method("abstractAccountCoreAvailableAt", [], "Integer", true),
      method("materializeAbstractAccount", ["String"], "Hash160", false),
      method("getAppAbstractAccount", ["String"], "Array", true),
      method("appIdOfAbstractAccount", ["Hash160", "Hash160"], "String", true),
    ] },
    permissions: [{
      contract: "*",
      methods: [
        "computePlatformAccountId",
        "registerPlatformAccount",
        "computeStablePlatformAccountId",
        "registerStablePlatformAccount",
        "rotatePlatformAccountOwner",
      ],
    }],
  };
  const aaManifest = {
    abi: { methods: [
      method("computePlatformAccountId", ["ByteArray", "Hash160", "Integer"], "Hash160", true),
      method("computeStablePlatformAccountId", ["ByteArray", "Integer"], "Hash160", true),
      method("registerPlatformAccount", ["Hash160", "ByteArray", "Hash160", "Integer"], "Void", false),
      method("registerStablePlatformAccount", ["Hash160", "ByteArray", "Hash160", "Integer"], "Void", false),
      method("rotatePlatformAccountOwner", ["Hash160", "ByteArray", "Hash160"], "Void", false),
      method("proposePlatformRegistrar", ["Hash160"], "Void", false),
      method("confirmPlatformRegistrar", [], "Void", false),
      method("cancelPlatformRegistrar", [], "Void", false),
      method("getPlatformRegistrar", [], "Hash160", true),
      method("getPendingPlatformRegistrar", [], "Hash160", true),
      method("getPlatformRegistrarAvailableAt", [], "Integer", true),
      method("updateVerifier", ["Hash160", "Hash160", "ByteArray"], "Void", false),
    ] },
  };
  const result = validateJointAbstractAccountInterface({
    registryManifest,
    aaManifest,
    registrySource: "Runtime.ExecutingScriptHash appId EnsureAbstractAccount(appId, appAdmin) if (core != UInt160.Zero) Storage.Delete(Storage.CurrentContext, PREFIX_ABSTRACT_ACCOUNT_CORE) TIMELOCK_DELAY_MS",
    aaSource: "Runtime.CallingScriptHash == registrar MinUpgradeDelayMs Platform registrar timelock not expired RegisterAccountCore( backupOwner false Prefix_PlatformAccountBinding RotatePlatformAccountOwner AssertNoMarketEscrow(accountId)",
  });
  assert.equal(result.passed, true);
});

test("joint AA validator fails closed on an unsafe registrar ABI", () => {
  const result = validateJointAbstractAccountInterface({
    registryManifest: { abi: { methods: [] }, permissions: [] },
    aaManifest: { abi: { methods: [] } },
    registrySource: "",
    aaSource: "",
  });
  assert.equal(result.passed, false);
  assert.equal(result.checks.aa_registrar_calling_contract_gate, false);
  assert.equal(result.checks.registry_abi_exact, false);
});

test("joint AA validator requires stable platform account methods", () => {
  const aaManifest = {
    abi: { methods: [
      method("computePlatformAccountId", ["ByteArray", "Hash160", "Integer"], "Hash160", true),
      method("registerPlatformAccount", ["Hash160", "ByteArray", "Hash160", "Integer"], "Void", false),
      method("rotatePlatformAccountOwner", ["Hash160", "ByteArray", "Hash160"], "Void", false),
      method("proposePlatformRegistrar", ["Hash160"], "Void", false),
      method("confirmPlatformRegistrar", [], "Void", false),
      method("cancelPlatformRegistrar", [], "Void", false),
      method("getPlatformRegistrar", [], "Hash160", true),
      method("getPendingPlatformRegistrar", [], "Hash160", true),
      method("getPlatformRegistrarAvailableAt", [], "Integer", true),
      method("updateVerifier", ["Hash160", "Hash160", "ByteArray"], "Void", false),
    ] },
  };
  const result = validateJointAbstractAccountInterface({
    registryManifest: {
      abi: { methods: [] },
      permissions: [{
        contract: "*",
        methods: [
          "computePlatformAccountId",
          "registerPlatformAccount",
          "rotatePlatformAccountOwner",
        ],
      }],
    },
    aaManifest,
    registrySource: "",
    aaSource: "",
  });
  assert.equal(result.passed, false);
  assert.equal(result.checks.aa_abi_exact, false);
  assert.equal(result.checks.registry_least_privilege_calls, false);
});

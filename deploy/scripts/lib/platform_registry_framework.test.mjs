import assert from "node:assert/strict";
import test from "node:test";
import { evaluatePlatformRegistryFramework } from "../audit_platform_registry_framework.mjs";

const method = (name) => ({ name });
const wiring = {
  typesSource: "registry?: FrameworkRegistryConfig; readonly registry: FrameworkRegistrySurface;",
  indexSource: "createRegistrySurface; get registry() {}",
  miniAppRootSource: 'registry?: MiniAppFrameworkOptions["registry"]; registry, platformGame',
};

test("PlatformRegistry framework audit accepts exact tenant ABI and native credit coverage", () => {
  const result = evaluatePlatformRegistryFramework({
    manifest: { abi: { methods: [method("proposeAdmin"), method("getApp"), method("registerApp")] } },
    surfaceSource: 'guardedWrite(WRITE_PLATFORM_REGISTRY); read("getApp", []); invoke("registerApp", []); chain.invoke("transfer", []);',
    consumers: [],
    ...wiring,
  });
  assert.equal(result.passed, true);
  assert.equal(result.tenant_abi_method_count, 2);
  assert.deepEqual(result.native_operations, ["transfer"]);
});

test("PlatformRegistry framework audit fails closed on method or wiring drift", () => {
  const result = evaluatePlatformRegistryFramework({
    manifest: { abi: { methods: [method("getApp")] } },
    surfaceSource: 'read("unexpected", []);',
    consumers: ["unsafe-binding"],
    typesSource: "",
    indexSource: "",
    miniAppRootSource: "",
  });
  assert.equal(result.passed, false);
  assert.deepEqual(result.missing_methods, ["getApp"]);
  assert.deepEqual(result.extra_methods, ["unexpected"]);
  assert.equal(result.configured_consumer_count, 1);
});

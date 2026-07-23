import assert from "node:assert/strict";
import test from "node:test";
import { evaluatePlatformDeFiFramework } from "../audit_platform_defi_framework.mjs";

const method = (name) => ({ name });
const wiring = {
  typesSource: "platformDeFi?: FrameworkPlatformDeFiConfig; readonly platformDeFi: FrameworkPlatformDeFiSurface;",
  indexSource: "createPlatformDeFiSurface; get platformDeFi() {}",
  defineMiniAppSource: "platformDeFiConfigFromManifest; platformDeFi={resolvedPlatformDeFi}",
};

test("PlatformDeFi framework audit accepts exact tenant ABI and native deposit coverage", () => {
  const result = evaluatePlatformDeFiFramework({
    manifest: { abi: { methods: [method("admin"), method("getLoan"), method("repayLoan")] } },
    surfaceSource: 'WRITE_PLATFORM_DEFI; read("getLoan", []); invoke("repayLoan", []); deps.chain.invoke("transfer", []);',
    bindings: [],
    ...wiring,
  });
  assert.equal(result.passed, true);
  assert.equal(result.tenant_abi_method_count, 2);
  assert.deepEqual(result.native_operations, ["transfer"]);
});

test("PlatformDeFi framework audit fails closed on missing and extra operations", () => {
  const result = evaluatePlatformDeFiFramework({
    manifest: { abi: { methods: [method("getLoan")] } },
    surfaceSource: 'invoke("unexpected", []); deps.chain.invoke("transfer", []);',
    bindings: ["unsafe-cutover"],
    typesSource: "",
    indexSource: "",
    defineMiniAppSource: "",
  });
  assert.equal(result.passed, false);
  assert.deepEqual(result.missing_methods, ["getLoan"]);
  assert.deepEqual(result.extra_methods, ["unexpected"]);
  assert.equal(result.shared_binding_count, 1);
});

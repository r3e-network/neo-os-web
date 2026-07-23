import assert from "node:assert/strict";
import test from "node:test";
import { evaluatePlatformAnchorFramework } from "../audit_platform_anchor_framework.mjs";

const method = (name) => ({ name });
const wiring = {
  typesSource: "platformAnchor?: FrameworkPlatformAnchorConfig; readonly platformAnchor: FrameworkPlatformAnchorSurface;",
  indexSource: "createPlatformAnchorSurface; get platformAnchor() {}",
  defineMiniAppSource: "platformAnchorConfigFromManifest; platformAnchor={resolvedPlatformAnchor}",
  trustRuntimeSource: "app.platformAnchor.stats(); app.platformAnchor.stakeNeo();",
  trustMainSource: "platformAnchor: { anchorHash: getMiniAppContractHash(APP_ID) }",
  profitRuntimeSource: 'export * from "../../trustanchor/src/anchor-runtime"',
  profitMainSource: "platformAnchor: { anchorHash: getMiniAppContractHash(APP_ID) }",
};

test("PlatformAnchor framework audit accepts exact ABI and native-deposit coverage", () => {
  const result = evaluatePlatformAnchorFramework({
    manifest: { abi: { methods: [method("admin"), method("getAnchorStats"), method("withdraw")] } },
    surfaceSource: 'WRITE_PLATFORM_ANCHOR; read("getAnchorStats", []); invoke("withdraw", []); deps.chain.invoke("transfer", []);',
    ...wiring,
  });
  assert.equal(result.passed, true);
  assert.equal(result.tenant_abi_method_count, 2);
  assert.deepEqual(result.native_operations, ["transfer"]);
});

test("PlatformAnchor framework audit fails on direct consumer ABI calls", () => {
  const result = evaluatePlatformAnchorFramework({
    manifest: { abi: { methods: [method("getAnchorStats")] } },
    surfaceSource: 'WRITE_PLATFORM_ANCHOR; read("getAnchorStats", []); deps.chain.invoke("transfer", []);',
    ...wiring,
    trustRuntimeSource: 'app.chain.readRaw("getAnchorStats", []); app.platformAnchor.stakeNeo();',
  });
  assert.equal(result.passed, false);
  assert.equal(result.consumers.trust_runtime_surface, false);
});

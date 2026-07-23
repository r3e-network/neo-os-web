import assert from "node:assert/strict";
import test from "node:test";
import { evaluatePlatformFactoryFramework } from "../audit_platform_factory_framework.mjs";

const method = (name) => ({ name });
const consumers = {
  sharedRuntimeSource: "ctx.framework.platformFactory.executeDeploymentCall",
  miniappSetupSource: "ctx.framework.platformFactory.executeDeploymentCall",
  mainSources: {
    asset: "platformFactory: factoryContractFor",
    nft: "platformFactory: factoryContractFor",
    miniapp: "platformFactory: factoryContractFor",
  },
};

test("MiniAppFactory framework audit accepts exact ABI and consumer routing", () => {
  const result = evaluatePlatformFactoryFramework({
    manifest: { abi: { methods: [method("admin"), method("getTemplate"), method("createMiniAppFromTemplate")] } },
    surfaceSource: 'WRITE_PLATFORM_FACTORY; read(network, "getTemplate", []); invoke(network, "createMiniAppFromTemplate", []);',
    typesSource: "platformFactory?: FrameworkPlatformFactoryConfig; readonly platformFactory: FrameworkPlatformFactorySurface;",
    indexSource: "createPlatformFactorySurface; get platformFactory() {}",
    ...consumers,
  });
  assert.equal(result.passed, true);
  assert.equal(result.tenant_abi_method_count, 2);
});

test("MiniAppFactory framework audit fails on a direct consumer write", () => {
  const result = evaluatePlatformFactoryFramework({
    manifest: { abi: { methods: [method("getTemplate")] } },
    surfaceSource: 'read(network, "getTemplate", []);',
    typesSource: "",
    indexSource: "",
    ...consumers,
    sharedRuntimeSource: "ctx.services.chain.invoke(",
  });
  assert.equal(result.passed, false);
  assert.equal(result.consumers.shared_factory_runtime, false);
});

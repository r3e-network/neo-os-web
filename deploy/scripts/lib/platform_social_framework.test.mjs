import assert from "node:assert/strict";
import test from "node:test";
import { evaluatePlatformSocialFramework } from "../audit_platform_social_framework.mjs";

const method = (name) => ({ name });

test("PlatformSocial framework audit accepts exact ABI coverage and wiring", () => {
  const result = evaluatePlatformSocialFramework({
    manifest: { abi: { methods: [method("admin"), method("createEnvelope"), method("getEnvelope")] } },
    surfaceSource: 'invoke("createEnvelope", []); read("getEnvelope", []); invoke("transfer", []); prepayGasCredit; prepayNeoCredit; `${appId()}:credit`;',
    typesSource: "platformSocial?: FrameworkPlatformSocialConfig; readonly platformSocial: FrameworkPlatformSocialSurface;",
    indexSource: "createPlatformSocialSurface; get platformSocial() {}",
    defineMiniAppSource: 'moduleId !== "platform-social"; platformSocial={resolvedPlatformSocial}',
    timestampProofSource: 'app.platformSocial.available; app.platformSocial.notarize; anchorMethod === "platform-notary"',
  });
  assert.equal(result.passed, true);
  assert.equal(result.user_abi_method_count, 2);
  assert.deepEqual(result.native_operations, ["transfer"]);
});

test("PlatformSocial framework audit fails closed on missing and extra operations", () => {
  const result = evaluatePlatformSocialFramework({
    manifest: { abi: { methods: [method("createEnvelope")] } },
    surfaceSource: 'invoke("unexpected", []);',
    typesSource: "",
    indexSource: "",
    defineMiniAppSource: "",
    timestampProofSource: "",
  });
  assert.equal(result.passed, false);
  assert.deepEqual(result.missing_methods, ["createEnvelope"]);
  assert.deepEqual(result.extra_methods, ["unexpected"]);
});

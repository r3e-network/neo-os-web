import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPlatformEngineBaseReport,
  inspectPlatformEngine,
} from "../audit_platform_engine_base.mjs";

test("PlatformGame reuses the canonical AppKey storage kit", () => {
  const game = inspectPlatformEngine({ id: "PlatformGame", directory: "PlatformGame" });
  assert.equal(game.uses_engine_base, true);
  assert.equal(game.app_key_helpers, 0);
  assert.equal(game.storage_key_strategy, "MiniAppEngineBase");
  assert.equal(game.duplicate_storage_kit, false);
});

test("the conformance report proves the shared platform-engine invariants", () => {
  const report = buildPlatformEngineBaseReport();
  assert.equal(report.summary.engine_count, 6);
  assert.equal(report.summary.base_adopters, 3);
  assert.equal(report.summary.status, "complete");
  assert.deepEqual(report.summary.unresolved, []);
  assert.deepEqual(
    report.engines.filter((engine) => engine.storage_key_strategy === "MiniAppStorageKeys").map((engine) => engine.id),
    ["PlatformSocial", "PlatformDeFi", "PlatformAnchor"],
  );
  assert.deepEqual(report.summary.missing_capabilities, []);
});

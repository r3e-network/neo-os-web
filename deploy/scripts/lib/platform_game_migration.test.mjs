import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPlatformGameMigrationLedger,
  renderPlatformGameMigrationMarkdown,
} from "../audit_platform_game_migration.mjs";

test("PlatformGame ledger separates attachment, binding, and runtime migration", () => {
  const ledger = buildPlatformGameMigrationLedger({
    now: () => new Date("2026-07-23T00:00:00.000Z"),
  });

  assert.equal(ledger.summary.attached_apps, 11);
  assert.equal(ledger.summary.attached_with_shared_binding, 11);
  assert.equal(ledger.summary.attached_using_platform_surface, 0);
  assert.equal(ledger.summary.attached_routed_via_framework_adapter, 11);
  assert.equal(ledger.summary.attached_routed_to_platform_game, 11);
  assert.equal(ledger.summary.attached_using_legacy_runtime, 0);
  assert.equal(ledger.summary.runtime_migration_complete, 0);
  assert.equal(
    ledger.attached_apps.every(
      (row) => row.checks.testnet_engine_attachment_present,
    ),
    true,
  );
  assert.equal(ledger.framework_adapter.implemented, true);
  assert.equal(ledger.framework_adapter.regression_present, true);
  assert.deepEqual(
    ledger.attached_apps
      .filter((row) => !row.checks.testnet_descriptor_values_match_local)
      .map((row) => row.app_id),
    ["miniapp-jump-rush", "miniapp-sheep-solitaire"],
  );
  assert.match(ledger.boundary, /do not prove funded runtime completion/i);
});

test("zero-drain candidates remain unbound until descriptors and runtime exist", () => {
  const ledger = buildPlatformGameMigrationLedger();

  assert.deepEqual(
    ledger.zero_drain_candidates.map((row) => row.app_id),
    [
      "miniapp-arrow-escape",
      "miniapp-bead-workshop",
      "miniapp-fruit-funnel",
      "miniapp-screw-sort",
      "miniapp-zhuada-e",
    ],
  );
  assert.equal(ledger.summary.candidate_runtime_ready, 0);
  assert.equal(
    ledger.zero_drain_candidates.every(
      (row) => row.checks.no_standalone_contract_binding,
    ),
    true,
  );
  assert.equal(
    ledger.zero_drain_candidates.every(
      (row) => row.binding.mode !== "shared" && row.attachment_status === "not-attached",
    ),
    true,
  );
});

test("migration markdown states the appId-first and funded lifecycle gates", () => {
  const markdown = renderPlatformGameMigrationMarkdown(
    buildPlatformGameMigrationLedger(),
  );

  assert.match(markdown, /Runtime migrations complete: 0\/11/);
  assert.match(markdown, /framework adapter: 11\/11/);
  assert.match(markdown, /direct clone-shaped chain calls/);
  assert.match(markdown, /appId-first ABI arguments/);
  assert.match(markdown, /funded testnet start\/finalize\/settle\/withdraw/);
});

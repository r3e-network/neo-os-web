import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPlatformGameMigrationLedger,
  bindingOf,
  renderPlatformGameMigrationMarkdown,
  withoutGeneratedTimestamps,
} from "../audit_platform_game_migration.mjs";

test("PlatformGame migration recognizes composable bindings", () => {
  assert.deepEqual(
    bindingOf('contract: { mode: "custom" }, platformBindings: { game: "0x' + "ab".repeat(20) + '" }'),
    { mode: "shared", module_id: "platform-game" },
  );
});

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
  assert.equal(ledger.summary.funded_testnet_lifecycle_proven, 0);
  assert.equal(ledger.summary.attached_with_live_state_evidence, 9);
  assert.deepEqual(
    ledger.attached_apps
      .filter((row) => !row.live_state.ready)
      .map((row) => row.app_id),
    ["miniapp-jump-rush", "miniapp-sheep-solitaire"],
  );
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
  assert.equal(ledger.summary.future_local_only_candidates, 5);
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
  assert.equal(
    ledger.zero_drain_candidates.every(
      (row) => row.migration_scope === "future-local-only",
    ),
    true,
  );
  assert.equal(
    ledger.zero_drain_candidates
      .filter((row) => [
        "miniapp-arrow-escape",
        "miniapp-bead-workshop",
        "miniapp-fruit-funnel",
        "miniapp-screw-sort",
      ].includes(row.app_id))
      .every((row) => row.binding.mode === "none"),
    true,
  );
});

test("migration markdown states the appId-first and funded lifecycle gates", () => {
  const markdown = renderPlatformGameMigrationMarkdown(
    buildPlatformGameMigrationLedger(),
  );

  assert.match(markdown, /Runtime migrations complete: 0\/11/);
  assert.match(markdown, /current read-only live state evidence: 9\/11/);
  assert.match(markdown, /\| Live state \|/);
  assert.match(markdown, /framework adapter: 11\/11/);
  assert.match(markdown, /direct clone-shaped chain calls/);
  assert.match(markdown, /future-local-only/);
  assert.match(markdown, /appId-first ABI arguments/);
  assert.match(markdown, /funded testnet start\/finalize\/settle\/withdraw/);
});

test("migration check ignores live evidence timestamps at every depth", () => {
  const value = {
    generated_at_utc: "old",
    summary: {
      generated_at_utc: "old",
      ready: true,
    },
    apps: [{ generated_at_utc: "old", app_id: "miniapp-demo" }],
  };

  assert.deepEqual(withoutGeneratedTimestamps(value), {
    summary: { ready: true },
    apps: [{ app_id: "miniapp-demo" }],
  });
});

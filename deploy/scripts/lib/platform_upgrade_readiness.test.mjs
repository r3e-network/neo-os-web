import test from "node:test";
import assert from "node:assert/strict";

import {
  buildUpgradeReadinessLedger,
  extractStoragePrefixes,
  extractStoredRecordLayouts,
  renderUpgradeReadinessMarkdown,
} from "../audit_platform_upgrade_readiness.mjs";

test("storage-prefix extraction retains exact byte namespaces", () => {
  assert.deepEqual(
    extractStoragePrefixes(`
      private static readonly byte[] PREFIX_ONE = new byte[] { 0x01 };
      private static readonly byte[] PREFIX_TWO = new byte[] { 0x16, 0x07 };
    `),
    { PREFIX_ONE: "0x01", PREFIX_TWO: "0x16,0x07" },
  );
});

test("stored-record extraction preserves serialized public field order", () => {
  assert.deepEqual(
    extractStoredRecordLayouts(`
      public struct Record {
        public string AppId;
        public BigInteger Amount;
      }
    `),
    { Record: ["string AppId", "BigInteger Amount"] },
  );
});

test("upgrade ledger resolves all drifted artifacts and exposes compatibility gates", () => {
  const ledger = buildUpgradeReadinessLedger({
    now: () => new Date("2026-07-23T00:00:00.000Z"),
  });

  assert.equal(ledger.summary.drifted_contracts, 4);
  assert.equal(ledger.summary.historical_artifacts_resolved, 4);
  assert.equal(ledger.summary.additive_or_equal_abi, 3);
  assert.equal(ledger.summary.breaking_abi_removals, 1);
  assert.equal(ledger.summary.unchanged_serialized_record_layouts, 4);
  assert.equal(ledger.summary.changed_prefix_values, 0);
  assert.equal(ledger.summary.staged_update_candidates, 2);
  assert.equal(ledger.summary.preflight_halt, 4);
  assert.equal(ledger.summary.preflight_transactions, 0);
  assert.deepEqual(
    ledger.contracts.map((contract) => contract.name),
    ["PlatformRegistry", "PlatformDeFi", "MiniAppFactory", "PlatformAnchor"],
  );
  assert.deepEqual(
    ledger.contracts.find((contract) => contract.name === "PlatformAnchor")?.abi.removed,
    ["setAgentAccounts", "setAgentWeight"],
  );
  const factory = ledger.contracts.find(
    (contract) => contract.name === "MiniAppFactory",
  );
  assert.equal(
    factory?.readiness,
    "live-abi-and-lifecycle-certification-required",
  );
  assert.match(
    factory?.behavior_changes.join(" ") ?? "",
    /manifest may only vary by its creator-unique contract name/,
  );
  assert.match(
    factory?.required_gates.join(" ") ?? "",
    /getcontractstate/,
  );
  assert.match(
    renderUpgradeReadinessMarkdown(ledger),
    /live-abi-and-lifecycle-certification-required/,
  );
  assert.match(ledger.boundary, /does not authorize a chain write/i);
});

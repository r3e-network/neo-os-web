import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSharedAaAccountRoster,
  derivePlatformAccountId,
} from "../audit_shared_aa_account_roster.mjs";

const REGISTRY_HASH = "0x5ec036efaa1fbde3ff7d1587d790768bc098cb2b";
const APP_ADMIN = "0x13ef519c362973f9a34648a9eac5b71250b2a80a";

test("shared AA account derivation matches the canonical registration preimage", () => {
  assert.equal(
    derivePlatformAccountId({
      registryHash: REGISTRY_HASH,
      appId: "miniapp-jump-rush",
      appAdmin: APP_ADMIN,
    }),
    "0x810ab40316a25958cfef1f3d52d4a3406eade0e1",
  );
  assert.notEqual(
    derivePlatformAccountId({
      registryHash: REGISTRY_HASH,
      appId: "miniapp-jump-rush",
      appAdmin: APP_ADMIN,
    }),
    derivePlatformAccountId({
      registryHash: REGISTRY_HASH,
      appId: "miniapp-sheep-solitaire",
      appAdmin: APP_ADMIN,
    }),
  );
});

test("roster preflight proves uniqueness without claiming materialization", () => {
  const report = buildSharedAaAccountRoster({
    manifests: [
      { id: "miniapp-arrow-escape", source: "apps/arrow-escape/neo-manifest.json" },
      { id: "miniapp-bead-workshop", source: "apps/bead-workshop/neo-manifest.json" },
    ],
    sourceReport: {
      platform_registry: REGISTRY_HASH,
      generated_at_utc: "2026-07-22T00:00:00Z",
      apps: [
        {
          app_id: "miniapp-arrow-escape",
          status: "planned",
          app_row: ["", "0x0", APP_ADMIN, "0x0", false, true],
        },
        {
          app_id: "miniapp-bead-workshop",
          status: "planned",
          app_row: ["", "0x0", APP_ADMIN, "0x0", false, true],
        },
      ],
    },
  });

  assert.equal(report.summary.complete, true);
  assert.equal(report.summary.derived_account_ids, 2);
  assert.equal(report.summary.unique_predicted_account_ids, 2);
  assert.ok(report.records.every((record) => record.reason.includes("not materialized")));
});

test("roster preflight fails closed on missing app-admin evidence", () => {
  const report = buildSharedAaAccountRoster({
    manifests: [{ id: "miniapp-arrow-escape", source: "apps/arrow-escape/neo-manifest.json" }],
    sourceReport: {
      platform_registry: REGISTRY_HASH,
      apps: [{ app_id: "miniapp-arrow-escape", status: "planned", app_row: ["", "0x0"] }],
    },
  });

  assert.equal(report.summary.complete, false);
  assert.equal(report.summary.unresolved_account_ids, 1);
  assert.equal(report.records[0].predicted_account_id, null);
});

test("roster preflight rejects stale source rows and inactive registry rows", () => {
  const report = buildSharedAaAccountRoster({
    manifests: [{ id: "miniapp-arrow-escape", source: "apps/arrow-escape/neo-manifest.json" }],
    sourceReport: {
      platform_registry: REGISTRY_HASH,
      apps: [
        {
          app_id: "miniapp-arrow-escape",
          status: "planned",
          app_row: ["", "0x0", APP_ADMIN, "0x0", false, false],
        },
        {
          app_id: "miniapp-stale-row",
          status: "planned",
          app_row: ["", "0x0", APP_ADMIN, "0x0", false, true],
        },
      ],
    },
  });

  assert.equal(report.summary.complete, false);
  assert.equal(report.summary.unresolved_account_ids, 1);
  assert.deepEqual(report.source_only_app_ids, ["miniapp-stale-row"]);
});

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  buildLifecycleEvidence,
  isCompleteLifecycleEvidence,
  loadLifecycleEvidence,
  writeLifecycleEvidence,
} from "./platform_game_lifecycle_evidence.mjs";

const ENGINE = "0xc75b181b4561462903bb27d8d9e0b32b637bec12";

function completeReport(overrides = {}) {
  return buildLifecycleEvidence({
    appId: "miniapp-snake-bounty",
    engine: ENGINE,
    status: "pass",
    chainWritesPerformed: true,
    checks: Object.fromEntries([
      "app_registered",
      "pool_funded",
      "start_game_issued",
      "active_game_pointer_set",
      "finalize_submitted",
      "kernel_fulfill_completed",
      "winner_credit_posted",
      "settled_status",
      "active_game_pointer_cleared",
      "pool_accounting",
      "liability_identity",
      "credit_withdrawn",
    ].map((key) => [key, true])),
    txids: {
      fund: "0xfund",
      entry: "0xentry",
      start_game: "0xstart",
      finalize_game: "0xfinalize",
      withdraw: "0xwithdraw",
    },
    generatedAt: () => new Date("2026-07-24T00:00:00.000Z"),
    ...overrides,
  });
}

test("complete testnet evidence requires every lifecycle check and write txid", () => {
  const report = completeReport();
  assert.equal(isCompleteLifecycleEvidence(report, {
    expectedNetwork: "neo-n3-testnet",
    expectedEngine: ENGINE,
  }), true);

  const incomplete = completeReport({
    checks: { ...report.checks, credit_withdrawn: false },
  });
  assert.equal(isCompleteLifecycleEvidence(incomplete, { expectedEngine: ENGINE }), false);
});

test("evidence loader accepts only complete matching reports and fails closed", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "platform-game-evidence-"));
  try {
    writeLifecycleEvidence({ repoRoot: root, report: completeReport() });
    fs.writeFileSync(
      path.join(root, "docs/reports/platform-game-lifecycles/bad.json"),
      JSON.stringify({ status: "pass", app_id: "bad" }),
      "utf8",
    );
    const loaded = loadLifecycleEvidence({ repoRoot: root, expectedEngine: ENGINE });
    assert.deepEqual(loaded.reports.map((row) => row.app_id), ["miniapp-snake-bounty"]);
    assert.deepEqual(loaded.invalid, [{
      path: "docs/reports/platform-game-lifecycles/bad.json",
      reason: "incomplete-or-mismatched-evidence",
    }]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

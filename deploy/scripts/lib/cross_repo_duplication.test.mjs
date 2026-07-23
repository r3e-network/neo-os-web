import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  alignedLineSimilarity,
  evaluateDuplicationEvidence,
} from "../audit_cross_repo_duplication.mjs";

test("aligned similarity measures identical and divergent clone-family lines", () => {
  assert.deepEqual(
    alignedLineSimilarity(["same", "left", "same"], ["same", "right", "same"]),
    {
      compared_lines: 3,
      identical_lines: 2,
      differing_lines: 1,
      identical_percent: 66.67,
    }
  );
});

test("duplication audit separates complete evidence from completed deduplication", () => {
  const result = evaluateDuplicationEvidence({
    cloneFamily: { all_exist: true, contracts: 11 },
    morpheusEnginePorts: {
      source_files: 12,
      sync_pipeline: { mapped_engines: 12, kept_engines: 6 },
    },
    envelopeCopies: {
      morpheus_exported: true,
      aa_uses_vendored_copy: true,
    },
    sdkGenerations: {
      framework: { files: 120 },
      ctx_os_runtime_reference_count: 4,
    },
  });

  assert.equal(result.audit_complete, true);
  assert.equal(result.dedup_complete, false);
  assert.deepEqual(result.unresolved, [
    "legacy-clone-contracts",
    "reviewed-handwritten-engine-divergence",
    "aa-envelope-vendored-copy",
    "ctx-os-runtime-proxies",
  ]);
});

test("committed duplication report retains the machine-readable completion boundary", () => {
  const report = JSON.parse(
    fs.readFileSync(
      new URL("../../../docs/reports/audit-findings-2026-07/duplication.json", import.meta.url),
      "utf8"
    )
  );

  assert.equal(report.schema_version, 2);
  assert.equal(report.audit_complete, true);
  assert.equal(report.dedup_complete, false);
  assert.ok(report.unresolved.length > 0);
});

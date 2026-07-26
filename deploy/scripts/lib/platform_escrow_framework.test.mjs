import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPlatformEscrowFrameworkReport,
  renderPlatformEscrowFrameworkMarkdown,
} from "../audit_platform_escrow_framework.mjs";

test("PlatformEscrow framework covers the local tenant ABI", () => {
  const report = buildPlatformEscrowFrameworkReport();
  assert.equal(report.passed, true);
  // Both literals moved 17 -> 18 on 2026-07-25 for one added capability:
  // reclaimApprovedMilestone (PlatformEscrow.Recovery.cs), exposed at
  // framework/platform-escrow-surface.ts:70,243 and already invoked by
  // apps/milestone-escrow/src/composables/useMilestoneEscrow.ts. The pins are
  // kept as two independent numbers rather than one shared constant so a change
  // on only one side of the ABI/framework boundary still fails here, which is
  // the drift this test exists to catch.
  assert.equal(report.tenant_abi_method_count, 18);
  assert.equal(report.framework_operation_count, 18);
  assert.deepEqual(report.missing_methods, []);
  assert.deepEqual(report.extra_methods, []);
  assert.equal(report.native_operations.length, 1);
  assert.equal(report.deployment, null);
});

test("PlatformEscrow framework report preserves the no-deployment boundary", () => {
  const markdown = renderPlatformEscrowFrameworkMarkdown(buildPlatformEscrowFrameworkReport());
  assert.match(markdown, /Interface audit: \*\*PASS\*\*/);
  assert.match(markdown, /Live deployment: no deployment record/);
  assert.match(markdown, /no retained deployment record or live binding/i);
});

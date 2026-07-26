import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPlatformVestingFrameworkReport,
  renderPlatformVestingFrameworkMarkdown,
} from "../audit_platform_vesting_framework.mjs";

test("PlatformVesting framework covers the local tenant ABI", () => {
  const report = buildPlatformVestingFrameworkReport();
  assert.equal(report.passed, true);
  assert.equal(report.tenant_abi_method_count, 13);
  assert.equal(report.framework_operation_count, 13);
  assert.deepEqual(report.missing_methods, []);
  assert.deepEqual(report.extra_methods, []);
  assert.equal(report.native_operations.length, 1);
  assert.equal(report.deployment, null);
});

test("PlatformVesting framework report preserves the no-deployment boundary", () => {
  const markdown = renderPlatformVestingFrameworkMarkdown(buildPlatformVestingFrameworkReport());
  assert.match(markdown, /Interface audit: \*\*PASS\*\*/);
  assert.match(markdown, /Live deployment: no deployment record/);
  assert.match(markdown, /no retained deployment record or live binding/i);
});

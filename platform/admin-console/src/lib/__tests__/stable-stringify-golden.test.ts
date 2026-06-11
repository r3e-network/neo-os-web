// =============================================================================
// stableStringify golden-vector test — platform/shared copy
// =============================================================================
//
// THREE copies of stableStringify exist (platform/shared/manifest.ts,
// platform/edge/functions/_shared/manifest.ts for Deno, and
// deploy/scripts/verify-publish-audit-chain.js). Each tree pins its copy
// against the SAME shared fixture, so a change to any one copy fails CI in
// that tree until all copies (and the golden) move together — silent
// divergence between manifest-hash/audit-chain verifiers is not possible.
//
// This test covers the canonical copy consumed by the admin console
// (src/lib/manifest-hash.ts) and the host app.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { stableStringify } from "../../../../shared/manifest";

const fixturePath = path.resolve(
  __dirname,
  "../../../../shared/__fixtures__/stable-stringify-golden.json",
);

describe("stableStringify golden vector (platform/shared/manifest.ts)", () => {
  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8")) as {
    input: unknown;
    expectedCanonical: string;
    expectedSha256: string;
  };

  it("serializes the shared fixture to the pinned canonical string", () => {
    expect(stableStringify(fixture.input)).toBe(fixture.expectedCanonical);
  });

  it("hashes the shared fixture to the pinned sha256", () => {
    const digest = createHash("sha256")
      .update(stableStringify(fixture.input), "utf8")
      .digest("hex");
    expect(digest).toBe(fixture.expectedSha256);
  });

  it("pins the current undefined/null edge-case behavior", () => {
    // JSON cannot express undefined, so these cases are pinned inline and
    // must match the equivalent inline assertions in the other two trees.
    expect(stableStringify(undefined)).toBe("null");
    expect(stableStringify(null)).toBe("null");
    expect(stableStringify({ a: undefined })).toBe('{"a":null}');
  });
});

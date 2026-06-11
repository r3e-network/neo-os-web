// stableStringify golden-vector test — deploy copy.
//
// THREE copies of stableStringify exist (platform/shared/manifest.ts,
// platform/edge/functions/_shared/manifest.ts for Deno, and the audit-chain
// verifier deploy/scripts/verify-publish-audit-chain.js). Each tree pins its
// copy against the SAME shared fixture in platform/shared/__fixtures__, so a
// change to any one copy fails CI in that tree until all copies (and the
// golden) move together — the audit-chain verifier cannot silently diverge
// from the hashes the admin console and edge functions produce.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

const require = createRequire(import.meta.url);
const { stableStringify } = require(
  path.join(ROOT, "deploy/scripts/verify-publish-audit-chain.js"),
);

const golden = JSON.parse(
  fs.readFileSync(
    path.join(ROOT, "platform/shared/__fixtures__/stable-stringify-golden.json"),
    "utf8",
  ),
);

test("verify-publish-audit-chain stableStringify matches the shared golden canonical string", () => {
  assert.equal(typeof stableStringify, "function");
  assert.equal(stableStringify(golden.input), golden.expectedCanonical);
});

test("verify-publish-audit-chain stableStringify matches the shared golden sha256", () => {
  const digest = createHash("sha256")
    .update(stableStringify(golden.input), "utf8")
    .digest("hex");
  assert.equal(digest, golden.expectedSha256);
});

test("verify-publish-audit-chain stableStringify pins the current undefined/null edge cases", () => {
  // JSON cannot express undefined, so these cases are pinned inline and must
  // match the equivalent inline assertions in the other two trees.
  assert.equal(stableStringify(undefined), "null");
  assert.equal(stableStringify(null), "null");
  assert.equal(stableStringify({ a: undefined }), '{"a":null}');
});

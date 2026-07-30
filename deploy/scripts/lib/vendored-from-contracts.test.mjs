import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Files neo-os-contracts owns that this repo carries a copy of.
 *
 * This repo no longer has contracts/ - the contracts, their build output and the
 * audits over them are neo-os-contracts'. What remains here is tooling that
 * reads contract manifests from wherever they were built, which needs the
 * manifest helpers but not the contracts.
 *
 * The checksum is the upstream contents. An upstream edit fails there (see that
 * repo's scripts/lib/vendored-downstream.test.mjs) and here, so the copies cannot
 * drift apart quietly. To land a change: edit it upstream, copy it across, update
 * both checksums.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");

const VENDORED = [
  {
    local: "deploy/scripts/lib/contract_build_abi.mjs",
    upstream: "neo-os-contracts:scripts/lib/contract_build_abi.mjs",
    sha256: "f393c64677e3d111da02479a556933275b2996c5aa95fbeb32e3afaef14ccd63",
  },
];

const sha256 = (relative) =>
  crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.join(repoRoot, relative)))
    .digest("hex");

for (const entry of VENDORED) {
  test(`${entry.local} matches ${entry.upstream}`, () => {
    assert.equal(
      sha256(entry.local),
      entry.sha256,
      `${entry.local} no longer matches ${entry.upstream}. Change it upstream, copy it here, ` +
        `then update the checksum in this file and in the upstream pin.`,
    );
  });
}

test("this repo does not carry a contracts/ tree", () => {
  // The whole point of the split: the contracts, their build output and the
  // audits over them are neo-os-contracts'. A contracts/ directory reappearing
  // here means a copy came back.
  assert.equal(
    fs.existsSync(path.join(repoRoot, "contracts")),
    false,
    "contracts/ belongs to neo-os-contracts; this repo must not hold a second copy",
  );
});

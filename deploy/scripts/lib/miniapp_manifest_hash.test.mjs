import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { readAppManifest } from "./app-manifests.mjs";
import {
  getManifestContractHash,
  getRegistryContractHash,
  contractOverrideEnvKey,
  normalizeContractHash,
} from "./miniapp_manifest_hash.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

// The single-contract live validators that previously hardcoded stale
// hashes (MP-W3-05). Resolution must equal the app manifest byte-for-byte.
// on-chain-tarot was one of the original six: commit 0dd7c4af1 (fleet WIP
// landing, manifest v2.0.0) intentionally removed its `contracts` block for
// the guest-mode pivot (testnet-only, permissions []), so it can no longer be
// a manifest-resolved validator target. A dedicated guard below pins that
// state so re-adding tarot contracts forces a conscious re-listing here.
const VALIDATOR_SLUGS = [
  "red-envelope",
  "time-capsule",
  "breakup-contract",
  "last-survivor",
  "fogplay",
];

test("resolved hash equals the app manifest for all validator targets (testnet + mainnet)", () => {
  for (const slug of VALIDATOR_SLUGS) {
    const manifest = readAppManifest(slug);
    for (const [network, key] of [
      ["testnet", "neo-n3-testnet"],
      ["mainnet", "neo-n3-mainnet"],
    ]) {
      const resolved = getManifestContractHash(slug, { network, env: {} });
      assert.equal(
        resolved,
        String(manifest.contracts[key]).toLowerCase(),
        `${slug} ${network} hash must come from the manifest snapshot`
      );
    }
  }
});

test("on-chain-tarot stays out of the validator list while its manifest is contract-free", () => {
  // Guard intent preserved: tarot's exit from the validator list must remain
  // deliberate. Its guest-mode manifest (commit 0dd7c4af1) declares no
  // contracts, so manifest resolution must fail loudly rather than fall back
  // to a hardcoded hash. If contracts are re-declared, this fails and tarot
  // must be re-added to VALIDATOR_SLUGS above.
  const manifest = readAppManifest("on-chain-tarot");
  assert.equal(
    manifest.contracts,
    undefined,
    "on-chain-tarot re-declared contracts: re-add it to VALIDATOR_SLUGS"
  );
  assert.throws(
    () => getManifestContractHash("on-chain-tarot", { network: "testnet", env: {} }),
    /has no contracts\["neo-n3-testnet"\] entry/
  );
});

test("selected-miniapps targets resolve from their sources of truth", () => {
  // Apps with a manifest resolve from apps/<slug>/neo-manifest.json …
  for (const slug of ["flashloan", "graveyard"]) {
    const manifest = readAppManifest(slug);
    assert.equal(
      getManifestContractHash(slug, { network: "testnet", env: {} }),
      String(manifest.contracts["neo-n3-testnet"]).toLowerCase()
    );
  }
  // … contract-only smoke targets resolve from deploy/config/contract-hashes.json.
  const registry = JSON.parse(
    fs.readFileSync(path.join(repoRoot, "deploy", "config", "contract-hashes.json"), "utf8")
  );
  for (const key of [
    "gascircle",
    "exfiles",
    "masqueradedao",
    "millionpiecemap",
    "heritagetrust",
    "turtlematch",
  ]) {
    assert.equal(
      getRegistryContractHash(key, { env: {} }),
      String(registry[key.toUpperCase()]).toLowerCase()
    );
  }
});

test("CONTRACT_OVERRIDE env replaces the manifest hash", () => {
  const override = "0x" + "ab".repeat(20);
  assert.equal(
    getManifestContractHash("red-envelope", { env: { CONTRACT_OVERRIDE: override } }),
    override
  );
  assert.equal(getRegistryContractHash("gascircle", { env: { CONTRACT_OVERRIDE: override } }), override);
});

test("per-target CONTRACT_OVERRIDE_<SLUG> beats the process-wide override", () => {
  const perTarget = "0x" + "cd".repeat(20);
  const env = {
    CONTRACT_OVERRIDE: "0x" + "ab".repeat(20),
    [contractOverrideEnvKey("red-envelope")]: perTarget,
  };
  assert.equal(contractOverrideEnvKey("red-envelope"), "CONTRACT_OVERRIDE_RED_ENVELOPE");
  assert.equal(getManifestContractHash("red-envelope", { env }), perTarget);
});

test("override values are validated and normalized", () => {
  assert.throws(
    () => getManifestContractHash("red-envelope", { env: { CONTRACT_OVERRIDE: "not-a-hash" } }),
    /invalid contract hash/
  );
  // bare 40-hex override gains the 0x prefix; uppercase is lowercased
  assert.equal(
    getManifestContractHash("red-envelope", { env: { CONTRACT_OVERRIDE: "AB".repeat(20) } }),
    "0x" + "ab".repeat(20)
  );
});

test("unknown slug / missing network entry / bad slug fail loudly", () => {
  assert.throws(
    () => getManifestContractHash("no-such-app", { env: {} }),
    /no manifest for "no-such-app" in the snapshot/
  );
  assert.throws(() => getManifestContractHash("../etc", { env: {} }), /invalid app slug/);
  assert.throws(() => getManifestContractHash("", { env: {} }), /invalid app slug/);
  assert.throws(
    () => getRegistryContractHash("no-such-contract", { env: {} }),
    /has no "NO-SUCH-CONTRACT" entry/
  );
});

test("normalizeContractHash enforces the 0x + 40 hex shape", () => {
  assert.equal(normalizeContractHash("0x" + "0f".repeat(20), "t"), "0x" + "0f".repeat(20));
  assert.throws(() => normalizeContractHash("0x1234", "t"), /invalid contract hash/);
  assert.throws(() => normalizeContractHash("", "t"), /invalid contract hash/);
});

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  getManifestContractHash,
  getRegistryContractHash,
  contractOverrideEnvKey,
  normalizeContractHash,
} from "./miniapp_manifest_hash.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

// The six single-contract live validators that previously hardcoded stale
// hashes (MP-W3-05). Resolution must equal the app manifest byte-for-byte.
const VALIDATOR_SLUGS = [
  "red-envelope",
  "time-capsule",
  "on-chain-tarot",
  "breakup-contract",
  "last-survivor",
  "fogplay",
];

test("resolved hash equals the app manifest for all six validator targets (testnet + mainnet)", () => {
  for (const slug of VALIDATOR_SLUGS) {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(repoRoot, "apps", slug, "neo-manifest.json"), "utf8")
    );
    for (const [network, key] of [
      ["testnet", "neo-n3-testnet"],
      ["mainnet", "neo-n3-mainnet"],
    ]) {
      const resolved = getManifestContractHash(slug, { network, env: {} });
      assert.equal(
        resolved,
        String(manifest.contracts[key]).toLowerCase(),
        `${slug} ${network} hash must come from apps/${slug}/neo-manifest.json`
      );
    }
  }
});

test("selected-miniapps targets resolve from their sources of truth", () => {
  // Apps with a manifest resolve from apps/<slug>/neo-manifest.json …
  for (const slug of ["flashloan", "graveyard"]) {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(repoRoot, "apps", slug, "neo-manifest.json"), "utf8")
    );
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
    /cannot read app manifest .*no-such-app/
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

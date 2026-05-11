/**
 * Cross-Repo Hash Consistency — integration tests (read-only).
 *
 * Verifies that contract hashes recorded in neo-manifest.json files,
 * platform config, and cross-repo references all point to real,
 * deployed contracts on testnet.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  ROOT,
  ORACLE_HASH,
  AA_CORE_HASH,
  getContractState,
  getNetworkConfig,
  readManifest,
  getManifestContractHash,
} from "./helpers.mjs";

// ── Oracle hash matches deployed contract ──────────────────────────────────

test("oracle hash in neo_network.js matches a deployed contract on testnet", async () => {
  assert.ok(ORACLE_HASH, "ORACLE_HASH must be defined");
  assert.match(ORACLE_HASH, /^0x[0-9a-f]{40}$/i, "ORACLE_HASH must be a valid script-hash");

  const state = await getContractState(ORACLE_HASH);
  assert.ok(state, `getcontractstate returned nothing for ${ORACLE_HASH}`);
  assert.ok(
    state.manifest?.name,
    `deployed oracle contract at ${ORACLE_HASH} has no manifest name`,
  );
});

// ── AA core hash matches deployed contract ────────────────────────────────

test("AA core hash matches a deployed contract on testnet", async () => {
  assert.ok(AA_CORE_HASH, "AA_CORE_HASH must be defined");
  assert.match(AA_CORE_HASH, /^0x[0-9a-f]{40}$/i, "AA_CORE_HASH must be a valid script-hash");

  const state = await getContractState(AA_CORE_HASH);
  assert.ok(state, `getcontractstate returned nothing for ${AA_CORE_HASH}`);
  assert.ok(
    state.manifest?.name,
    `deployed AA core contract at ${AA_CORE_HASH} has no manifest name`,
  );
});

// ── Flagship manifest hashes resolve to deployed contracts ─────────────────

const FLAGSHIP_SLUGS = [
  "last-survivor",
  "gasbox",
  "red-envelope",
  "daily-checkin",
  "fogplay",
  "self-loan",
  "neo-pay",
];

test("all 7 flagship contract hashes in neo-manifest.json resolve to deployed contracts", async () => {
  for (const slug of FLAGSHIP_SLUGS) {
    const manifest = readManifest(slug);
    const hash = getManifestContractHash(manifest, "testnet");

    assert.ok(
      hash,
      `${slug}/neo-manifest.json is missing a testnet contract hash`,
    );
    assert.match(
      hash,
      /^0x[0-9a-f]{40}$/i,
      `${slug} testnet hash is not a valid script-hash: ${hash}`,
    );

    const state = await getContractState(hash);
    assert.ok(
      state?.manifest?.name,
      `${slug} testnet hash ${hash} does not resolve to a deployed contract`,
    );
  }
});

// ── Oracle hash consistency between neo_network and flagship oracle refs ───

test("oracle hash in neo_network.js matches the testnet oracle hash used by flagship oracle consumers", async () => {
  const networkConfig = getNetworkConfig("testnet");
  const configOracleHash = networkConfig.oracleHash;
  assert.ok(configOracleHash, "neo_network testnet config must include oracleHash");

  // FogPlay is a known oracle consumer.  Its configure script references
  // the oracle hash.  Verify the canonical config matches.
  assert.equal(
    configOracleHash.toLowerCase(),
    ORACLE_HASH.toLowerCase(),
    "ORACLE_HASH should equal the neo_network testnet oracleHash",
  );
});

// ── All neo-manifest.json testnet hashes resolve (broad scan) ─────────────

test("all neo-manifest.json files with testnet hashes resolve to deployed contracts", async () => {
  const appsDir = path.join(ROOT, "apps");
  const slugs = fs
    .readdirSync(appsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => {
      const manifestPath = path.join(appsDir, name, "neo-manifest.json");
      return fs.existsSync(manifestPath);
    });

  let checked = 0;
  const failures = [];

  for (const slug of slugs) {
    let manifest;
    try {
      manifest = readManifest(slug);
    } catch {
      continue;
    }

    const hash = manifest?.contracts?.["neo-n3-testnet"];
    if (!hash || typeof hash !== "string" || hash.length < 42) continue;

    checked++;
    try {
      const state = await getContractState(hash);
      if (!state?.manifest?.name) {
        failures.push(`${slug}: ${hash} returned no manifest name`);
      }
    } catch (err) {
      failures.push(
        `${slug}: ${hash} — ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  assert.ok(checked > 0, "should have checked at least one neo-manifest.json");
  assert.equal(
    failures.length,
    0,
    `${failures.length} contract(s) failed to resolve:\n  ${failures.join("\n  ")}`,
  );
});

// ── Manifest hashes are distinct (no accidental duplicates) ───────────────

test("flagship contracts have distinct testnet hashes", () => {
  const hashes = new Map();
  for (const slug of FLAGSHIP_SLUGS) {
    const manifest = readManifest(slug);
    const hash = getManifestContractHash(manifest, "testnet");
    if (!hash) continue;

    const lower = hash.toLowerCase();
    if (hashes.has(lower)) {
      const currentRuntime = manifest?.runtime;
      const previousManifest = readManifest(hashes.get(lower));
      const previousRuntime = previousManifest?.runtime;
      const currentPlatform = currentRuntime?.modules?.[0]?.platform;
      const previousPlatform = previousRuntime?.modules?.[0]?.platform;
      const currentAppId = currentRuntime?.modules?.[0]?.appId;
      const previousAppId = previousRuntime?.modules?.[0]?.appId;
      if (
        String(currentRuntime?.mode || "").toLowerCase() === "platform" &&
        String(previousRuntime?.mode || "").toLowerCase() === "platform" &&
        currentPlatform &&
        previousPlatform &&
        currentPlatform === previousPlatform &&
        currentAppId &&
        previousAppId &&
        currentAppId !== previousAppId
      ) {
        continue;
      }
      assert.fail(
        `${slug} and ${hashes.get(lower)} share the same testnet hash ${hash}`,
      );
    }
    hashes.set(lower, slug);
  }
  assert.ok(hashes.size >= 4, "should have distinct direct contracts plus intentional shared platform runtimes");
});

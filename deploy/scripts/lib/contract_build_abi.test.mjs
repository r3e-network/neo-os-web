import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import {
  abiMethodSignature,
  buildManifestDir,
  findMissingSafeMethods,
  loadBuildManifestAbis,
  resolveExpectedMethods,
} from "./contract_build_abi.mjs";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const verifier = require("../verify_mainnet_miniapp_contract_methods.js");

test("loadBuildManifestAbis indexes committed contract build manifests by name", () => {
  const abis = loadBuildManifestAbis({ repoRoot });
  assert.ok(abis.byName.size > 0, "must load at least one build manifest");

  const redEnvelope = abis.byName.get("MiniAppRedEnvelope");
  assert.ok(redEnvelope, "MiniAppRedEnvelope build manifest must be indexed");
  assert.equal(redEnvelope.manifestFile, "MiniAppRedEnvelope.manifest.json");
  assert.ok(redEnvelope.safeMethods.includes("getOwner"));
  assert.ok(redEnvelope.safeSignatures.has("getOwner/0"));
  // every safe method must be reflected in the signature set
  assert.equal(redEnvelope.safeSignatures.size, redEnvelope.safeMethods.length);
});

test("resolveExpectedMethods matches by deployed contract name, null otherwise", () => {
  const abis = loadBuildManifestAbis({ repoRoot });
  const resolved = resolveExpectedMethods("MiniAppRedEnvelope", abis);
  assert.ok(resolved);
  assert.equal(resolved.contractName, "MiniAppRedEnvelope");
  assert.equal(resolved.manifestPath, path.join(repoRoot, "contracts", "build", "MiniAppRedEnvelope.manifest.json"));
  assert.ok(resolved.safeMethods.length > 0);
  assert.equal(resolveExpectedMethods("NoSuchContract", abis), null);
  assert.equal(resolveExpectedMethods("", abis), null);
});

test("findMissingSafeMethods flags a dropped safe method by name", () => {
  const abis = loadBuildManifestAbis({ repoRoot });
  const expected = resolveExpectedMethods("MiniAppRedEnvelope", abis);
  const entry = abis.byName.get("MiniAppRedEnvelope");

  assert.deepEqual(findMissingSafeMethods(entry.methods, expected), [], "identical live ABI: no drift");

  const liveMissing = entry.methods.filter((m) => m.name !== "getEnvelope");
  assert.deepEqual(findMissingSafeMethods(liveMissing, expected), ["getEnvelope"]);
});

test("abiMethodSignature keys on name and arity", () => {
  assert.equal(abiMethodSignature({ name: "getOwner", parameters: [] }), "getOwner/0");
  assert.equal(abiMethodSignature({ name: "creditOf", parameters: [{ name: "a" }] }), "creditOf/1");
  assert.equal(abiMethodSignature({ name: "x" }), "x/0");
});

test("buildManifestDir resolves under the repo root", () => {
  assert.equal(buildManifestDir(repoRoot), path.join(repoRoot, "contracts", "build"));
});

test("a malformed build manifest is surfaced, not silently skipped", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "build-abi-"));
  try {
    const dir = path.join(root, "contracts", "build");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "Broken.manifest.json"), "{ not json", "utf8");
    assert.throws(() => loadBuildManifestAbis({ repoRoot: root }), /invalid build manifest Broken\.manifest\.json/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("loadBuildManifestAbis accepts canonical manifests from sibling repositories", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "build-abi-siblings-"));
  try {
    const additional = path.join(root, "external", "contracts", "build");
    fs.mkdirSync(additional, { recursive: true });
    fs.writeFileSync(
      path.join(additional, "ExternalKernel.manifest.json"),
      JSON.stringify({
        name: "ExternalKernel",
        abi: { methods: [{ name: "getState", safe: true, parameters: [] }] },
      }),
      "utf8",
    );

    const abis = loadBuildManifestAbis({ repoRoot: root, additionalDirs: [additional] });
    const external = abis.byName.get("ExternalKernel");
    assert.ok(external);
    assert.equal(external.manifestFile, "ExternalKernel.manifest.json");
    assert.equal(external.manifestPath, path.join(additional, "ExternalKernel.manifest.json"));
    assert.deepEqual(external.safeMethods, ["getState"]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// All-apps coverage: the sentinel must have a checkable method source for EVERY
// mainnet-contract-backed app the shared live-harness coverage map tracks. The
// verifier enumerates that exact set (no silent skips) and treats a missing
// method source as a blocker.
// ---------------------------------------------------------------------------

test("verifier enumerates every mainnet-contract-backed app from the coverage map", () => {
  const coverageIds = verifier.coverageMainnetContractAppIds({ root: repoRoot });
  assert.ok(coverageIds.length > 0, "coverage must report mainnet contract apps");

  const loaded = new Set(verifier.loadApps().map((app) => app.appId));
  const checked = new Set(verifier.loadApps().filter((app) => app.mainnetHash).map((app) => app.appId));

  // No coverage-tracked mainnet-contract app may be skipped by the verifier.
  const gaps = verifier.reconcileCoverageBackedApps({
    coverageMainnetIds: new Set(coverageIds),
    loadedAppIds: loaded,
    checkedMainnetIds: checked,
  });
  assert.deepEqual(gaps, [], `every coverage-tracked mainnet contract app must be checked (gaps: ${gaps.join("; ")})`);
});

test("reconcileCoverageBackedApps reports a not-loaded coverage app as a blocker", () => {
  const gaps = verifier.reconcileCoverageBackedApps({
    coverageMainnetIds: new Set(["miniapp-ghost"]),
    loadedAppIds: new Set(),
    checkedMainnetIds: new Set(),
  });
  assert.deepEqual(gaps, ["miniapp-ghost: coverage-tracked contract-backed app not loaded by the verifier"]);
});

test("reconcileCoverageBackedApps reports a loaded-but-unchecked coverage app as a blocker", () => {
  const gaps = verifier.reconcileCoverageBackedApps({
    coverageMainnetIds: new Set(["miniapp-loaded"]),
    loadedAppIds: new Set(["miniapp-loaded"]),
    checkedMainnetIds: new Set(),
  });
  assert.deepEqual(gaps, [
    "miniapp-loaded: coverage-tracked contract-backed app has no mainnet contract to drift-check",
  ]);
});

test("evaluateBuildAbiDrift fails when a contract-backed app has no method source", () => {
  const abis = loadBuildManifestAbis({ repoRoot });
  const drift = verifier.evaluateBuildAbiDrift({
    contractName: "TotallyUnknownKernel",
    liveMethods: [],
    hasRuntimeMethodSource: false,
    resolveExpectedMethods,
    findMissingSafeMethods,
    buildAbis: abis,
  });
  assert.equal(drift.failures.length, 1);
  assert.match(drift.failures[0], /no expected-method source/);
});

test("evaluateBuildAbiDrift passes silently only when a runtime source exists", () => {
  const abis = loadBuildManifestAbis({ repoRoot });
  const drift = verifier.evaluateBuildAbiDrift({
    contractName: "TotallyUnknownKernel",
    liveMethods: [],
    hasRuntimeMethodSource: true,
    resolveExpectedMethods,
    findMissingSafeMethods,
    buildAbis: abis,
  });
  assert.deepEqual(drift.failures, []);
  assert.equal(drift.source.manifestFile, null);
});

test("evaluateBuildAbiDrift fails on a committed safe method missing from the live ABI", () => {
  const abis = loadBuildManifestAbis({ repoRoot });
  const entry = abis.byName.get("MiniAppRedEnvelope");
  const liveMissing = entry.methods.filter((m) => m.name !== "getEnvelope");
  const drift = verifier.evaluateBuildAbiDrift({
    contractName: "MiniAppRedEnvelope",
    liveMethods: liveMissing,
    hasRuntimeMethodSource: false,
    resolveExpectedMethods,
    findMissingSafeMethods,
    buildAbis: abis,
  });
  assert.equal(drift.failures.length, 1);
  assert.match(drift.failures[0], /build-manifest safe method getEnvelope .* missing from live ABI/);
  assert.deepEqual(drift.source.missingSafeMethods, ["getEnvelope"]);
});

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  applyHashToManifest,
  readManifestContractHash,
  selectTargetApps,
  writebackDeployedHash,
  NETWORK_CONTRACT_KEYS,
} from "./manifest_hash_writeback.mjs";

const OLD = "0x1111111111111111111111111111111111111111";
const NEW = "0x363c5de9760d1aaaed5096fdf3bdc877cd0368e9";

function makeRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "writeback-"));
  const appsDir = path.join(root, "apps");
  fs.mkdirSync(appsDir, { recursive: true });
  return { root, appsDir };
}

function writeApp(appsDir, slug, manifest) {
  const dir = path.join(appsDir, slug);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, "neo-manifest.json");
  fs.writeFileSync(filePath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return filePath;
}

function readApp(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

test("applyHashToManifest writes only the requested network's contracts field", () => {
  const manifest = { id: "miniapp-alpha", contracts: { "neo-n3-mainnet": OLD, "neo-n3-testnet": OLD } };
  const changes = applyHashToManifest(manifest, "mainnet", NEW);
  assert.deepEqual(changes, ["contracts.neo-n3-mainnet"]);
  assert.equal(manifest.contracts["neo-n3-mainnet"], NEW);
  assert.equal(manifest.contracts["neo-n3-testnet"], OLD, "testnet field must be untouched");
});

test("applyHashToManifest prefers an existing alias key over the canonical key", () => {
  const manifest = { id: "miniapp-legacy", contracts: { mainnet: OLD } };
  const changes = applyHashToManifest(manifest, "mainnet", NEW);
  assert.deepEqual(changes, ["contracts.mainnet"]);
  assert.equal(manifest.contracts.mainnet, NEW);
  assert.ok(!("neo-n3-mainnet" in manifest.contracts), "must not introduce a second key");
});

test("applyHashToManifest seeds the canonical key when no contracts entry exists", () => {
  const manifest = { id: "miniapp-new" };
  const changes = applyHashToManifest(manifest, "mainnet", NEW);
  assert.deepEqual(changes, ["contracts.neo-n3-mainnet"]);
  assert.equal(manifest.contracts["neo-n3-mainnet"], NEW);
});

test("applyHashToManifest also updates platform runtime module networks that carry a hash", () => {
  const manifest = {
    id: "miniapp-platform",
    contracts: { "neo-n3-mainnet": OLD },
    runtime: {
      mode: "platform",
      modules: [
        {
          platform: "PlatformGame",
          networks: {
            "neo-n3-mainnet": { contract_hash: OLD, registered: true },
            "neo-n3-testnet": { contract_hash: OLD },
          },
        },
      ],
    },
  };
  const changes = applyHashToManifest(manifest, "mainnet", NEW);
  assert.deepEqual(changes, [
    "contracts.neo-n3-mainnet",
    "runtime.modules[0].networks.neo-n3-mainnet.contract_hash",
  ]);
  assert.equal(manifest.runtime.modules[0].networks["neo-n3-mainnet"].contract_hash, NEW);
  assert.equal(
    manifest.runtime.modules[0].networks["neo-n3-testnet"].contract_hash,
    OLD,
    "testnet module hash must be untouched",
  );
});

test("applyHashToManifest is a no-op when the hash already matches", () => {
  const manifest = { id: "miniapp-alpha", contracts: { "neo-n3-mainnet": NEW } };
  const changes = applyHashToManifest(manifest, "mainnet", NEW);
  assert.deepEqual(changes, []);
});

test("applyHashToManifest normalizes and rejects malformed hashes", () => {
  const manifest = { id: "miniapp-alpha", contracts: {} };
  // bare hex (no 0x) is normalized and accepted
  applyHashToManifest(manifest, "mainnet", "363c5de9760d1aaaed5096fdf3bdc877cd0368e9");
  assert.equal(manifest.contracts["neo-n3-mainnet"], NEW);
  assert.throws(() => applyHashToManifest({ contracts: {} }, "mainnet", "0xnothex"), /invalid script hash/);
  assert.throws(() => applyHashToManifest({ contracts: {} }, "neo", NEW), /unknown network/);
});

test("readManifestContractHash resolves either alias and lowercases", () => {
  assert.equal(
    readManifestContractHash({ contracts: { "neo-n3-mainnet": NEW.toUpperCase() } }, "mainnet"),
    NEW,
  );
  assert.equal(readManifestContractHash({ contracts: { mainnet: NEW } }, "mainnet"), NEW);
  assert.equal(readManifestContractHash({ contracts: {} }, "mainnet"), "");
});

test("selectTargetApps matches explicit id/slug and auto-detects existing-hash apps", () => {
  const OTHER = "0x2222222222222222222222222222222222222222";
  const { root, appsDir } = makeRepo();
  try {
    writeApp(appsDir, "alpha", { id: "miniapp-alpha", contracts: { "neo-n3-mainnet": OLD } });
    writeApp(appsDir, "beta", { id: "miniapp-beta", contracts: { "neo-n3-mainnet": OTHER } });

    // explicit by slug (NEW matches no manifest, so only the explicit alpha is selected)
    assert.deepEqual(
      selectTargetApps({ repoRoot: root, network: "mainnet", hash: NEW, explicitTargets: ["alpha"] }).map((a) => a.slug),
      ["alpha"],
    );
    // explicit by app id
    assert.deepEqual(
      selectTargetApps({ repoRoot: root, network: "mainnet", hash: NEW, explicitTargets: ["miniapp-alpha"] }).map((a) => a.slug),
      ["alpha"],
    );
    // auto-detect: deploying OLD again finds alpha (already references OLD)
    assert.deepEqual(
      selectTargetApps({ repoRoot: root, network: "mainnet", hash: OLD }).map((a) => a.slug),
      ["alpha"],
    );
    // union of explicit + hash-match, de-duplicated and sorted by slug
    assert.deepEqual(
      selectTargetApps({ repoRoot: root, network: "mainnet", hash: OTHER, explicitTargets: ["alpha"] }).map((a) => a.slug),
      ["alpha", "beta"],
    );
    // unknown explicit target throws (no silent miss)
    assert.throws(
      () => selectTargetApps({ repoRoot: root, network: "mainnet", hash: NEW, explicitTargets: ["miniapp-ghost"] }),
      /unknown app id\/slug/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("writebackDeployedHash writes the right field and is idempotent (no churn)", () => {
  const { root, appsDir } = makeRepo();
  try {
    const filePath = writeApp(appsDir, "alpha", {
      id: "miniapp-alpha",
      contracts: { "neo-n3-mainnet": OLD, "neo-n3-testnet": OLD },
    });

    const first = writebackDeployedHash({ repoRoot: root, network: "mainnet", hash: NEW, explicitTargets: ["miniapp-alpha"] });
    assert.equal(first.written.length, 1);
    assert.deepEqual(first.written[0].changes, ["contracts.neo-n3-mainnet"]);
    assert.equal(readApp(filePath).contracts["neo-n3-mainnet"], NEW);
    assert.equal(readApp(filePath).contracts["neo-n3-testnet"], OLD);

    const snapshot = fs.readFileSync(filePath, "utf8");
    const second = writebackDeployedHash({ repoRoot: root, network: "mainnet", hash: NEW, explicitTargets: ["miniapp-alpha"] });
    assert.equal(second.written.length, 0, "idempotent re-run writes nothing");
    assert.deepEqual(second.unchanged, ["alpha"]);
    assert.equal(fs.readFileSync(filePath, "utf8"), snapshot, "file must be byte-identical after idempotent run");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("writebackDeployedHash preserves 2-space indent and trailing newline", () => {
  const { root, appsDir } = makeRepo();
  try {
    const filePath = writeApp(appsDir, "alpha", { id: "miniapp-alpha", contracts: { "neo-n3-mainnet": OLD } });
    writebackDeployedHash({ repoRoot: root, network: "mainnet", hash: NEW, explicitTargets: ["alpha"] });
    const text = fs.readFileSync(filePath, "utf8");
    assert.ok(text.endsWith("\n"), "must end with a trailing newline");
    assert.ok(text.includes('\n  "id"'), "must use 2-space indentation");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("writebackDeployedHash reports targets:0 when no manifest references the hash", () => {
  const { root, appsDir } = makeRepo();
  try {
    writeApp(appsDir, "alpha", { id: "miniapp-alpha", contracts: { "neo-n3-mainnet": OLD } });
    const report = writebackDeployedHash({ repoRoot: root, network: "mainnet", hash: NEW });
    assert.equal(report.targets, 0);
    assert.equal(report.written.length, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("network key aliases are exported for both networks", () => {
  assert.deepEqual(NETWORK_CONTRACT_KEYS.mainnet, ["neo-n3-mainnet", "mainnet"]);
  assert.deepEqual(NETWORK_CONTRACT_KEYS.testnet, ["neo-n3-testnet", "testnet"]);
});

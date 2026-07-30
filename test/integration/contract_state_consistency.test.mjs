/**
 * Contract State Consistency — cross-repo integration tests (read-only).
 *
 * Every assertion is derived from the committed contract build artifacts
 * (contracts/build/<Name>.manifest.json) instead of a hand-maintained
 * method list.  For each migrated miniapp contract on testnet we verify:
 *   1. The app's testnet hash resolves to the migrated contract name
 *   2. The deployed ABI exposes every safe method from the committed manifest
 *   3. Every committed safe zero-arg read method returns HALT
 *   4. Manifest-declared admin/owner reads return a non-zero account
 *   5. Unknown-id lookups behave concretely (HALT with an empty record, or
 *      FAULT with the contract's documented abort reason) — never the
 *      HALT-or-FAULT tautology.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  ROOT,
  UINT160_ZERO,
  invokeRead,
  getContractState,
  isHalt,
  stackHash160,
  readManifest,
  getManifestContractHash,
  intParam,
  hashParam,
} from "./helpers.mjs";

// ── App ↔ migrated contract bindings ───────────────────────────────────────
//
// One representative slug per deployed contract that has a committed build
// manifest under contracts/build/.  The contract NAME is the intent pin
// (which committed artifact each app must run); every method-level
// expectation below is generated from that artifact's ABI.

// 2026-07-15 fixture reconciliation against live testnet (audit finding I1):
//   * dice-game, fogplay, and gasbox completed their intentional V2
//     migrations — the manifests' testnet hashes resolve on chain to
//     MiniAppDiceGameV2 / MiniAppCoinFlipV2 / MiniAppGasBoxV2 (commit/settle
//     house-game pattern), so the bindings pin the V2 build artifacts.
//   * on-chain-tarot was removed: commit 0dd7c4af1 retired the contracts
//     key from apps/on-chain-tarot/neo-manifest.json (app under redesign),
//     so per this file's own guidance the binding is dropped until the
//     manifest declares a testnet deployment again.
const CONTRACT_BINDINGS = [
  { slug: "breakup-contract", contractName: "MiniAppBreakupPact" },
  { slug: "custom-anchor", contractName: "PlatformAnchor" },
  { slug: "dice-game", contractName: "MiniAppDiceGameV2" },
  { slug: "event-ticket-pass", contractName: "MiniAppEventTicketPass" },
  { slug: "fogplay", contractName: "MiniAppCoinFlipV2" },
  { slug: "gasbox", contractName: "MiniAppGasBoxV2" },
  { slug: "gov-merc", contractName: "MiniAppGovMerc" },
  { slug: "last-survivor", contractName: "MiniAppLastSurvivor" },
  { slug: "milestone-escrow", contractName: "MiniAppMilestoneEscrow" },
  { slug: "neo-multisig", contractName: "MiniAppMultisig" },
  { slug: "quadratic-funding", contractName: "MiniAppQuadraticFunding" },
  { slug: "red-envelope", contractName: "MiniAppRedEnvelope" },
  { slug: "self-loan", contractName: "MiniAppSelfLoan" },
  { slug: "soulbound-certificate", contractName: "MiniAppSoulboundCertificate" },
  { slug: "time-capsule", contractName: "MiniAppTimeCapsule" },
];

// Deployed reads that are known to FAULT because of a bug baked into the
// deployed NEF.  Each entry must keep faulting with the documented reason;
// once the contract is redeployed with a fix, the entry must be removed.
// (Empty since the 2026-06-12 in-place upgrade of MiniAppSoulboundCertificate
// fixed its tokens() Storage.Find FindOptions bug — tokens() now HALTs.)
const KNOWN_FAULTING_READS = new Map([]);

// Safe methods that exist in the committed build manifests but are expected
// to be MISSING from the current testnet deployments, because the committed
// artifacts are newer than the live NEFs and the fixes only take effect on a
// one-time redeploy (the pre-upgradability instances cannot be updated in
// place — see commit ae71cbd69 "make the standalone miniapp contracts
// upgradable"):
//   * <Name>.getOwner/0            — upgradability surface (ae71cbd69, 2026-06-17)
//   * <Name>.directAssetCreditOf/2 — stranded-deposit reclaim reads
//                                    (2f38f74c3, 2026-06-16); frontends probe
//                                    this and gate deposits off when absent
//   * MiniAppGovMerc JIT-stake / MiniAppTimeCapsule fishRevenueOf reads
//                                    (3c3ad33ce, 2026-06-17)
// Keys are `<ContractName>.<method>/<argc>`.  Test 2 asserts each entry is
// still absent on chain, so the moment a contract is redeployed with the new
// build this list forces its own pruning.  Do NOT add entries for methods a
// frontend calls unconditionally at runtime — those are product breaks, not
// pending-redeploy drift.
const KNOWN_PENDING_REDEPLOY = new Set([
  "MiniAppBreakupPact.getOwner/0",
  "MiniAppCoinFlipV2.getOwner/0",
  "MiniAppEventTicketPass.directAssetCreditOf/2",
  "MiniAppGovMerc.getOwner/0",
  "MiniAppGovMerc.eligibleStaked/0",
  "MiniAppGovMerc.eligibleStakeOf/1",
  "MiniAppGovMerc.pendingStakeOf/1",
  "MiniAppGovMerc.pendingStakeEpoch/1",
  "MiniAppMilestoneEscrow.directAssetCreditOf/2",
  "MiniAppMultisig.getOwner/0",
  "MiniAppQuadraticFunding.directAssetCreditOf/2",
  "MiniAppSoulboundCertificate.directAssetCreditOf/2",
  "MiniAppTimeCapsule.getOwner/0",
  "MiniAppTimeCapsule.fishRevenueOf/1",
  // Found the first time this test could run after the repo split - it had been
  // reading apps/ and contracts/build out of this repo, both of which had moved.
  // The committed PlatformAnchor build exposes these three as safe; the deployed
  // contract 0xab079b4f9a0a2471d136392e25eb8e99898dcad0 exposes none of them and
  // its updatecounter is 0, so it has never been updated since deployment.
  // Queried against testnet 2026-07-30. Redeploying PlatformAnchor prunes all
  // three, which the self-cleaning assertion above enforces.
  "PlatformAnchor.getAppCredit/3",
  "PlatformAnchor.getAppTotalNeoCredit/1",
  "PlatformAnchor.getAppTotalGasCredit/1",
]);

function isPendingRedeploy(contractName, method) {
  return KNOWN_PENDING_REDEPLOY.has(`${contractName}.${methodKey(method)}`);
}

// Concrete unknown-id lookup expectations (replaces the old HALT-or-FAULT
// tautology).  Param values are synthesized per the build-manifest ABI type.
const UNKNOWN_ID_LOOKUPS = [
  {
    contractName: "MiniAppRedEnvelope",
    method: "getEnvelope",
    expect: "fault",
    exceptionPattern: /envelope not found/,
  },
  // The V2 house-game contracts replaced getGame/1 with getPendingBet/1 and
  // abort with "bet not found" for unknown ids (verified on testnet
  // 2026-07-15 against the deployed MiniAppCoinFlipV2/MiniAppDiceGameV2).
  {
    contractName: "MiniAppCoinFlipV2",
    method: "getPendingBet",
    expect: "fault",
    exceptionPattern: /bet not found/,
  },
  {
    contractName: "MiniAppDiceGameV2",
    method: "getPendingBet",
    expect: "fault",
    exceptionPattern: /bet not found/,
  },
  {
    contractName: "MiniAppSelfLoan",
    method: "getLoan",
    expect: "halt",
  },
  {
    contractName: "MiniAppLastSurvivor",
    method: "getRound",
    expect: "halt",
  },
];

const UNKNOWN_ID = 999_999_999;

// ── Build-manifest helpers ─────────────────────────────────────────────────

// Compiled contract manifests are built in the repo that owns the contract:
// neo-os-contracts for the platform estate, neo-os-miniapps and
// neo-os-minigames for the app contracts this test binds apps to. Each root is
// overridable so CI can point at wherever it placed the checkouts.
const BUILD_ROOTS = [
  process.env.NEO_OS_CONTRACTS_DIR || path.resolve(ROOT, "..", "neo-os-contracts"),
  process.env.NEO_MINIAPPS_DIR || path.resolve(ROOT, "..", "neo-os-miniapps"),
  process.env.NEO_MINIGAMES_DIR || path.resolve(ROOT, "..", "neo-os-minigames"),
].map((root) => path.join(root, "contracts", "build"));

function readBuildManifest(contractName) {
  const file = `${contractName}.manifest.json`;
  for (const buildDir of BUILD_ROOTS) {
    const candidate = path.join(buildDir, file);
    if (fs.existsSync(candidate)) return JSON.parse(fs.readFileSync(candidate, "utf8"));
  }
  throw new Error(
    `${file} not found. It is built in one of the sibling repos; clone them beside this one or ` +
      `set NEO_OS_CONTRACTS_DIR / NEO_MINIAPPS_DIR / NEO_MINIGAMES_DIR. Looked in:\n  ` +
      BUILD_ROOTS.join("\n  "),
  );
}

function methodKey(method) {
  return `${method.name}/${(method.parameters || []).length}`;
}

function safeMethods(buildManifest) {
  return (buildManifest.abi?.methods || []).filter((method) => method.safe === true);
}

function zeroArgSafeReads(buildManifest) {
  return safeMethods(buildManifest).filter(
    (method) => (method.parameters || []).length === 0,
  );
}

function ownerStyleReads(buildManifest) {
  return zeroArgSafeReads(buildManifest).filter((method) =>
    /^(admin|owner|getAdmin|getOwner)$/i.test(method.name),
  );
}

function synthesizedParam(type) {
  if (type === "Integer") return intParam(UNKNOWN_ID);
  if (type === "Hash160") return hashParam(UINT160_ZERO);
  throw new Error(`no synthesized value for ABI parameter type ${type}`);
}

// ── Target resolution (committed artifacts; no network access) ────────────

const TARGETS = CONTRACT_BINDINGS.map(({ slug, contractName }) => ({
  slug,
  contractName,
  hash: getManifestContractHash(readManifest(slug), "testnet"),
  build: readBuildManifest(contractName),
}));

// getcontractstate is cached so each deployed contract is fetched once.
const deployedStateCache = new Map();
async function deployedState(hash) {
  if (!deployedStateCache.has(hash)) {
    deployedStateCache.set(hash, await getContractState(hash));
  }
  return deployedStateCache.get(hash);
}

// ── Test 1: every bound app resolves to its migrated contract ─────────────

test("every bound app's testnet hash resolves to its migrated contract name", async () => {
  for (const target of TARGETS) {
    assert.ok(
      target.hash,
      `${target.slug}: neo-manifest.json has no testnet contract hash — update CONTRACT_BINDINGS if the deployment was retired`,
    );
    assert.equal(
      target.build.name,
      target.contractName,
      `${target.slug}: contracts/build/${target.contractName}.manifest.json declares name ${target.build.name}`,
    );

    const state = await deployedState(target.hash);
    assert.equal(
      state?.manifest?.name,
      target.contractName,
      `${target.slug} (${target.hash}): deployed contract is ${state?.manifest?.name}, expected ${target.contractName}`,
    );
  }
});

// ── Test 2: deployed ABI is a superset of the committed safe surface ──────

test("deployed ABIs expose every safe method from the committed build manifests", async () => {
  for (const target of TARGETS) {
    const state = await deployedState(target.hash);
    const deployedMethods = new Map(
      (state?.manifest?.abi?.methods || []).map((method) => [
        methodKey(method),
        method.safe === true,
      ]),
    );

    for (const method of safeMethods(target.build)) {
      const key = methodKey(method);
      if (isPendingRedeploy(target.contractName, method)) {
        // Self-cleaning: once the contract is redeployed with the newer
        // build, the method appears on chain and this forces the
        // KNOWN_PENDING_REDEPLOY entry to be pruned.
        assert.ok(
          !deployedMethods.has(key),
          `${target.contractName}.${key} is allowlisted as pending redeploy but IS now present on chain (${target.hash}) — remove the KNOWN_PENDING_REDEPLOY entry`,
        );
        continue;
      }
      assert.ok(
        deployedMethods.has(key),
        `${target.contractName}.${key} is safe in the committed manifest but missing from the deployed ABI (${target.hash})`,
      );
      assert.ok(
        deployedMethods.get(key),
        `${target.contractName}.${key} is safe in the committed manifest but not marked safe on chain (${target.hash})`,
      );
    }
  }
});

// ── Test 3: every committed safe zero-arg read returns HALT ───────────────

test("all committed safe zero-arg read methods HALT on testnet", async () => {
  for (const target of TARGETS) {
    for (const method of zeroArgSafeReads(target.build)) {
      // Methods absent from the live NEF until the one-time redeploy would
      // FAULT with "method not found"; test 2 already pins their absence
      // (and forces pruning once redeployed), so skip invoking them here.
      if (isPendingRedeploy(target.contractName, method)) continue;
      const key = `${target.contractName}.${method.name}`;
      const known = KNOWN_FAULTING_READS.get(key);
      const result = await invokeRead(target.hash, method.name);

      if (known) {
        assert.ok(
          !isHalt(result) && known.exceptionPattern.test(String(result.exception || "")),
          `${key} is allowlisted as faulting (${known.reason}) but returned ` +
            `${result.state}: ${result.exception || "no exception"} — if the contract was redeployed with a fix, remove the KNOWN_FAULTING_READS entry`,
        );
        continue;
      }

      assert.ok(
        isHalt(result),
        `${target.slug}: ${key}() returned ${result.state}: ${result.exception || "no exception"}`,
      );
      assert.ok(
        Array.isArray(result.stack) && result.stack.length >= 1,
        `${target.slug}: ${key}() halted but returned no stack value`,
      );
    }
  }
});

// ── Test 4: manifest-declared admin/owner reads return a non-zero account ─

test("manifest-declared admin/owner reads return a non-zero account", async () => {
  for (const target of TARGETS) {
    for (const method of ownerStyleReads(target.build)) {
      // getOwner/0 only exists after the one-time redeploy to the
      // upgradable builds (ae71cbd69); test 2 pins the pending state.
      if (isPendingRedeploy(target.contractName, method)) continue;
      const result = await invokeRead(target.hash, method.name);
      assert.ok(
        isHalt(result),
        `${target.contractName}.${method.name}() returned ${result.state}: ${result.exception || "no exception"}`,
      );
      const account = stackHash160(result.stack?.[0]);
      assert.ok(
        account && account !== UINT160_ZERO,
        `${target.contractName}.${method.name}() is zero or not a Hash160 — contract may be uninitialised`,
      );
    }
  }
});

// ── Test 5: unknown-id lookups behave concretely ───────────────────────────

test("unknown-id lookups HALT with an empty record or FAULT with the documented reason", async () => {
  for (const lookup of UNKNOWN_ID_LOOKUPS) {
    const target = TARGETS.find((entry) => entry.contractName === lookup.contractName);
    assert.ok(target, `${lookup.contractName} is missing from CONTRACT_BINDINGS`);

    const method = safeMethods(target.build).find(
      (entry) => entry.name === lookup.method && (entry.parameters || []).length === 1,
    );
    assert.ok(
      method,
      `${lookup.contractName}.${lookup.method}/1 is not a safe one-arg method in the committed manifest`,
    );

    const args = [synthesizedParam(method.parameters[0].type)];
    const result = await invokeRead(target.hash, lookup.method, args);
    const label = `${lookup.contractName}.${lookup.method}(${args[0].value})`;

    if (lookup.expect === "halt") {
      assert.ok(
        isHalt(result),
        `${label} expected HALT with an empty record, got ${result.state}: ${result.exception || "no exception"}`,
      );
      assert.ok(
        Array.isArray(result.stack) && result.stack.length >= 1,
        `${label} halted but returned no stack value`,
      );
    } else {
      assert.ok(
        !isHalt(result),
        `${label} expected FAULT for an unknown id, got HALT — lookup contract behavior changed`,
      );
      assert.match(
        String(result.exception || ""),
        lookup.exceptionPattern,
        `${label} faulted with an unexpected reason`,
      );
    }
  }
});

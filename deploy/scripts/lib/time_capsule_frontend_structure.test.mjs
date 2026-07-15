import assert from "node:assert/strict";
import test from "node:test";
import {
  assertAssets,
  assertClasses,
  assertDispatches,
  assertMessageKeys,
  assertModernTypography,
  assertPlayStage,
  read,
} from "./frontend_structure_helpers.mjs";

test("Time Capsule renders one capsule-first action with durable chain recovery", () => {
  const playArea = read("apps/time-capsule/src/PlayArea.tsx");
  const styles = read("apps/time-capsule/src/PlayArea.scss");
  const logic = read("apps/time-capsule/src/composables/useTimeCapsule.ts");
  const safety = read("apps/time-capsule/src/time-capsule-safety.ts");
  const messages = read("apps/time-capsule/src/locale/messages.ts");
  const manifest = JSON.parse(read("apps/time-capsule/neo-manifest.json"));

  assertPlayStage(playArea, "social", "Time Capsule");
  assertClasses(playArea, [
    "time-capsule-play-area",
    "capsule-scene",
    "capsule-scene__stage-image",
    "capsule-message-dock",
    "capsule-letter-card",
    "capsule-quick-seal",
    "capsule-recovery",
    "capsule-storage-warning",
    "capsule-drawer",
  ], "Time Capsule");
  assertDispatches(playArea, [
    "createCapsule",
    "recoverPending",
    "openCapsule",
    "loadFishCandidates",
    "fishCapsule",
    "withdrawCredit",
  ], "Time Capsule");
  assertAssets(["apps/time-capsule/public/time-capsule-stage.webp"]);
  assert.match(playArea, /components-react\/v2\/OpenUiLite/);
  assert.match(playArea, /components-react\/v2\/PlayStage/);
  assert.doesNotMatch(playArea, /from "@shared\/components-react\/v2"/);
  assert.match(playArea, /CoinArt variant="gas"/);
  assert.match(playArea, /capsulesSource === "failed"/);
  assert.match(playArea, /candidatesSource === "failed"/);
  assert.match(playArea, /creditSource === "failed"/);
  assert.doesNotMatch(playArea, /setTimeout\(|createPreview/);
  assert.doesNotMatch(playArea, /secondary:\s*\[/);
  assert.doesNotMatch(playArea, /<(input|textarea|select)\b/);

  assert.match(logic, /assertRecoveryStorage/);
  assert.match(logic, /PENDING_DURABLE_STORE_KEY/);
  assert.match(logic, /onPaymentSent: \(txid\) => persistPayment/);
  assert.match(logic, /onTransactionSent: \(txid\) => persistAction/);
  assert.match(logic, /result\.verified === true && result\.event/);
  assert.match(logic, /transactionReadbackMismatch/);
  assert.match(logic, /candidatesSource\.set\("failed"\)/);
  assert.doesNotMatch(logic, /withdrawFishRevenue/);
  assert.match(safety, /getMiniAppContractHash/);
  assert.match(safety, /configured !== expected/);
  assert.match(safety, /method: "getapplicationlog"/);
  assert.match(safety, /normalizeTimeCapsuleHash\(record\.contract\) === wanted/);
  assert.equal(manifest.category, "social");
  assert.deepEqual(manifest.operation_panel.operations, []);

  assertMessageKeys(messages, [
    "transactionPending",
    "transactionEventMismatch",
    "transactionReadbackMismatch",
    "pendingBlocksWrites",
    "recoveryStorageUnavailable",
    "recoveryStorageUnavailableAfterBroadcast",
    "capsuleDataUnavailable",
    "publicDataUnavailable",
    "creditDataUnavailable",
  ], "Time Capsule");
  assert.match(styles, /\.capsule-scene\s*\{/);
  assert.match(styles, /@media \(max-width:/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assertModernTypography(styles, "Time Capsule");
});

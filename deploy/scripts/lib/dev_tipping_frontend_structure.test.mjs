import assert from "node:assert/strict";
import test from "node:test";

import {
  assertAssets,
  assertClasses,
  assertDispatches,
  assertMessageKeys,
  assertModernTypography,
  assertPlayStage,
  exists,
  read,
} from "./frontend_structure_helpers.mjs";

test("Developer Tipping ships a resource-led social desk with durable wallet recovery", () => {
  const playArea = read("apps/dev-tipping/src/PlayArea.tsx");
  const styles = read("apps/dev-tipping/src/PlayArea.scss");
  const main = read("apps/dev-tipping/src/main.tsx");
  const wallet = read("apps/dev-tipping/src/composables/useDevTippingWallet.ts");
  const store = read("apps/dev-tipping/src/dev-tipping-operation-store.ts");
  const messages = read("apps/dev-tipping/src/locale/messages.ts");
  const manifest = JSON.parse(read("apps/dev-tipping/neo-manifest.json"));

  assertPlayStage(playArea, "social", "Developer Tipping");
  assertClasses(playArea, [
    "tip-scene",
    "tip-scene__stage-card",
    "tip-scene__stage-image",
    "tip-scene__builder-rack",
    "tip-scene__amount-board",
    "tip-receipt",
    "tip-drawer__tabs",
  ], "Developer Tipping");
  assertDispatches(playArea, [
    "sendTip",
    "registerDeveloper",
    "withdrawTips",
    "withdrawCredit",
    "recoverTip",
  ], "Developer Tipping");

  assert.match(playArea, /OpenUiLiteProvider as OpenUiProvider/);
  assert.match(playArea, /OpenUiLiteTextField as OpenUiTextField/);
  assert.match(playArea, /support-board-stage\.webp/);
  assert.doesNotMatch(playArea, /function OpenUiProvider|function OpenUiPanel|<form\b|<svg\b|[😀-🙏🌀-🫿]/u);
  assert.match(wallet, /amountFixed8: shortfall/);
  assert.match(wallet, /activeOperation: DevTippingOperationKind \| "recovery" \| null/);
  assert.match(wallet, /onPaymentSent: \(txid\) => journalBroadcast/);
  assert.match(wallet, /onTransactionSent: \(txid\) => journalBroadcast/g);
  assert.match(wallet, /finalizeRegister/);
  assert.match(wallet, /finalizeWithdrawTips/);
  assert.match(wallet, /finalizeWithdrawCredit/);
  assert.match(wallet, /readExecutionState\(pending\.network, pending\.txid\)/);
  assert.match(store, /dev-tipping\/pending-v2/);
  assert.match(store, /"deposit"[\s\S]*"tip"[\s\S]*"register"[\s\S]*"withdrawTips"[\s\S]*"withdrawCredit"/);
  assert.match(main, /let refreshGeneration = 0/);
  assert.match(main, /ownerMatchesAddress\(ctx\.framework\.chain\.address\.get\(\)/);

  assert.equal(manifest.features.stateless, false);
  assert.equal(manifest.category, "social");
  assert.equal(manifest.urls.banner, "/miniapps/dev-tipping/support-board-stage.webp");
  assert.deepEqual(manifest.operation_panel.operations, []);
  assertAssets([
    "apps/dev-tipping/public/support-board-stage.webp",
    "apps/dev-tipping/public/logo.webp",
  ]);
  for (const document of [
    "apps/dev-tipping/PRODUCTION_STATUS.md",
    "apps/dev-tipping/NETWORK_STATUS.md",
    "apps/dev-tipping/ASSET_PROVENANCE.md",
  ]) assert.ok(exists(document), `missing ${document}`);

  assertMessageKeys(messages, [
    "pendingActionBlocksAction",
    "transactionIdInvalid",
    "transactionIdConflict",
    "walletChangedDuringAction",
    "receiptEventMismatch",
    "receiptReadbackPending",
    "activityUnavailable",
    "dataRefreshPending",
  ], "Developer Tipping");
  assert.match(styles, /\.tip-scene__stage-image\s*\{[^}]*object-fit:\s*cover/s);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(styles, /linear-gradient\(|radial-gradient\(/);
  assertModernTypography(styles, "Developer Tipping");
});

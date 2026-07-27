import assert from "node:assert/strict";
import test from "node:test";
import {
  assertAssets,
  assertClasses,
  assertDispatches,
  assertMessageKeys,
  assertPlayStage,
  read,
} from "./frontend_structure_helpers.mjs";

test("NeoPay Stream Studio renders a product-owned shared-runtime payment workstation", () => {
  const playArea = read("apps/neo-pay-shared-example/src/PlayArea.tsx");
  const styles = read("apps/neo-pay-shared-example/src/PlayArea.scss");
  const main = read("apps/neo-pay-shared-example/src/main.tsx");
  const messages = read("apps/neo-pay-shared-example/src/messages.ts");
  const shellManifest = read("apps/neo-pay-shared-example/src/manifest.ts");
  const neoManifest = JSON.parse(read("apps/neo-pay-shared-example/neo-manifest.json"));

  assertPlayStage(playArea, "defi", "NeoPay Stream Studio");
  assertClasses(playArea, [
    "neo-pay-shared-play-area",
    "stream-studio__workbench",
    "stream-studio__visual",
    "stream-studio__art",
    "stream-studio__receipt",
    "stream-studio__composer",
    "stream-studio__stream-list",
    "stream-studio__exact-panel",
  ], "NeoPay Stream Studio");
  assertDispatches(playArea, [
    "createStream",
    "recoverPendingCreate",
    "refreshStreams",
    "claimStream",
    "cancelStream",
  ], "NeoPay Stream Studio");
  assert.match(playArea, /@shared\/components-react\/v2\/PlayStage/);
  assert.match(playArea, /@shared\/components-react\/v2\/OpenUiLite/);
  assert.match(playArea, /setAmount\(event\.target\.value\)/);
  assert.doesNotMatch(playArea, /normalizeAmountForAsset|__orb|__pulse|__backdrop/);

  assert.match(main, /useNeoPayApp\(\{ app, t: ctx\.t \}\)/);
  assert.match(main, /pendingCreateTxid: pay\.pendingCreateTxid/);
  assert.match(main, /beneficiaryStreams\.get\(\)\.find/);
  assert.match(main, /createdStreams\.get\(\)\.find/);
  assert.match(main, /actions\.register\("refreshStreams", pay\.loadAll\)/);
  assert.match(main, /actions\.register\("recoverPendingCreate"/);
  assert.doesNotMatch(main, /findStreamById|broadcast/i);

  assert.match(shellManifest, /tabs: \[\]/);
  assert.match(shellManifest, /stats: \[\]/);
  assert.match(shellManifest, /sidebar: \{ items: \[\] \}/);
  assert.match(shellManifest, /operations: \[\]/);
  assert.equal(neoManifest.version, "1.1.1");
  assert.equal(neoManifest.name, "NeoPay Stream Studio");
  assert.equal(neoManifest.urls.icon.endsWith(".webp"), true);
  assert.equal(neoManifest.urls.banner.endsWith(".webp"), true);
  assert.equal(neoManifest.operations, undefined);
  assert.equal(neoManifest.detail_template, undefined);
  assert.equal(neoManifest.contracts["neo-n3-mainnet"], "0xfd4dcc346d73c4ac6c3db209323561cf7f1b5e34");
  assert.equal(neoManifest.contracts["neo-n3-testnet"], "0x27a81e6d2f01a1d241b9aef5bed74c93f3a5ca5e");
  assert.equal(neoManifest.contract_composition.mode, "shared");
  assert.ok(neoManifest.frontend_composition.operation_recipes.length > 0);

  assertAssets([
    "apps/neo-pay-shared-example/public/payment-stream-desk.webp",
    "apps/neo-pay-shared-example/public/banner.webp",
    "apps/neo-pay-shared-example/public/logo.webp",
  ]);
  assertMessageKeys(messages, [
    "studioName",
    "studioHeroTitle",
    "neoWholeAmountRequired",
    "gasFixed8Required",
    "serviceUnavailable",
    "authoritativeActionHint",
  ], "NeoPay Stream Studio");
  assert.match(styles, /\.stream-studio__workbench\s*\{/);
  assert.match(styles, /@media \(max-width:/);
  assert.doesNotMatch(styles, /background-image\s*:|__orb|__pulse|__backdrop/);
});

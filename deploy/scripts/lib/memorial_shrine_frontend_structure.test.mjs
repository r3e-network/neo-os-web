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

test("Memorial Shrine ships one resource-led flow with durable exact transaction recovery", () => {
  const playArea = read("apps/memorial-shrine/src/PlayArea.tsx");
  const styles = read("apps/memorial-shrine/src/PlayArea.scss");
  const hook = read("apps/memorial-shrine/src/composables/useMemorialShrine.ts");
  const production = read("apps/memorial-shrine/src/logic/memorial-production.ts");
  const main = read("apps/memorial-shrine/src/main.tsx");
  const messages = read("apps/memorial-shrine/src/locale/messages.ts");
  const shellManifest = read("apps/memorial-shrine/src/manifest.ts");
  const neoManifest = JSON.parse(read("apps/memorial-shrine/neo-manifest.json"));

  assertPlayStage(playArea, "social", "Memorial Shrine");
  assertClasses(playArea, [
    "shrine-workbench",
    "shrine-garden-panel",
    "shrine-tribute-card",
    "shrine-offering-dock",
    "shrine-create-card",
    "shrine-chain-notice",
    "shrine-drawer-shell",
    "shrine-transaction-record",
  ], "Memorial Shrine");
  assertDispatches(playArea, [
    "createMemorial",
    "payTribute",
    "recoverPendingWrite",
    "refreshMemorials",
  ], "Memorial Shrine");

  assert.match(playArea, /@shared\/components-react\/v2\/PlayStage/);
  assert.match(playArea, /@shared\/components-react\/v2\/OpenUiLite/);
  assert.doesNotMatch(playArea, /from "@shared\/components-react\/v2"/);
  assert.match(playArea, /primary:\s*hasPendingWrite/);
  assert.doesNotMatch(playArea, /role="tab"|<form\b|emoji/);

  assert.match(hook, /onTransactionSent:\s*rememberBroadcast/);
  assert.match(hook, /assertMemorialRecoveryStorage/);
  assert.match(hook, /persistPendingMemorialWrite/);
  assert.match(hook, /createdMemorialIdFromOutcome/);
  assert.match(hook, /tributeEventMatches/);
  assert.match(hook, /memorialReadbackMatches/);
  assert.match(hook, /tributeReadbackMatches/);
  assert.match(hook, /getMemorialTributeAt/);
  assert.match(hook, /scriptHash:\s*contractHash/);
  assert.doesNotMatch(hook, /setTimeout|setInterval|verified\s*===\s*true/);

  assert.match(production, /getapplicationlog/);
  assert.match(production, /state:\s*"unknown"\s*\|\s*"fault"\s*\|\s*"halt"/);
  assert.match(production, /recoveryStorageUnavailable/);
  assert.match(production, /MEMORIAL_SHRINE_CONTRACTS/);
  assert.match(production, /parseMemorialInteger/);

  assert.match(main, /actions\.register\("recoverPendingWrite"/);
  assert.match(main, /pendingWrite:\s*shrine\.pendingWrite/);
  assert.doesNotMatch(main, /notify\.guard\(\(\) => shrine\.(?:createMemorial|payTribute)/);

  assert.match(shellManifest, /tabs:\s*\[\]/);
  assert.match(shellManifest, /stats:\s*\[\]/);
  assert.match(shellManifest, /sidebar:\s*\{ items:\s*\[\] \}/);
  assert.match(shellManifest, /operations:\s*\[\]/);
  assert.equal(neoManifest.operation_panel, undefined);
  assert.equal(neoManifest.features.stateless, false);
  assert.equal(neoManifest.contracts["neo-n3-mainnet"], "0xee7a548b71c69364fcb0e45a63a40f141b938e42");
  assert.equal(neoManifest.contracts["neo-n3-testnet"], "0x87f0fe2ba69cd973a3274471234d3cc13ef943c5");

  assertAssets([
    "apps/memorial-shrine/public/memorial-garden.webp",
    "apps/memorial-shrine/public/shrine-scene-art.webp",
    "apps/memorial-shrine/public/banner.webp",
    "apps/memorial-shrine/public/logo.webp",
  ]);
  for (const document of [
    "apps/memorial-shrine/README.md",
    "apps/memorial-shrine/PRODUCTION_STATUS.md",
    "apps/memorial-shrine/NETWORK_STATUS.md",
    "apps/memorial-shrine/ASSET_PROVENANCE.md",
  ]) assert.ok(exists(document), `missing ${document}`);

  assertMessageKeys(messages, [
    "mainnetTributeUnavailable",
    "recoveryStorageUnavailable",
    "transactionPending",
    "transactionReadbackPending",
    "transactionConfirmed",
    "transactionFaulted",
    "transactionEventMismatch",
  ], "Memorial Shrine");
  assert.match(styles, /data-phase="broadcast"/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assertModernTypography(styles, "Memorial Shrine");
});

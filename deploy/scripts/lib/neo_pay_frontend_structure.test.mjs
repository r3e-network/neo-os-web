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

test("NeoPay ships a resource-led payment desk with exact, recoverable wallet actions", () => {
  const playArea = read("apps/neo-pay/src/PlayArea.tsx");
  const styles = read("apps/neo-pay/src/PlayArea.scss");
  const main = read("apps/neo-pay/src/main.tsx");
  const production = read("apps/neo-pay/src/useNeoPayProduction.ts");
  const safety = read("apps/neo-pay/src/neo-pay-safety.ts");
  const messages = read("apps/neo-pay/src/locale/messages.ts");
  const manifest = JSON.parse(read("apps/neo-pay/neo-manifest.json"));
  const indexHtml = read("apps/neo-pay/index.html");

  assertPlayStage(playArea, "defi", "NeoPay");
  assertClasses(playArea, [
    "neopay-scene",
    "neopay-terminal",
    "neopay-terminal__art",
    "neopay-stream",
    "neopay-ticket-board",
    "neopay-amount-console",
    "neopay-recipient-card",
    "neopay-schedule-card",
    "neopay-drawer-tabs",
    "neopay-stream-card",
  ], "NeoPay");
  assertDispatches(playArea, [
    "createStream",
    "claimStream",
    "cancelStream",
    "recoverTransaction",
    "refreshRecoveryStorage",
    "refreshStreams",
  ], "NeoPay");
  assert.match(playArea, /@shared\/components-react\/v2\/OpenUiLite/);
  assert.match(playArea, /const STREAM_DESK_ART = "payment-stream-desk\.webp"/);
  assert.match(playArea, /<CoinArt/);
  assert.match(playArea, /const primaryMode = pendingCreateTxid \? "recover" : !recoveryStorageHealthy \? "storage" : "create"/);
  assert.match(playArea, /secondaryActions = claimableStream/);
  assert.doesNotMatch(playArea, /<form\b|<svg\b|dangerouslySetInnerHTML|[😀-🙏🌀-🫿]/u);

  assert.match(main, /activeAction: pay\.activeAction/);
  assert.match(main, /recoveryStorageHealthy: pay\.recoveryStorageHealthy/);
  assert.match(main, /actions\.register\("refreshRecoveryStorage"/);
  assert.match(production, /function nudgeNeoPayAmount[\s\S]*BigInt/);
  assert.match(production, /const runExclusive = <T>/);
  assert.match(production, /let refreshGeneration = 0/);
  assert.match(production, /assertWriteSnapshot/);
  assert.match(production, /pending journal deletion was not durable/);
  assert.match(production, /readNeoPayTransactionOutcome/);
  assert.match(production, /await readStream\(id,/);
  assert.match(safety, /\^0x\[0-9a-fA-F\]\{64\}\$/);
  assert.match(safety, /getMiniAppContractHash\(NEO_PAY_APP_ID/);
  assert.match(safety, /StreamCreated/);
  assert.match(safety, /StreamClaimed/);
  assert.match(safety, /StreamCancelled/);

  assert.equal(manifest.version, "2.1.0");
  assert.equal(manifest.features.stateless, false);
  assert.deepEqual(manifest.operation_panel.operations, []);
  assert.equal(manifest.urls.icon, "/miniapps/neo-pay/logo.webp");
  assert.equal(manifest.urls.banner, "/miniapps/neo-pay/banner.webp");
  assert.equal(manifest.contracts["neo-n3-mainnet"], "0xfd4dcc346d73c4ac6c3db209323561cf7f1b5e34");
  assert.equal(manifest.contracts["neo-n3-testnet"], "0x27a81e6d2f01a1d241b9aef5bed74c93f3a5ca5e");
  assert.match(indexHtml, /type="image\/webp" href="\.\/logo\.webp"/);
  assertAssets([
    "apps/neo-pay/public/payment-stream-desk.webp",
    "apps/neo-pay/public/banner.webp",
    "apps/neo-pay/public/logo.webp",
  ]);
  for (const document of [
    "apps/neo-pay/PRODUCTION_STATUS.md",
    "apps/neo-pay/NETWORK_STATUS.md",
    "apps/neo-pay/ASSET_PROVENANCE.md",
  ]) assert.ok(exists(document), `missing ${document}`);

  assertMessageKeys(messages, [
    "neoPayWriteContextChanged",
    "neoPayRecoveryStorageUnavailable",
    "neoPayPendingBlocksWrites",
    "neoPayConfirmationNeedsReview",
    "neoPayDataPartial",
    "neoPayAmountPrecisionHint",
  ], "NeoPay messages");
  assert.match(styles, /\.neopay-terminal\s*\{[\s\S]*background:\s*#ffffff/);
  assert.match(styles, /\.neopay-terminal__art\s*\{[\s\S]*object-fit:\s*contain/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(styles, /linear-gradient\(|radial-gradient\(|backdrop-filter/);
  assertModernTypography(styles, "NeoPay");
});

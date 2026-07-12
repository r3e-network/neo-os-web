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

test("Gov Merc renders a v2 governance market workspace with wallet actions", () => {
  const playArea = read("apps/gov-merc/src/PlayArea.tsx");
  const styles = read("apps/gov-merc/src/PlayArea.scss");
  const messages = read("apps/gov-merc/src/locale/messages.ts");
  const main = read("apps/gov-merc/src/main.tsx");
  const manifest = read("apps/gov-merc/src/manifest.ts");
  const hook = read("apps/gov-merc/src/hooks/useGovMerc.ts");
  const production = read("apps/gov-merc/src/gov-merc-production.ts");

  assertPlayStage(playArea, "governance", "Gov Merc");
  assertClasses(playArea, [
    "gov-merc-play-area",
    "merc-workspace",
    "merc-market-visual",
    "merc-command",
    "merc-drawer",
    "merc-drawer-tabs",
    "merc-drawer-panel",
    "merc-pending-record",
  ], "Gov Merc");
  assertDispatches(playArea, [
    "connectWallet",
    "placeBid",
    "depositNeo",
    "withdrawNeo",
    "settleEpoch",
    "claimRewards",
    "reclaimBid",
    "withdrawCredit",
    "recoverPendingOperation",
  ], "Gov Merc");
  assert.match(playArea, /OpenUiLiteProvider as OpenUiProvider/);
  assert.match(playArea, /@shared\/components-react\/v2\/PlayStage/);
  assert.doesNotMatch(playArea, /actionPreview|useTransientFlag|setTimeout/);
  assert.doesNotMatch(playArea, /secondary\s*:/);
  assert.match(main, /depositAmount/);
  assert.match(main, /bidAmount/);
  assert.match(main, /pendingOperation: pool\.pendingOperation/);
  assert.match(manifest, /category: "governance"/);
  assert.match(manifest, /tabs: \[\]/);
  assert.match(manifest, /stats: \[\]/);
  assert.match(manifest, /operations: \[\]/);
  assert.match(hook, /assertGovMercRecoveryStorage/);
  assert.match(hook, /onPaymentSent:/);
  assert.match(hook, /onTransactionSent:/);
  assert.match(hook, /transactionReader/);
  assert.match(hook, /marketAvailable\.set\(false\)/);
  assert.doesNotMatch(hook, /credit\s*=\s*0n;\s*\}\s*catch/s);
  assert.match(production, /requireExactGovMercContext/);
  assert.match(production, /getapplicationlog/);
  assert.match(production, /govMercEventMatches/);
  assert.match(production, /govMercReadbackSatisfied/);
  assertAssets(["apps/gov-merc/public/gov-merc-market-stage.webp"]);
  assertMessageKeys(messages, [
    "govHeroTitle",
    "govHeroSubtitle",
    "flowDeposit",
    "flowBid",
    "flowInfluence",
    "bidLeaderboard",
    "claimRewards",
    "transactionPendingCopy",
    "recoveryStorageUnavailable",
    "valueUnavailable",
  ], "Gov Merc");
  assert.match(styles, /\.merc-workspace\s*\{/);
  assert.match(styles, /merc-real-state-focus/);
  assert.doesNotMatch(styles, /(?:linear|radial)-gradient\(/);
  assert.match(styles, /@media \(max-width:/);
  assertModernTypography(styles, "Gov Merc");
});

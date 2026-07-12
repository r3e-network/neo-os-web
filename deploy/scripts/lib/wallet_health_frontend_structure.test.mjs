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

test("Wallet Health renders a v2 safety workspace with local checklist state", () => {
  const playArea = read("apps/wallet-health/src/PlayArea.tsx");
  const styles = read("apps/wallet-health/src/PlayArea.scss");
  const main = read("apps/wallet-health/src/main.tsx");
  const hook = read("apps/wallet-health/src/composables/useHealthScore.ts");
  const analysis = read("apps/wallet-health/src/composables/useWalletAnalysis.ts");
  const messages = read("apps/wallet-health/src/locale/messages.ts");

  assertPlayStage(playArea, "tool", "Wallet Health");
  assertClasses(playArea, [
    "wallet-health-play-area",
    "wallet-health-stage",
    "health-overview",
    "health-scanner-art",
    "health-progress",
    "health-balance-strip",
    "health-checklist-card",
    "health-checklist",
    "health-next-card",
    "health-report",
  ], "Wallet Health");
  assertDispatches(playArea, [
    "copy",
    "toggleChecklist",
  ], "Wallet Health");
  assert.match(
    playArea,
    /dispatch\(isConnected \? "refreshBalances" : "connectWallet"\)/,
  );
  assert.match(main, /checklistItems:\s*health\.checklistItems/);
  assert.match(hook, /checklistRevision\s*=\s*createObservable/);
  assert.match(analysis, /balanceRevision\s*=\s*createObservable/);
  assertAssets(["apps/wallet-health/public/wallet-health-scanner.webp"]);
  assertMessageKeys(messages, [
    "walletHeroTitle",
    "walletHeroSubtitle",
    "connectHint",
    "balanceStripTitle",
    "refreshBalances",
    "recommendationsTitle",
  ], "Wallet Health");
  assert.match(styles, /\.health-overview\s*\{/);
  assert.match(styles, /@media \(max-width:/);
  assertModernTypography(styles, "Wallet Health");
});

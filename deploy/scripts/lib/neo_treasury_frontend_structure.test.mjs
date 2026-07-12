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

test("Neo Treasury renders a v2 payout and watched-wallet dashboard", () => {
  const playArea = read("apps/neo-treasury/src/PlayArea.tsx");
  const styles = read("apps/neo-treasury/src/PlayArea.scss");
  const messages = read("apps/neo-treasury/src/locale/messages.ts");

  assertPlayStage(playArea, "defi", "Neo Treasury");
  assertClasses(playArea, [
    "treasury-play-area",
    "treasury-workspace",
    "treasury-scene",
    "treasury-scene__art",
    "treasury-scene__gauge",
    "treasury-scene__tokens",
    "treasury-drawer",
    "treasury-drawer-tabs",
    "treasury-drawer__payout",
    "treasury-drawer__policy",
  ], "Neo Treasury");
  assertDispatches(playArea, [
    "connectWallet",
    "submitDisbursement",
    "refresh",
  ], "Neo Treasury");
  assert.match(playArea, /normalizeAmountInput\(amount\)\.trim\(\)/);
  assert.match(playArea, /buildTreasuryDisbursementPreview\(\{ asset, amount, recipient, memo \}/);
  assert.match(playArea, /CoinArt size=\{18\} variant="neo"/);
  assert.match(playArea, /CoinArt size=\{18\} variant="gas"/);
  assertAssets(["apps/neo-treasury/public/treasury-vault-desk.webp"]);
  assertMessageKeys(messages, [
    "treasuryFlowTitle",
    "treasuryFlowSubtitle",
    "submitDisbursement",
    "connectWallet",
    "refresh",
    "treasuryReadOnlyRoute",
  ], "Neo Treasury");
  assert.match(styles, /\.treasury-workspace\s*\{/);
  assert.match(styles, /@media \(max-width:/);
  assertModernTypography(styles, "Neo Treasury");
});

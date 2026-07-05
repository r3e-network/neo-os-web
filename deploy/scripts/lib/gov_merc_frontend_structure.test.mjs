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
  const styles = [
    read("apps/gov-merc/src/PlayArea.scss"),
    read("apps/gov-merc/src/components/MercActionCards.scss"),
    read("apps/gov-merc/src/components/MercHeroStats.scss"),
    read("apps/gov-merc/src/components/MercBidsList.scss"),
    read("apps/gov-merc/src/components/MercStakerPanel.scss"),
  ].join("\n");
  const messages = read("apps/gov-merc/src/locale/messages.ts");
  const main = read("apps/gov-merc/src/main.tsx");

  assertPlayStage(playArea, "defi", "Gov Merc");
  assertClasses(playArea, [
    "gov-merc-play-area",
    "merc-scene",
    "merc-stage-art",
    "merc-lane",
    "merc-core",
    "merc-readout",
    "merc-route",
    "merc-drawer",
    "merc-drawer-tabs",
    "merc-drawer__panel",
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
  ], "Gov Merc");
  assert.match(main, /depositAmount/);
  assert.match(main, /bidAmount/);
  assertAssets(["apps/gov-merc/public/gov-merc-market-stage.webp"]);
  assertMessageKeys(messages, [
    "govHeroTitle",
    "govHeroSubtitle",
    "flowDeposit",
    "flowBid",
    "flowInfluence",
    "bidLeaderboard",
    "claimRewards",
  ], "Gov Merc");
  assert.match(styles, /\.merc-scene\s*\{/);
  assert.match(styles, /@media \(max-width:/);
  assertModernTypography(styles, "Gov Merc");
});

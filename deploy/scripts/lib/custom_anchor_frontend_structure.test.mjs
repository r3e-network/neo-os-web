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

test("Custom Anchor renders a v2 anchor workspace with drawer-first advanced controls", () => {
  const playArea = read("apps/custom-anchor/src/PlayArea.tsx");
  const styles = read("apps/custom-anchor/src/PlayArea.scss");
  const messages = read("apps/custom-anchor/src/locale/messages.ts");

  assertPlayStage(playArea, "defi", "Custom Anchor");
  assertClasses(playArea, [
    "custom-anchor-play-area",
    "anchor-workspace",
    "anchor-console",
    "anchor-stake-console",
    "anchor-stake-dial",
    "anchor-stake-presets",
    "anchor-route",
    "anchor-visual",
    "anchor-drawer",
    "anchor-drawer-tabs",
    "anchor-register",
  ], "Custom Anchor");
  assertDispatches(playArea, [
    "refreshAnchor",
    "selectAnchor",
    "discoverAnchors",
    "register",
    "recoverCredit",
  ], "Custom Anchor");
  assert.match(playArea, /runAction\("stake"\)/);
  assert.match(playArea, /runAction\("withdraw"\)/);
  assert.match(playArea, /runAction\("claimRewards"\)/);
  assert.match(playArea, /\{agentCount\}\/21/);
  assertAssets(["apps/custom-anchor/public/custom-anchor-stage.webp"]);
  assertMessageKeys(messages, [
    "title",
    "subtitle",
    "actionPanelTitle",
    "stakeAction",
    "withdrawAction",
    "claimAction",
    "discoverLabel",
    "registerAction",
    "lastTxid",
  ], "Custom Anchor");
  assert.match(styles, /\.anchor-workspace\s*\{[\s\S]*grid-template-columns:/);
  assert.match(styles, /@media \(max-width:/);
  assertModernTypography(styles, "Custom Anchor");
});

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
  const main = read("apps/custom-anchor/src/main.tsx");
  const manifest = read("apps/custom-anchor/src/manifest.ts");
  const production = read("apps/custom-anchor/src/anchor-production.ts");

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
  assert.match(playArea, /components-react\/v2\/OpenUiLite/);
  assert.match(playArea, /components-react\/v2\/PlayStage/);
  assert.match(playArea, /pendingOperation/);
  assert.match(playArea, /recoverPending/);
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
  assert.match(styles, /\.anchor-pending\s*\{/);
  assert.match(styles, /@media \(max-width:/);
  assert.match(manifest, /tabs:\s*\[\]/);
  assert.match(manifest, /stats:\s*\[\]/);
  assert.match(manifest, /operations:\s*\[\]/);
  assert.match(main, /onTransactionSent/);
  assert.match(main, /readAnchorTransactionOutcome/);
  assert.match(production, /CUSTOM_ANCHOR_BINDINGS/);
  assert.match(production, /pendingAnchorEventsMatch/);
  assertModernTypography(styles, "Custom Anchor");
});

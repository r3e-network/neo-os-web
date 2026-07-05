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

const APPS = [
  {
    slug: "trustanchor",
    name: "TrustAnchor",
    root: "trustanchor-play-area",
    scene: "trust-scene",
    stageCard: "trust-stage-card",
    console: "trust-console",
    ticket: "trust-ticket",
    drawer: "trust-drawer",
    asset: "apps/trustanchor/public/trustanchor-stage.webp",
  },
  {
    slug: "profitanchor",
    name: "ProfitAnchor",
    root: "profitanchor-play-area",
    scene: "anchor-scene",
    stageCard: "anchor-vault-card",
    console: "anchor-console",
    ticket: "anchor-ticket",
    drawer: "anchor-drawer",
    asset: "apps/profitanchor/public/profitanchor-stage.webp",
  },
];

test("Anchor staking miniapps use the v2 scene-led staking flow", () => {
  for (const app of APPS) {
    const playArea = read(`apps/${app.slug}/src/PlayArea.tsx`);
    const styles = read(`apps/${app.slug}/src/PlayArea.scss`);
    const messages = read(`apps/${app.slug}/src/locale/messages.ts`);

    assertPlayStage(playArea, "defi", app.name);
    assertClasses(playArea, [
      app.root,
      "tool-scene",
      app.scene,
      app.stageCard,
      app.console,
      app.ticket,
      app.drawer,
    ], app.name);
    assertDispatches(playArea, [
      "stakeNeo",
      "withdrawNeo",
      "claimRewards",
      "recoverNeoCredit",
      "refreshAnchor",
    ], app.name);
    assert.match(playArea, /normalizeWholeNeoAmount/);
    assert.match(playArea, /OpenUiTextField/);
    assertAssets([app.asset, `apps/${app.slug}/public/banner.webp`, `apps/${app.slug}/public/logo.webp`]);
    assertMessageKeys(messages, [
      "heroTitle",
      "heroDescription",
      "stageAria",
      "stakePresetLabel",
      "submitStake",
      "submitWithdraw",
      "submitClaim",
      "lastTxid",
      "actionHistory",
    ], app.name);
    assert.match(styles, /@media \(max-width:/);
    assertModernTypography(styles, app.name);
  }
});

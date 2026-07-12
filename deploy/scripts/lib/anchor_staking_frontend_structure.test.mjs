import assert from "node:assert/strict";
import test from "node:test";
import {
  assertAssets,
  assertClasses,
  assertMessageKeys,
  assertModernTypography,
  assertPlayStage,
  read,
} from "./frontend_structure_helpers.mjs";

const APPS = [
  {
    slug: "trustanchor",
    name: "TrustAnchor",
    category: "governance",
    root: "trustanchor-play-area",
    scene: "trust-product-scene",
    visual: "trust-visual",
    command: "trust-command",
    deck: "trust-amount-deck",
    drawer: "trust-drawer",
    asset: "apps/trustanchor/public/trustanchor-stage.webp",
  },
  {
    slug: "profitanchor",
    name: "ProfitAnchor",
    category: "defi",
    root: "profitanchor-play-area",
    scene: "profit-product-scene",
    visual: "profit-visual",
    command: "profit-command",
    deck: "profit-amount-deck",
    drawer: "profit-drawer",
    asset: "apps/profitanchor/public/profitanchor-stage.webp",
  },
];

test("Anchor user miniapps use a resource-led single-primary production flow", () => {
  for (const app of APPS) {
    const playArea = read(`apps/${app.slug}/src/PlayArea.tsx`);
    const styles = read(`apps/${app.slug}/src/PlayArea.scss`);
    const messages = read(`apps/${app.slug}/src/locale/messages.ts`);
    const manifest = read(`apps/${app.slug}/src/manifest.ts`);
    const main = read(`apps/${app.slug}/src/main.tsx`);
    const runtime = read("apps/trustanchor/src/anchor-runtime.ts");
    const runtimeEntry = read(`apps/${app.slug}/src/anchor-runtime.ts`);

    assertPlayStage(playArea, app.category, app.name);
    assertClasses(playArea, [
      app.root,
      "tool-scene",
      app.scene,
      app.visual,
      app.command,
      app.deck,
      app.drawer,
    ], app.name);
    for (const action of [
      "stakeNeo",
      "withdrawNeo",
      "claimRewards",
      "recoverNeoCredit",
      "refreshAnchor",
      "recoverPendingAnchor",
    ]) {
      assert.match(playArea, new RegExp(`run\\(\\"${action}\\"`), `${app.name} missing ${action}`);
    }
    assert.match(playArea, /OpenUiLite/);
    assert.match(playArea, /components-react\/v2\/PlayStage/);
    assert.doesNotMatch(playArea, /<svg|ParticleBurst|scene__orbit|scene__node/);
    assertAssets([app.asset, `apps/${app.slug}/public/banner.webp`, `apps/${app.slug}/public/logo.webp`]);
    assertMessageKeys(messages, [
      "heroTitle",
      "heroDescription",
      "stageAria",
      "stakePresetLabel",
      "transactionPending",
      "transactionConfirmed",
      "transactionFaulted",
      "bindingModeMismatch",
    ], app.name);
    assert.match(styles, /@media \(max-width:/);
    assert.match(styles, /prefers-reduced-motion/);
    assert.doesNotMatch(styles, /radial-gradient|linear-gradient|backdrop-filter/);
    assertModernTypography(styles, app.name);

    assert.match(manifest, /directPlay:\s*true/);
    assert.doesNotMatch(manifest, /\btabs\s*:|\bstats\s*:|\bsidebar\s*:|\boperations\s*:/);
    assert.match(main, /expectedMode:\s*[12]/);
    assert.match(main, /recoverPendingAnchor/);
    assert.match(runtime, /getapplicationlog/);
    assert.match(runtime, /onTransactionSent/);
    assert.match(runtime, /restorePendingAnchorTransaction/);
    assert.match(runtimeEntry, app.slug === "profitanchor" ? /trustanchor\/src\/anchor-runtime/ : /createAnchorRuntime/);
  }
});

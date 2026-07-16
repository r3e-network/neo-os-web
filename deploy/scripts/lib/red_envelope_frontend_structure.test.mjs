import assert from "node:assert/strict";
import test from "node:test";
import {
  assertAssets,
  assertClasses,
  assertDispatches,
  assertMessageKeys,
  assertModernTypography,
  read,
} from "./frontend_structure_helpers.mjs";

// This test used to read src/PlayArea.tsx, an unmounted DOM component that was
// deleted: main.tsx mounts PhaserPlayArea, so the canvas is what users play.
// It now reads the live wrapper. `assertPlayStage` is deliberately not used —
// it mandates a `drawerToggleLabel=` prop, which is the DOM-era drawer. The
// Phaser-first apps render an in-stage drawer instead and assert the absence of
// that prop (see the sibling *.phaser-playarea tests), so the PlayStage checks
// are spelled out below without it.
test("Red Envelope renders a playful v2 claim and creator workspace", () => {
  const playArea = read("apps/red-envelope/src/PhaserPlayArea.tsx");
  const styles = read("apps/red-envelope/src/PlayArea.scss");
  const main = read("apps/red-envelope/src/main.tsx");
  const messages = read("apps/red-envelope/src/locale/messages.ts");

  assert.match(playArea, /<PlayStage\b/, "Red Envelope should render PlayStage");
  assert.match(playArea, /category="game"/, "Red Envelope should use game category");
  assert.match(playArea, /actions=\{\{/, "Red Envelope should expose stage actions");
  assert.match(playArea, /LazyPhaserGameComponent/, "Red Envelope should render the Phaser canvas");
  assert.doesNotMatch(
    playArea,
    /drawerToggleLabel=/,
    "Red Envelope keeps advanced controls in the in-stage drawer, not a PlayStage toggle",
  );

  assertClasses(playArea, [
    "redenv-play-area",
    "redenv-playstage",
    "redenv-stage-shell",
    "redenv-stage-hud",
    "redenv-canvas-access",
    "redenv-ingame-drawer",
    "redenv-access-actions",
    "redenv-drawer",
    "redenv-drawer-tabs",
    "redenv-drawer__panel",
  ], "Red Envelope");
  assertDispatches(playArea, [
    "claimEnvelope",
    "createEnvelope",
    "reclaimEnvelope",
    "shareEnvelope",
    "withdrawCredit",
    "dismissOverlay",
  ], "Red Envelope");
  assert.match(main, /ctx\.framework\.actions\.register\("claimEnvelope"/);
  assert.match(main, /ctx\.framework\.actions\.register\("createEnvelope"/);
  assertAssets(["apps/red-envelope/public/red-envelope-claim-card.webp"]);
  assertMessageKeys(messages, [
    "redEnvelopeHeroTitle",
    "claimPanelTitle",
    "createPanelTitle",
    "claimNow",
    "createEnvelope",
    "copyShareLink",
    "myEnvelopes",
  ], "Red Envelope");
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assertModernTypography(styles, "Red Envelope");
});

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

test("Red Envelope renders a playful v2 claim and creator workspace", () => {
  const playArea = read("apps/red-envelope/src/PlayArea.tsx");
  const styles = read("apps/red-envelope/src/PlayArea.scss");
  const main = read("apps/red-envelope/src/main.tsx");
  const messages = read("apps/red-envelope/src/locale/messages.ts");

  assertPlayStage(playArea, "game", "Red Envelope");
  assertClasses(playArea, [
    "redenv-play-area",
    "redenv-scene",
    "redenv-scene__packet",
    "redenv-scene__packet-art",
    "redenv-scene__gift",
    "redenv-scene__tabs",
    "redenv-claim-controls",
    "redenv-create-controls",
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
  assert.match(main, /ctx\.registerAction\("claimEnvelope"/);
  assert.match(main, /ctx\.registerAction\("createEnvelope"/);
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
  assert.match(styles, /\.redenv-scene__packet--opening/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assertModernTypography(styles, "Red Envelope");
});

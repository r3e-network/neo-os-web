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

test("Forever Album renders a clean v2 local memory workbench", () => {
  const playArea = read("apps/forever-album/src/PlayArea.tsx");
  const styles = read("apps/forever-album/src/PlayArea.scss");
  const main = read("apps/forever-album/src/main.tsx");
  const messages = read("apps/forever-album/src/locale/messages.ts");

  assertPlayStage(playArea, "nft", "Forever Album");
  assertClasses(playArea, [
    "album-play-area",
    "album-stage-stack",
    "album-workbench",
    "album-workbench__memory-card",
    "album-workbench__page",
    "album-workbench__frames",
    "album-import",
    "album-privacy-toggle",
    "album-gallery",
    "album-modal",
  ], "Forever Album");
  assertDispatches(playArea, [
    "addFiles",
    "uploadPhotos",
    "removeImage",
    "viewPhoto",
    "refreshPhotos",
    "closeViewer",
    "handleDecrypt",
  ], "Forever Album");
  assert.match(playArea, /type="file"[\s\S]*accept="image\/\*"/);
  assert.match(playArea, /type="checkbox"[\s\S]*checked=\{isEncrypted\}/);
  assert.match(main, /ctx\.registerAction\("refreshPhotos"/);
  assertAssets(["apps/forever-album/public/forever-album-memory-stage.webp"]);
  assertMessageKeys(messages, [
    "vaultHeroTitle",
    "vaultHeroSubtitle",
    "refreshAlbum",
    "vaultRouteTitle",
    "vaultPrivacyTitle",
    "stageEmptyTitle",
    "stageReadyTitle",
    "stageSealingTitle",
  ], "Forever Album");
  assert.match(styles, /\.album-workbench__page\s*\{/);
  assert.match(styles, /@media \(max-width:/);
  assert.doesNotMatch(styles, /📷|📎|🔒/);
  assert.doesNotMatch(styles, /radial-gradient\(/);
  assertModernTypography(styles, "Forever Album");
});

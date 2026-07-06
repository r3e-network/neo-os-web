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

test("Neo Sign Anything renders a v2 signature desk with proof drawer", () => {
  const playArea = read("apps/neo-sign-anything/src/PlayArea.tsx");
  const styles = read("apps/neo-sign-anything/src/PlayArea.scss");
  const main = read("apps/neo-sign-anything/src/main.tsx");
  const messages = read("apps/neo-sign-anything/src/locale/messages.ts");

  assertPlayStage(playArea, "tool", "Neo Sign Anything");
  assertClasses(playArea, [
    "tool-play-area",
    "sign-desk",
    "sign-desk__workspace",
    "sign-desk__paper",
    "sign-desk__payload-sheet",
    "sign-desk__proof",
    "sign-desk__photo",
    "sign-desk__route",
    "sign-details",
    "sign-details__tabs",
  ], "Neo Sign Anything");
  assertDispatches(playArea, [
    "loadFileDigest",
    "copyToClipboard",
    "signMessage",
    "broadcastMessage",
  ], "Neo Sign Anything");
  assert.match(main, /ctx\.framework\.actions\.register\("signMessage"/);
  assert.match(main, /ctx\.framework\.actions\.register\("broadcastMessage"/);
  assertAssets(["apps/neo-sign-anything/public/signature-desk.webp"]);
  assertMessageKeys(messages, [
    "signHeroKicker",
    "signHeroTitle",
    "messageLabel",
    "signatureResult",
    "broadcastResult",
    "proofDetails",
    "copyVerifyBundle",
  ], "Neo Sign Anything");
  assert.match(styles, /\.sign-desk\s*\{/);
  assert.match(styles, /@media \(max-width:/);
  assertModernTypography(styles, "Neo Sign Anything");
});

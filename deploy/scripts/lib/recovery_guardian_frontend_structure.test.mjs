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

test("Recovery Guardian exposes a guarded v2 recovery workspace", () => {
  const playArea = read("apps/recovery-guardian/src/PlayArea.tsx");
  const styles = read("apps/recovery-guardian/src/PlayArea.scss");
  const main = read("apps/recovery-guardian/src/main.tsx");
  const messages = read("apps/recovery-guardian/src/locale/messages.ts");

  assertPlayStage(playArea, "tool", "Recovery Guardian");
  assertClasses(playArea, [
    "recovery-guardian-play-area",
    "guardian-scene",
    "guardian-command-panel",
    "guardian-account-pass",
    "guardian-route",
    "guardian-state-card",
    "guardian-pass-panel",
    "guardian-command-art",
    "guardian-recovery-pass",
    "guardian-drawer",
    "guardian-drawer__panel",
  ], "Recovery Guardian");
  assertDispatches(playArea, [
    "openRecoveryPreviewLink",
    "queryGuardianState",
    "openIdentityWorkspace",
    "openRecoveryDocs",
    "copyRecoveryPreviewLink",
    "copyRecoveryCredentialLink",
  ], "Recovery Guardian");
  assert.match(main, /recoveryNewOwner\.get\(\)/);
  assert.match(main, /recoveryExpiryMinutes\.get\(\)/);
  assertAssets(["apps/recovery-guardian/public/recovery-command-center.webp"]);
  assertMessageKeys(messages, [
    "guardianHeroTitle",
    "guardianFlowPrepare",
    "guardianPrepareShort",
    "queryBlocked",
    "recoveryLinkBlocked",
  ], "Recovery Guardian");
  assert.match(styles, /\.guardian-scene\s*\{/);
  assert.match(styles, /@media \(max-width:/);
  assertModernTypography(styles, "Recovery Guardian");
});

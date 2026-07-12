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

test("Recovery Guardian exposes a state-driven production recovery journey", () => {
  const playArea = read("apps/recovery-guardian/src/PlayArea.tsx");
  const styles = read("apps/recovery-guardian/src/PlayArea.scss");
  const main = read("apps/recovery-guardian/src/main.tsx");
  const domain = read("apps/recovery-guardian/src/recovery-guardian.ts");
  const messages = read("apps/recovery-guardian/src/locale/messages.ts");
  const manifest = read("apps/recovery-guardian/src/manifest.ts");

  assertPlayStage(playArea, "tool", "Recovery Guardian");
  assertClasses(playArea, [
    "recovery-guardian-play-area",
    "guardian-app",
    "guardian-console",
    "guardian-lookup",
    "guardian-journey",
    "guardian-status-card",
    "guardian-quorum-card",
    "guardian-command-art",
    "guardian-details",
  ], "Recovery Guardian");
  assertDispatches(playArea, [
    "loadProfile",
    "continueRecovery",
    "openAAWorkspace",
    "reviewSetupPackage",
    "submitSetup",
    "submitFinalize",
    "submitCancel",
    "recoverPendingWrite",
    "refreshRecoveryStorage",
  ], "Recovery Guardian");
  assertAssets(["apps/recovery-guardian/public/recovery-command-center.webp"]);
  assertMessageKeys(messages, [
    "guardianHeroTitle",
    "journeyProtected",
    "journeyCollecting",
    "journeyWaiting",
    "journeyReady",
    "journeySetupUpgradeRequired",
    "setupActivationPaused",
    "setupContractUpgradeRequired",
    "publicSetupPackage",
    "finalizeRecovery",
  ], "Recovery Guardian");
  assert.match(main, /useRecoveryGuardian/);
  assert.match(domain, /getPendingRecovery/);
  assert.match(domain, /RecoveryFinalized/);
  assert.match(domain, /RecoveryCancelled/);
  assert.match(domain, /RecoverySetup/);
  assert.match(domain, /FIRST_TIME_RECOVERY_SETUP_AVAILABLE\s*=\s*false/);
  assert.match(domain, /getapplicationlog/);
  assert.match(domain, /recoveryReadbackMismatch/);
  assert.match(manifest, /shell:\s*"launcher"/);
  assert.match(manifest, /operations:\s*\[\]/);
  assert.match(styles, /\.guardian-app__grid\s*\{/);
  assert.match(styles, /@media \(max-width:/);
  assertModernTypography(styles, "Recovery Guardian");
});

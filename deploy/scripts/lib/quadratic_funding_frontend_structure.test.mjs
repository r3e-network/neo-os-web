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

test("Quadratic Funding renders a v2 donor desk with complete grant actions", () => {
  const playArea = read("apps/quadratic-funding/src/PlayArea.tsx");
  const styles = read("apps/quadratic-funding/src/PlayArea.scss");
  const main = read("apps/quadratic-funding/src/main.tsx");
  const page = read("apps/quadratic-funding/src/pages/index/composables/useQuadraticFundingPage.ts");
  const messages = read("apps/quadratic-funding/src/locale/messages.ts");

  assertPlayStage(playArea, "defi", "Quadratic Funding");
  assertClasses(playArea, [
    "qf-play-area",
    "qf-setup-card",
    "qf-scene",
    "qf-scene__desk",
    "qf-scene__pool",
    "qf-controls",
    "qf-round-strip",
    "qf-project-board",
    "qf-pledge",
    "qf-drawer-shell",
    "qf-drawer-panel",
  ], "Quadratic Funding");
  assertDispatches(playArea, [
    "refreshRounds",
    "selectRound",
    "finalizeSuggested",
    "claimUnused",
    "cancelRound",
  ], "Quadratic Funding");
  assert.match(playArea, /dispatch\("contribute"/);
  assert.match(playArea, /dispatch\("registerProject"/);
  assert.match(playArea, /memo: contributionMemo/);
  assert.match(main, /ctx\.registerAction\("selectRound"/);
  assert.match(page, /const handleSelectRound = async/);
  assertAssets(["apps/quadratic-funding/public/funding-desk.webp"]);
  assertMessageKeys(messages, [
    "qfHeroTitle",
    "qfHeroSubtitle",
    "qfPrimaryAction",
    "qfRefreshAction",
    "qfDonorDeskSubtitle",
    "registerProject",
    "claimProject",
  ], "Quadratic Funding");
  assert.match(styles, /\.qf-scene\s*\{/);
  assert.match(styles, /@media \(max-width:/);
  assertModernTypography(styles, "Quadratic Funding");
});

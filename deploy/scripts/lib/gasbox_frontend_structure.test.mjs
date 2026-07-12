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

test("GasBox renders a game-like v2 capsule machine with drawer studio controls", () => {
  const playArea = read("apps/gasbox/src/PlayArea.tsx");
  const styles = read("apps/gasbox/src/PlayArea.scss");
  const messages = read("apps/gasbox/src/locale/messages.ts");
  const main = read("apps/gasbox/src/main.tsx");

  assertPlayStage(playArea, "game", "GasBox");
  assertClasses(playArea, [
    "gasbox-play-area",
    "gasbox-stage-stack",
    "gasbox-scene",
    "gasbox-scene__cabinet",
    "gasbox-scene__machine-art",
    "gasbox-scene__capsule-track",
    "gasbox-scene__chute",
    "gasbox-scene__result",
    "gasbox-controls",
    "gasbox-machine-chip",
    "gasbox-creator-panel",
  ], "GasBox");
  assertDispatches(playArea, [
    "pull",
    "reveal",
    "refreshMachines",
    "withdrawRevenue",
    "selectMachine",
  ], "GasBox");
  assert.match(playArea, /dispatch\(isConnected \? "openStudio" : "connectWallet"\)/);
  assert.match(main, /ctx\.framework\.actions\.register\("refreshMachines"/);
  assert.match(main, /gasbox\.loadAll\(\)/);
  assertAssets([
    "apps/gasbox/public/gasbox-capsule-machine.webp",
    "apps/gasbox/public/gasbox-prize-capsule.webp",
  ]);
  assertMessageKeys(messages, [
    "title",
    "docSubtitle",
    "allMachines",
    "tapToPlay",
    "openStudio",
    "create",
  ], "GasBox");
  assert.match(styles, /\.gasbox-scene__capsule--rolling/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assertModernTypography(styles, "GasBox");
});

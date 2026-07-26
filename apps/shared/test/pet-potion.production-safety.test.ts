import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { manifest } from "../../pet-potion/src/manifest";
import { applyCare } from "../../pet-potion/src/logic/guest-engine";
import { SETTLEMENT_GRACE_MS } from "../../pet-potion/src/logic/game-rules";

function appsRoot(): string {
  return process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
}

function source(relative: string): string {
  return fs.readFileSync(path.join(appsRoot(), "pet-potion", relative), "utf8");
}

describe("pet-potion production trust boundary", () => {
  it("publishes free local play while new wallet-funded runs are double-disabled", () => {
    expect(manifest.supportsGuest).toBe(true);
    expect(manifest.supportsGameFi).toBe(false);
    expect(manifest.gamePage?.modes).toEqual({ guest: true, gamefi: false });
    expect(manifest.operations).toEqual([]);
    expect(manifest.features?.walletRequired).toBe(false);
    expect(manifest.permissions).toEqual({
      payments: false,
      randomness: false,
      compute: false,
      oracle: false,
    });

    const main = source("src/main.tsx");
    const paidGuard = main.indexOf("if (!NEW_PAID_RUNS_ENABLED)");
    const paidStart = main.indexOf("const started = await startRewardGame", paidGuard);
    expect(main).toContain("export const NEW_PAID_RUNS_ENABLED = false");
    expect(paidGuard).toBeGreaterThan(-1);
    expect(paidStart).toBeGreaterThan(paidGuard);

    const published = JSON.parse(source("neo-manifest.json")) as {
      operation_panel?: { operations?: unknown[] };
      permissions?: string[];
      platform?: { transactions?: boolean };
      technologies?: { oracle?: { enabled?: boolean }; tee?: { enabled?: boolean } };
    };
    expect(published.operation_panel?.operations).toEqual([]);
    expect(published.permissions).toEqual([]);
    expect(published.platform?.transactions).toBe(false);
    expect(published.technologies?.oracle?.enabled).toBe(false);
    expect(published.technologies?.tee?.enabled).toBe(false);
  });

  it("keeps historical recovery exact and never turns unknown settlement into success", () => {
    const main = source("src/main.tsx");
    const submitBlock = main.slice(
      main.indexOf('app.actions.register("submitSolution"'),
      main.indexOf('app.actions.register("recoverGame"'),
    );

    expect(main).toContain("gameMatchesIdentity(snapshot.raw, gameId, playerHash)");
    expect(main).toContain("startResultMatchesIntent");
    expect(main).toContain('app.actions.register("recoverGame"');
    expect(main).toContain("await resumeSession(gameId, snapshot.difficulty)");
    expect(main).toContain("rewardGame.storage.load(gameId)");
    expect(main).toContain("identityChanged");
    expect(main).toContain("walletIdentity");
    expect(main).toContain("inputSyncFailed.set(true)");
    expect(main).toContain("inputSyncFailed.get()");
    expect(submitBlock).toContain('obs.gameStatus.set("unknown")');
    expect(submitBlock).not.toContain('settled.status === "unknown" ? "solved"');
  });

  it("matches the reviewed care state machine and requires a complete brewed recipe", () => {
    expect(applyCare({ happiness: 20, hunger: 40, energy: 60 }, "feed"))
      .toEqual({ happiness: 28, hunger: 70, energy: 60 });
    expect(applyCare({ happiness: 20, hunger: 40, energy: 60 }, "play"))
      .toEqual({ happiness: 32, hunger: 20, energy: 40 });
    expect(applyCare({ happiness: 20, hunger: 40, energy: 60 }, "pet"))
      .toEqual({ happiness: 24, hunger: 40, energy: 57 });
    expect(applyCare({ happiness: 20, hunger: 40, energy: 60 }, "rest"))
      .toEqual({ happiness: 22, hunger: 30, energy: 90 });

    const guest = source("src/logic/guest-engine.ts");
    const rules = source("src/logic/pet-engine.ts");
    expect(rules).toContain("const START: PetStats = { happiness: 20, hunger: 40, energy: 60 }");
    expect(rules).toContain("export function stepPet");
    expect(guest).toContain("import { newPet, stepPet");
    expect(guest).toContain("recipeReady(ingredientCounts.get())");
    expect(guest).toContain("!potionBrewed.get() || petHappiness.get() < target");
    expect(guest).toContain("if (won) await submitScore(achieved)");
    expect(guest).toContain('GUEST_ACTIVE_RUN_KEY = "guest:pet-potion:active-run:v1"');
    expect(guest).toContain("saveActiveRun()");
    expect(guest).toContain("restoreActiveRun()");
    expect(guest).toContain("moveCapReached");
    expect(guest).toContain("obs.myHistory.set(nextProfile.history)");
  });

  it("mirrors the strict contract recovery grace before exposing expiry", () => {
    expect(SETTLEMENT_GRACE_MS).toBe(600_000);
    const main = source("src/main.tsx");
    const wrapper = source("src/PhaserPlayArea.tsx");
    const scene = source("src/scenes/PetPotionScene.ts");
    expect(main).toContain("canExpireAfterGrace(obs.deadline.get())");
    expect(wrapper).toContain("deadline + SETTLEMENT_GRACE_MS");
    expect(scene).toContain('this.str("gameStatus", "idle") === "unknown"');
    expect(scene).toContain("nowMs > releaseAt");
  });

  it("supports short screens, semantic controls, reduced motion, and explicit cleanup", () => {
    const wrapper = source("src/PhaserPlayArea.tsx");
    const styles = source("src/PlayArea.scss");
    const scene = source("src/scenes/PetPotionScene.ts");

    expect(wrapper).toContain("pp-a11y-layer");
    expect(wrapper).toContain('role="radiogroup"');
    expect(wrapper).toContain('role="radio"');
    expect(wrapper).toContain('role="dialog"');
    expect(wrapper).toContain('aria-live="polite"');
    expect(wrapper).toContain("enableSoundLabel={t(\"enableGameSound\")}");
    expect(styles).toContain("--phaser-mobile-height-ratio: 1.381");
    expect(styles).toContain("--phaser-mobile-bottom-reserve: 112");
    expect(styles).not.toContain("min-height: 600px");
    expect(scene).toContain("Phaser.Scenes.Events.SHUTDOWN");
    expect(scene).toContain("protected onReducedMotionChange(enabled: boolean)");
    expect(scene).toContain("this.tweens.killTweensOf");
    expect(scene).toContain('this.input.off("pointerdown", this.unlockAudio, this)');
    expect(wrapper).toContain("timeUp || moveCapReached || potionBrewed");
    expect(scene).toContain("moveCapReached");
  });
});

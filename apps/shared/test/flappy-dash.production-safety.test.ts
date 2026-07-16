import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { manifest } from "../../flappy-dash/src/manifest";
import { statusOf } from "../../flappy-dash/src/logic/game-rules";

function appsRoot(): string {
  return process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
}

function source(relative: string): string {
  return fs.readFileSync(path.join(appsRoot(), "flappy-dash", relative), "utf8");
}

describe("flappy-dash production trust boundary", () => {
  it("keeps the wallet-backed route hidden until live replay and contract timing are validated", () => {
    expect(manifest.gamePage?.modes).toEqual({ guest: true, gamefi: false });
    expect(manifest.supportsGuest).toBe(true);
    expect(manifest.supportsGameFi).toBe(false);
    expect(manifest.operations).toEqual([]);
    expect(manifest.features?.walletRequired).toBe(false);
    expect(manifest.features?.chainWarning).toBe(false);
    expect(manifest.permissions).toEqual({
      payments: false,
      randomness: false,
      compute: false,
      oracle: false,
    });

    const main = source("src/main.tsx");
    expect(main).toContain('manifest.supportsGameFi === false && !app.mode.isGuest()');
    expect(main).toContain('app.mode.set("guest")');

    const published = JSON.parse(source("neo-manifest.json")) as {
      permissions?: string[];
      platform?: { transactions?: boolean };
      technologies?: {
        oracle?: { enabled?: boolean };
        tee?: { enabled?: boolean };
      };
    };
    expect(published.permissions).toEqual([]);
    expect(published.platform?.transactions).toBe(false);
    expect(published.technologies?.oracle?.enabled).toBe(false);
    expect(published.technologies?.tee?.enabled).toBe(false);
  });

  it("caps fixed-step catch-up after a suspended tab resumes", () => {
    const scene = source("src/scenes/FlappyScene.ts");

    expect(scene).toContain("MAX_CATCH_UP_STEPS = 6");
    expect(scene).toContain("Phaser.Math.Clamp(delta, 0, FIXED_STEP_MS * MAX_CATCH_UP_STEPS)");
    expect(scene).toContain("catchUpSteps < MAX_CATCH_UP_STEPS");
  });

  it("expires a crashed run at its session deadline without another retry gesture", () => {
    const scene = source("src/scenes/FlappyScene.ts");
    const deadlineCheck = scene.indexOf("if (this.expireAtDeadlineIfNeeded()) return;");
    const playingGuard = scene.indexOf('if (this.localPhase !== "playing" || !this.flappyState) return;');

    expect(deadlineCheck).toBeGreaterThan(-1);
    expect(deadlineCheck).toBeLessThan(playingGuard);
    expect(scene).toContain("private expireAtDeadlineIfNeeded(): boolean");
    expect(scene).toContain('if (this.isGuestMode()) this.dispatch("expireGame")');
    expect(scene).toContain('this.showResultOverlay("expired")');
  });

  it("separates real flap operations from UI-only score synchronization", () => {
    const scene = source("src/scenes/FlappyScene.ts");
    const main = source("src/main.tsx");
    const syncBlock = main.slice(
      main.indexOf('app.actions.register("syncScore"'),
      main.indexOf('app.actions.register("submitSolution"'),
    );

    expect(scene).toContain('this.dispatch("recordFlap"');
    expect(scene).toContain('this.dispatch("syncScore"');
    expect(main).toContain('await reward.recordOp(session, { type: "flap" })');
    expect(syncBlock).toContain("pipesPassed.set");
    expect(syncBlock).not.toContain("reward.recordOp");
  });

  it("never presents a placeholder digest as a cryptographic settlement proof", () => {
    const engine = source("src/logic/flappy-engine.ts");
    // Was src/PlayArea.tsx, an unmounted DOM component that has been deleted.
    // The guard belongs on the surface users actually reach.
    const playSurface = source("src/PhaserPlayArea.tsx");
    const scene = source("src/scenes/FlappyScene.ts");

    expect(engine).not.toContain("computeStateHash");
    expect(engine).not.toContain("simulating SHA");
    expect(playSurface).not.toContain("computeStateHash");
    expect(scene).not.toContain("computeStateHash");
  });

  it("keeps wallet connection and entry payment as two explicit gestures", () => {
    const scene = source("src/scenes/FlappyScene.ts");
    const main = source("src/main.tsx");

    expect(main).toContain('app.actions.register("connectWallet"');
    expect(scene).toContain('this.dispatch("connectWallet")');
    expect(scene).toContain('this.dispatch("startGame", { difficulty: this.pickedDifficulty })');
    expect(scene.indexOf('this.dispatch("connectWallet")')).toBeLessThan(
      scene.indexOf('this.dispatch("startGame", { difficulty: this.pickedDifficulty })'),
    );
  });

  it("keeps broadcast settlement recoverable until a terminal chain snapshot", () => {
    const main = source("src/main.tsx");
    const playArea = source("src/PhaserPlayArea.tsx");
    const submitBlock = main.slice(
      main.indexOf('app.actions.register("submitSolution"'),
      main.indexOf('app.actions.register("refreshGame"'),
    );
    const pendingBlock = submitBlock.slice(
      submitBlock.indexOf('if (settled.status === "unknown")'),
      submitBlock.indexOf("const snapshot"),
    );

    expect(statusOf(5)).toBe("unknown");
    expect(statusOf(99)).toBe("unknown");
    expect(submitBlock).toContain('if (settled.status === "unknown")');
    expect(pendingBlock).not.toContain('obs.activeGameId.set("0")');
    expect(main).toContain('app.actions.register("refreshGame"');
    expect(playArea).toContain('gameStatus === "unknown"');
    expect(playArea).toContain('runAction("refreshGame")');
  });
});

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { manifest } from "../../jump-rush/src/manifest";
import { SETTLE_GRACE_MS } from "../../jump-rush/src/logic/game-rules";

function appsRoot(): string {
  return process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
}

function source(relative: string): string {
  return fs.readFileSync(path.join(appsRoot(), "jump-rush", relative), "utf8");
}

describe("jump-rush production trust boundary", () => {
  it("publishes only free local play until live GameFi validation completes", () => {
    expect(manifest.supportsGuest).toBe(true);
    expect(manifest.supportsGameFi).toBe(false);
    expect(manifest.gamePage?.modes).toEqual({ guest: true, gamefi: false });
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
    expect(main).toContain("manifest.supportsGameFi === false && !app.mode.isGuest()");
    expect(main).toContain('app.mode.set("guest")');
    expect(main).toContain("const GAMEFI_NEW_ENTRIES_ENABLED = false");
    expect(main).toContain("if (!GAMEFI_NEW_ENTRIES_ENABLED)");

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

  it("keeps the scene, client, and latent TEE operation on normalized charge level", () => {
    const main = source("src/main.tsx");
    const scene = source("src/scenes/JumpRushScene.ts");

    expect(main).toContain('{ type: "jump"; chargeLevel: number }');
    expect(main).not.toContain('{ type: "jump"; chargeMs: number }');
    expect(main).toContain('await sendOp({ type: "jump", chargeLevel })');
    expect(main).toContain("inputSyncFailed.set(true)");
    expect(scene).toContain("evaluateJumpLevel(chargeLevel, to.gap, to.width)");
    expect(scene).toContain("perfect:       evaluation.perfect");
    expect(scene).toContain('this.bool("inputSyncFailed")');
  });

  it("renders authoritative platform objects instead of inventing widths from gap numbers", () => {
    const main = source("src/main.tsx");
    const scene = source("src/scenes/JumpRushScene.ts");

    expect(main).toContain("started.view.platforms");
    expect(main).toContain("platformsView.set(platforms)");
    expect(scene).toContain('this.val<Platform[]>("platformsView")');
    expect(scene).toContain("Number(raw.width)");
    expect(scene).not.toContain("widthSeed");
  });

  it("uses the shared PlatformGame Solved slots without inventing undo data", () => {
    const main = source("src/main.tsx");

    expect(main).toContain("jumps: ruleOf(difficulty).targetJumps");
    expect(main).toContain("perfects: null");
    expect(main).toContain("{ solvedPayout: 5, totalWon: 6, undos: 7 }");
    expect(main).not.toContain("app.chain.events(\"Solved\"");
  });

  it("mirrors contract recovery windows and blocks premature expiry", () => {
    expect(SETTLE_GRACE_MS).toBe(600_000);
    const main = source("src/main.tsx");
    const wrapper = source("src/PhaserPlayArea.tsx");
    const scene = source("src/scenes/JumpRushScene.ts");

    expect(main).toContain("deadline.get() + SETTLE_GRACE_MS");
    expect(main).not.toContain("DEAL_TTL_MS");
    expect(wrapper).toContain("deadline + SETTLE_GRACE_MS");
    expect(scene).toContain('this.bool("canReleaseRun")');
  });

  it("supports short screens, reduced motion, semantic controls, and explicit cleanup", () => {
    const wrapper = source("src/PhaserPlayArea.tsx");
    const styles = source("src/PlayArea.scss");
    const scene = source("src/scenes/JumpRushScene.ts");

    expect(wrapper).toContain("jr-a11y-layer");
    expect(wrapper).toContain('type="range"');
    expect(wrapper).toContain('role="radiogroup"');
    // The countdown clock lives in the shared useNowMs hook now.
    expect(wrapper).toContain("useNowMs(");
    expect(styles).toContain("--phaser-mobile-height-ratio: 1.45");
    expect(styles).toContain("--phaser-mobile-bottom-reserve: 112");
    expect(styles).not.toContain("min-height: 620px");
    expect(scene).toContain("Phaser.Scenes.Events.SHUTDOWN");
    expect(scene).toContain("this.tweens.killTweensOf(target)");
    expect(scene).toContain("this.spaceKey?.off");
    expect(scene).toContain('this.input.off("pointerupoutside"');
    expect(scene).toContain('window.removeEventListener("blur", this.onChargeCancel)');
  });

  it("recovers validated local runs without falling back to chain state or weak randomness", () => {
    const guest = source("src/logic/guest-engine.ts");
    const scene = source("src/scenes/JumpRushScene.ts");

    expect(guest).toContain('const GUEST_ACTIVE_RUN_KEY = "guest:active-run/v1"');
    expect(guest).toContain("parseStoredRun");
    expect(guest).toContain("restoreActiveRun");
    expect(guest).toContain("secure local randomness unavailable");
    expect(guest).not.toContain("Math.random");
    expect(scene).toContain('this.num("currentPlatform", 0)');
    expect(scene).toContain('this.bool("missedPlatform")');
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { manifest } from "../../curve-arrow/src/manifest";
import {
  SETTLEMENT_GRACE_MS,
  canExpireAfterGrace,
  statusOf,
} from "../../curve-arrow/src/logic/game-rules";

const PLATFORM_REGISTRY_TESTNET = "0x5ec036efaa1fbde3ff7d1587d790768bc098cb2b";
const PLATFORM_GAME_TESTNET = "0xc75b181b4561462903bb27d8d9e0b32b637bec12";

function appFile(relativePath: string): string {
  const sharedRoot = process.cwd().endsWith("/apps/shared")
    ? process.cwd()
    : resolve(process.cwd(), "apps/shared");
  return readFileSync(resolve(sharedRoot, `../curve-arrow/${relativePath}`), "utf8");
}

describe("curve-arrow production safety", () => {
  it("advertises only the complete free-play surface while the contract is undeployed", () => {
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

    const neo = JSON.parse(appFile("neo-manifest.json")) as {
      contracts?: Record<string, string>;
      moduleId?: string;
      mode?: string;
      registry?: string;
      engine?: string;
      operation_panel: { operations: unknown[] };
      permissions: unknown[];
      platform: { transactions: boolean };
      technologies: { oracle: { enabled: boolean }; tee: { enabled: boolean } };
    };
    expect(neo.contracts).toBeUndefined();
    expect(neo.moduleId).toBe("platform-game");
    expect(neo.mode).toBe("shared");
    expect(neo.registry).toBe(PLATFORM_REGISTRY_TESTNET);
    expect(neo.engine).toBe(PLATFORM_GAME_TESTNET);
    expect(neo.operation_panel.operations).toEqual([]);
    expect(neo.permissions).toEqual([]);
    expect(neo.platform.transactions).toBe(false);
    expect(neo.technologies.oracle.enabled).toBe(false);
    expect(neo.technologies.tee.enabled).toBe(false);
  });

  it("keeps runtime paid starts fail-closed but preserves identity-bound recovery", () => {
    const source = appFile("src/main.tsx");
    expect(source).toContain("export const NEW_PAID_RUNS_ENABLED = false");
    expect(source).toContain("if (!NEW_PAID_RUNS_ENABLED)");
    expect(source).toContain("gameMatchesIdentity");
    expect(source).toContain("startResultMatchesIntent");
    expect(source).toContain("await inputQueue");
    expect(source).toContain("inputSyncFailed.set(true)");
    expect(source).toContain("app.chain.waitForState(");
    expect(source).toContain("canExpireAfterGrace(obs.deadline.get())");
  });

  it("maps settling to an unknown recoverable state and expires only after strict grace", () => {
    const deadline = 1_000_000;
    expect(statusOf(5)).toBe("unknown");
    expect(statusOf(99)).toBe("unknown");
    expect(canExpireAfterGrace(deadline, deadline + SETTLEMENT_GRACE_MS)).toBe(false);
    expect(canExpireAfterGrace(deadline, deadline + SETTLEMENT_GRACE_MS + 1)).toBe(true);
  });

  it("keeps the playable scene resource-led, recoverable, and input-safe", () => {
    const scene = appFile("src/scenes/CurveArrowScene.ts");
    const wrapper = appFile("src/PhaserPlayArea.tsx");
    expect(scene).toContain("./art/range-sky.webp");
    expect(scene).toContain("./art/bow.webp");
    expect(scene).toContain("./art/arrow.webp");
    expect(scene).toContain("applyShot(this.run, this.levels, holds)");
    expect(scene).toContain("controlPressNonce");
    expect(scene).toContain("cleanupInput");
    expect(scene).toContain("onReducedMotionChange");
    expect(wrapper).toContain("LazyPhaserGameComponent");
    expect(wrapper).toContain("./art/reward-medal.webp");
    expect(wrapper).toContain("curve-arrow-route-controls");
    expect(wrapper).toContain("curve-arrow-hold-control");
    expect(wrapper).toContain('role="dialog"');
    expect(wrapper).toContain('aria-live="polite"');
  });
});

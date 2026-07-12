import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../..");
const read = (path: string) => readFileSync(resolve(repoRoot, path), "utf8");

describe("snake-bounty production safety", () => {
  it("keeps new paid starts closed in runtime and both public manifests", () => {
    const main = read("apps/snake-bounty/src/main.tsx");
    const sourceManifest = read("apps/snake-bounty/src/manifest.ts");
    const neoManifest = JSON.parse(read("apps/snake-bounty/neo-manifest.json")) as {
      operation_panel: { operations: unknown[] };
      permissions: unknown[];
      platform: { transactions: boolean };
      technologies: { oracle: { enabled: boolean }; tee: { enabled: boolean } };
    };

    expect(main).toContain("export const NEW_PAID_RUNS_ENABLED = false");
    expect(main).toContain("if (!NEW_PAID_RUNS_ENABLED)");
    expect(sourceManifest).toContain("supportsGuest: true");
    expect(sourceManifest).toContain("supportsGameFi: false");
    expect(sourceManifest).toContain("operations: []");
    expect(sourceManifest).toContain('heroBadgeKey: "guestRewardBadge"');
    expect(sourceManifest).toContain('contentKey: "guestRulesCopy"');
    expect(sourceManifest).toContain('contentKey: "localFairnessCopy"');
    expect(sourceManifest).toContain("payments: false");
    expect(sourceManifest).toContain("oracle: false");
    expect(neoManifest.operation_panel.operations).toEqual([]);
    expect(neoManifest.permissions).toEqual([]);
    expect(neoManifest.platform.transactions).toBe(false);
    expect(neoManifest.technologies.oracle.enabled).toBe(false);
    expect(neoManifest.technologies.tee.enabled).toBe(false);
  });

  it("records every applied movement tick and fail-stops a broken TEE stream", () => {
    const scene = read("apps/snake-bounty/src/scenes/SnakeScene.ts");
    const main = read("apps/snake-bounty/src/main.tsx");
    const tick = scene.slice(scene.indexOf("private onGameTick"), scene.indexOf("// ── Clock timer"));
    const steer = scene.slice(scene.indexOf("private tryQueueDirection"), scene.indexOf("// ── Responsive resize"));

    expect(tick.indexOf("this.snake = step")).toBeGreaterThanOrEqual(0);
    expect(tick.indexOf('this.dispatch("recordMove"')).toBeGreaterThan(tick.indexOf("this.snake = step"));
    expect(tick).toContain("length: snakeLength(this.snake)");
    expect(tick).toContain("dead: this.snake.dead");
    expect(tick).toContain('if (this.isGuest()) this.dispatch("submitSolution")');
    expect(steer).not.toContain('this.dispatch("recordMove"');
    expect(scene).toContain("this.boardInvalid = true");
    expect(scene).toContain('this.txt("ovBoardInvalidTitle"');
    expect(scene).toContain('this.str("gameStatus", "") === "dealt" && this.targetReached');
    expect(main).toContain("inputQueue = task");
    expect(main).toContain("inputSyncFailed.set(true)");
    expect(main).toContain("await inputQueue");
  });

  it("retains uncertain settlements and enforces the contract expiry grace", () => {
    const main = read("apps/snake-bounty/src/main.tsx");
    expect(main).toContain('obs.gameStatus.set("unknown")');
    expect(main).toContain('obs.lastStatus.set(ctx.t("statusSettlementPending"))');
    expect(main).toContain("canExpireAfterGrace(obs.deadline.get())");
    expect(main).toContain("app.chain.waitForState");
    expect(main).toContain("gameMatchesIdentity(snapshot.raw, gameId, playerHash)");
  });

  it("does not leak a recoverable run across wallet identities", () => {
    const main = read("apps/snake-bounty/src/main.tsx");
    expect(main).toContain("if (address) walletIdentity = address");
    expect(main).toContain("if (!address && !app.mode.isGuest() && recoverable)");
    expect(main).toContain("} else if (identityChanged && !app.mode.isGuest()) {");
    expect(main).toContain('obs.activeGameId.set("0")');
    expect(main).toContain('obs.gameStatus.set("idle")');
  });

  it("has semantic touch controls and a short-screen mobile canvas budget", () => {
    const playArea = read("apps/snake-bounty/src/PhaserPlayArea.tsx");
    const styles = read("apps/snake-bounty/src/PhaserPlayArea.scss");
    expect(playArea).toContain('role="group"');
    expect(playArea).toContain('aria-label={t("touchControlsLabel")}');
    expect(playArea).toContain('role="dialog"');
    expect(playArea).toContain('aria-modal="true"');
    expect(playArea).toContain("uiPaused: drawerOpen");
    const scene = read("apps/snake-bounty/src/scenes/SnakeScene.ts");
    expect(scene).toContain('["Enter", " "]');
    expect(scene).toContain('this.dispatch("startGame", { difficulty: this.pickedDifficulty })');
    expect(scene).toContain("target.closest(\"button, input, select, textarea");
    expect(styles).toContain("--phaser-mobile-height-ratio: 1.318");
    expect(styles).toContain("--phaser-mobile-bottom-reserve: 128px");
    expect(styles).toContain("min-width: 44px");
    expect(styles).toContain("prefers-reduced-motion: reduce");
  });
});

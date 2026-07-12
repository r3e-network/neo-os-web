import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({}));
vi.mock("@framework/phaser", () => ({
  BaseScene: class {
    constructor(_key?: string) {}
  },
}));

type TestLayout = {
  micro: boolean;
  compact: boolean;
  titleY: number;
  chipY: number;
  chipSize: number;
  cardW: number;
  cardH: number;
  cardCenterY: number;
  startX: number;
  gap: number;
  stepsY: number;
  progressH: number;
  actionY: number;
  actionW: number;
  actionH: number;
};

type SceneTestApi = {
  computeLayout(W: number, H: number): TestLayout;
  onReducedMotionChange(enabled: boolean): void;
  retryCriticalAssets(): void;
  buildCriticalAssetRecovery(): void;
  onResize(gameSize: unknown): void;
  handleActionPress(): void;
  onStateUpdate(state: unknown): void;
  updateCards(cards: unknown[], loading: boolean, pending?: boolean): void;
};

let Scene: new () => SceneTestApi;

beforeAll(async () => {
  const module = await import("./TarotScene");
  Scene = module.TarotScene as unknown as new () => SceneTestApi;
});

describe("TarotScene production guards", () => {
  it("keeps the 680px boundary in the compact tier", () => {
    const scene = new Scene();
    const boundary = scene.computeLayout(390, 680);
    expect(boundary).toMatchObject({
      micro: false,
      compact: true,
    });
    const intentTop = boundary.chipY - 8 - boundary.chipSize / 2;
    const progressBottom = boundary.stepsY + boundary.progressH / 2;
    const actionTop = boundary.actionY - boundary.actionH / 2;
    expect(boundary.titleY + 20).toBeLessThanOrEqual(intentTop);
    expect(progressBottom).toBeLessThan(actionTop);
    expect(scene.computeLayout(390, 681)).toMatchObject({
      micro: false,
      compact: false,
    });
  });

  it("keeps card captions above progress throughout the micro tier", () => {
    const scene = new Scene();
    for (const height of [400, 440, 480, 520]) {
      const layout = scene.computeLayout(280, height);
      const cardCaptionBottom = layout.cardCenterY + layout.cardH / 2 + 37;
      const progressTop = layout.stepsY - layout.progressH / 2;
      expect(layout.micro).toBe(true);
      expect(cardCaptionBottom).toBeLessThanOrEqual(progressTop);
    }
  });

  it("bounds the primary action inside a 280px canvas", () => {
    const layout = new Scene().computeLayout(280, 400);
    expect(layout.actionW).toBe(256);
    expect(140 - layout.actionW / 2).toBeGreaterThanOrEqual(12);
    expect(140 + layout.actionW / 2).toBeLessThanOrEqual(268);
    expect(layout.actionH).toBe(44);
  });

  it("keeps the full three-card spread inside a 280px canvas", () => {
    for (const height of [400, 520, 680, 844]) {
      const layout = new Scene().computeLayout(280, height);
      const left = layout.startX - layout.cardW / 2;
      const right = layout.startX + layout.gap * 2 + layout.cardW / 2;
      expect(left).toBeGreaterThanOrEqual(12);
      expect(right).toBeLessThanOrEqual(268);
    }
  });

  it("settles every active tween when reduced motion is enabled live", () => {
    const handler = Scene.prototype.onReducedMotionChange.toString();
    expect(handler).toContain("this.tweens.killAll()");
    expect(handler).toContain("this.settleMotionToState()");
    expect(handler).toContain("this.celebrationMotes.clear()");
    expect(handler).toContain("this.startAmbientMotion()");
  });

  it("retries real critical artwork and exposes an explicit recovery state", () => {
    const retry = Scene.prototype.retryCriticalAssets.toString();
    const recovery = Scene.prototype.buildCriticalAssetRecovery.toString();
    const resize = Scene.prototype.onResize.toString();
    expect(retry).toContain("this.load.maxRetries = CRITICAL_ASSET_RETRIES");
    expect(retry).toContain("this.load.image({ key, url })");
    expect(retry).toContain("this.load.start()");
    expect(recovery).toContain("assetErrorTitle");
    expect(recovery).toContain("retryCriticalAssets");
    expect(resize).toContain("this.missingCriticalAssetKeys()");
    expect(resize).toContain("this.buildCriticalAssetRecovery()");
  });

  it("keeps asynchronous oracle settlement inside the playable primary-action loop", () => {
    const action = Scene.prototype.handleActionPress.toString();
    const stateUpdate = Scene.prototype.onStateUpdate.toString();
    const cards = Scene.prototype.updateCards.toString();

    expect(action).toContain("hasPending");
    expect(action).toContain("refreshReadingState");
    expect(action).toContain("recoverExpiredReading");
    expect(stateUpdate).toContain("oracleWaitingStatus");
    expect(stateUpdate).toContain("pendingExpired");
    expect(cards).toContain("TAROT_ASSETS.back");
    expect(cards).toContain("oracleWaiting");
  });
});

/**
 * GUARD (restored fleet regression): PetPotionScene.handlePrimaryAction is the
 * in-canvas dispatch chokepoint for paid starts. The deleted DOM PlayArea
 * gated its start on `poolFree >= rule.reward / GAS_FIXED8` (its test pinned
 * the button disabled at poolFree: 0); this drives the REAL scene class over
 * a fake BaseScene bridge and pins the same rule at the scene chokepoint:
 * no `startGame` dispatch while the reward pool cannot cover the payout —
 * guest (free local) play stays exempt.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";

type PetPotionSceneConstructor =
  typeof import("../../pet-potion/src/scenes/PetPotionScene").PetPotionScene;

let PetPotionScene: PetPotionSceneConstructor;

class FakeBaseScene {
  static preloadAssets() {}
  protected state: Record<string, unknown> = {};
  protected reducedMotion = false;
  protected sfx = { unlock() {}, play() {} };
  constructor(_key: string) {}
  protected str(key: string, fallback = ""): string {
    const value = this.state[key];
    return value === undefined || value === null ? fallback : String(value);
  }
  protected num(key: string, fallback = 0): number {
    const value = Number(this.state[key]);
    return Number.isFinite(value) ? value : fallback;
  }
  protected bool(key: string): boolean {
    return Boolean(this.state[key]);
  }
  protected val<T>(key: string, fallback?: T): T | undefined {
    return (this.state[key] as T) ?? fallback;
  }
  protected dispatch(_action: string, _payload?: unknown) {}
}

beforeAll(async () => {
  vi.resetModules();
  vi.doMock("@framework/phaser", () => ({ BaseScene: FakeBaseScene }));
  ({ PetPotionScene } = await import("../../pet-potion/src/scenes/PetPotionScene"));
}, 120_000);

type DrivableScene = {
  state: Record<string, unknown>;
  dispatch: (action: string, payload?: unknown) => void;
  handlePrimaryAction: () => void;
};

function sceneWith(state: Record<string, unknown>) {
  const scene = new PetPotionScene() as unknown as DrivableScene;
  scene.state = state;
  const dispatch = vi.fn();
  scene.dispatch = dispatch;
  return { scene, dispatch };
}

const PAID_LOBBY = {
  gameStatus: "idle",
  appMode: "gamefi",
  walletConnected: true,
  newPaidRunsEnabled: true,
  isStarting: false,
  isDealing: false,
  isSubmitting: false,
  isRecovering: false,
  isConnectingWallet: false,
  isActing: false,
};

describe("pet-potion scene reward pool gate", () => {
  it("never dispatches a paid startGame while the reward pool cannot cover the payout", () => {
    const { scene, dispatch } = sceneWith({ ...PAID_LOBBY, poolFree: 0 });

    scene.handlePrimaryAction();

    expect(dispatch).not.toHaveBeenCalled();
  });

  it("dispatches the paid startGame once the pool covers the selected path reward", () => {
    const { scene, dispatch } = sceneWith({ ...PAID_LOBBY, poolFree: 25 });

    scene.handlePrimaryAction();

    expect(dispatch).toHaveBeenCalledWith("startGame", 0);
  });

  it("keeps guest (free local) starts exempt from the pool gate", () => {
    const { scene, dispatch } = sceneWith({
      ...PAID_LOBBY,
      appMode: "guest",
      walletConnected: false,
      newPaidRunsEnabled: false,
      poolFree: 0,
    });

    scene.handlePrimaryAction();

    expect(dispatch).toHaveBeenCalledWith("startGame", 0);
  });

  it("still lets a low pool block the start even when the wallet is not yet connected", () => {
    // Pool precedence mirrors flappy-dash: an unfunded pool halts the paid
    // lane before the connect gesture, so a connect can never roll straight
    // into a start the pool cannot pay.
    const { scene, dispatch } = sceneWith({
      ...PAID_LOBBY,
      walletConnected: false,
      poolFree: 0,
    });

    scene.handlePrimaryAction();

    expect(dispatch).not.toHaveBeenCalled();
  });
});

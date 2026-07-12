/**
 * Per-instance Phaser bridge isolation (hardening round 2).
 *
 * The historical wiring injected ONE global (`window.__phaserBridge`), so two
 * simultaneously mounted PhaserGameComponents clobbered each other: whichever
 * mounted last owned the global, and BOTH scenes dispatched through it. The
 * fix attaches each component's bridge to ITS OWN Phaser.Game via
 * `config.callbacks.preBoot` (see GameBridge.attachBridgeToGame) and makes
 * BaseScene resolve that per-game attachment first. The window global remains
 * a back-compat alias for the MOST RECENT mount only.
 *
 * Locked contracts:
 * - Each mounted PhaserGameComponent attaches a DISTINCT bridge to its own
 *   Phaser.Game, wired to its own dispatch prop.
 * - window.__phaserBridge aliases the most recent mount and is removed when
 *   that mount unmounts (never when a sibling unmounts).
 * - An app-supplied config.callbacks.preBoot still runs after the attachment.
 * - BaseScene bridge precedence: per-game attachment → window global →
 *   no-op standalone bridge.
 */

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

type FakeGameConfig = {
  callbacks?: { preBoot?: (game: unknown) => void };
  [key: string]: unknown;
};

type FakeGame = {
  config: FakeGameConfig;
  scale: { setGameSize: () => void; refresh: () => void };
  destroy(removeCanvas?: boolean): void;
};

const { fakeGames, FakeGameClass } = vi.hoisted(() => {
  const games: unknown[] = [];
  class FakeGameClass {
    config: { callbacks?: { preBoot?: (game: unknown) => void } };
    scale = { setGameSize: () => {}, refresh: () => {} };
    constructor(config: { callbacks?: { preBoot?: (game: unknown) => void } }) {
      this.config = config;
      games.push(this);
      // Phaser invokes preBoot during boot, before any scene is created.
      config.callbacks?.preBoot?.(this);
    }
    destroy(_removeCanvas?: boolean): void {}
  }
  return { fakeGames: games as FakeGame[], FakeGameClass };
});

vi.mock("phaser", () => ({
  AUTO: 0,
  Scale: { FIT: 1, CENTER_BOTH: 2 },
  Scenes: { Events: { SHUTDOWN: "shutdown", DESTROY: "destroy" } },
  Scene: class Scene {
    constructor(_key?: unknown) {}
  },
  Game: FakeGameClass,
}));

import { PhaserGameComponent } from "@framework/phaser/PhaserGameComponent";
import { BaseScene } from "@framework/phaser/BaseScene";
import { GameBridge, bridgeOfGame } from "@framework/phaser/GameBridge";
import type { GameState } from "@framework/phaser/types";

afterEach(() => {
  cleanup();
  fakeGames.length = 0;
  delete window.__phaserBridge;
});

const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("PhaserGameComponent per-instance bridge", () => {
  it("gives two mounted games distinct bridges wired to their own dispatch", async () => {
    const dispatchA = vi.fn();
    const dispatchB = vi.fn();

    render(<PhaserGameComponent config={{ width: 100, height: 100 }} dispatch={dispatchA} />);
    render(<PhaserGameComponent config={{ width: 100, height: 100 }} dispatch={dispatchB} />);

    expect(fakeGames).toHaveLength(2);
    const bridgeA = bridgeOfGame(fakeGames[0]);
    const bridgeB = bridgeOfGame(fakeGames[1]);
    expect(bridgeA).toBeInstanceOf(GameBridge);
    expect(bridgeB).toBeInstanceOf(GameBridge);
    // The pre-fix failure mode: both games saw the same (last-mounted) bridge.
    expect(bridgeA).not.toBe(bridgeB);

    // Each bridge dispatches into ITS component's dispatch prop.
    bridgeA!.dispatch("actionFromA", 1);
    bridgeB!.dispatch("actionFromB", 2);
    await flushMicrotasks();
    expect(dispatchA).toHaveBeenCalledWith("actionFromA", 1);
    expect(dispatchA).not.toHaveBeenCalledWith("actionFromB", 2);
    expect(dispatchB).toHaveBeenCalledWith("actionFromB", 2);
    expect(dispatchB).not.toHaveBeenCalledWith("actionFromA", 1);
  });

  it("keeps window.__phaserBridge as an alias for the most recent mount only", () => {
    const first = render(
      <PhaserGameComponent config={{ width: 100, height: 100 }} dispatch={vi.fn()} />,
    );
    const second = render(
      <PhaserGameComponent config={{ width: 100, height: 100 }} dispatch={vi.fn()} />,
    );

    expect(window.__phaserBridge).toBe(bridgeOfGame(fakeGames[1]));

    // Unmounting the FIRST (non-owning) mount must not clear the alias.
    first.unmount();
    expect(window.__phaserBridge).toBe(bridgeOfGame(fakeGames[1]));

    // Unmounting the owning mount removes the alias.
    second.unmount();
    expect(window.__phaserBridge).toBeUndefined();
  });

  it("still runs an app-supplied preBoot callback after attaching the bridge", () => {
    const seen: Array<GameBridge | undefined> = [];
    render(
      <PhaserGameComponent
        config={{
          width: 100,
          height: 100,
          callbacks: { preBoot: (game) => seen.push(bridgeOfGame(game)) },
        }}
        dispatch={vi.fn()}
      />,
    );

    expect(seen).toHaveLength(1);
    // The bridge was already attached when the app callback observed the game.
    expect(seen[0]).toBe(bridgeOfGame(fakeGames[0]));
    expect(seen[0]).toBeInstanceOf(GameBridge);
  });
});

describe("BaseScene bridge resolution precedence", () => {
  class ProbeScene extends BaseScene {
    updates: GameState[] = [];
    protected onStateUpdate(state: GameState): void {
      this.updates.push(state);
    }
  }

  function makeScene(game: unknown): ProbeScene {
    const scene = new ProbeScene("ProbeScene");
    Object.assign(scene, {
      game,
      scale: { on: vi.fn(), off: vi.fn() },
      events: { once: vi.fn(), off: vi.fn() },
      time: { delayedCall: vi.fn(() => ({ remove: vi.fn() })) },
      sys: { isActive: () => true },
    });
    return scene;
  }

  const sceneBridge = (scene: ProbeScene): GameBridge =>
    (scene as unknown as { bridge: GameBridge }).bridge;

  it("prefers the bridge attached to ITS OWN game over the window global", () => {
    const ownBridge = new GameBridge();
    const otherMountBridge = new GameBridge();
    const game = {} as object;
    (game as { __phaserBridge?: GameBridge }).__phaserBridge = ownBridge;
    // Another component mounted later and owns the global alias.
    window.__phaserBridge = otherMountBridge;

    const scene = makeScene(game);
    scene.create();

    expect(sceneBridge(scene)).toBe(ownBridge);
    expect(sceneBridge(scene)).not.toBe(otherMountBridge);
  });

  it("falls back to window.__phaserBridge when the game carries no attachment", () => {
    const legacyBridge = new GameBridge();
    window.__phaserBridge = legacyBridge;

    const scene = makeScene({});
    scene.create();

    expect(sceneBridge(scene)).toBe(legacyBridge);
  });

  it("falls back to a safe no-op bridge for standalone development", () => {
    const scene = makeScene({});
    scene.create();

    const bridge = sceneBridge(scene);
    expect(bridge).toBeDefined();
    expect(() => bridge.dispatch("anything")).not.toThrow();
    expect(bridge.getState()).toEqual({});
  });
});

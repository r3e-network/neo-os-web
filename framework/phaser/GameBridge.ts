/**
 * GameBridge — bidirectional communication between the React/framework shell
 * and the running Phaser 3 game.
 *
 * React side:
 *   bridge.sendState(snapshot)   — push state updates whenever observables change
 *   bridge.on("ready", cb)       — fired once Phaser scene booted
 *
 * Phaser scene side:
 *   scene.bridge.onState(fn)     — called each time React pushes a new state
 *   scene.bridge.dispatch(action, args) — triggers a framework action in React
 */

import type { GameState, DispatchFn } from "./types";

type BridgeEventMap = {
  ready: void;
  state: GameState;
  dispatch: { action: string; args: unknown[] };
  dispatchComplete: { action: string; args: unknown[] };
  error: GameBridgeError;
  destroy: void;
};

type BridgeListener<K extends keyof BridgeEventMap> = (
  data: BridgeEventMap[K],
) => void;

export type GameBridgeError = {
  source: "dispatch";
  action: string;
  args: unknown[];
  error: unknown;
  message: string;
};

export class GameBridge {
  private listeners = new Map<string, Set<BridgeListener<never>>>();
  private latestState: GameState = {};
  private dispatchFn: DispatchFn | null = null;

  /** React calls this once to wire up the framework dispatch. */
  setDispatch(fn: DispatchFn): void {
    this.dispatchFn = fn;
  }

  // ── React → Phaser ──────────────────────────────────────────────────────

  /** Push a new state snapshot to the running Phaser scene. */
  sendState(state: GameState): void {
    this.latestState = state;
    this.emit("state", state);
  }

  /** Signal that the React component is being unmounted. */
  destroy(): void {
    this.emit("destroy", undefined as void);
    this.listeners.clear();
  }

  // ── Phaser → React ──────────────────────────────────────────────────────

  /**
   * Phaser scene calls this to trigger a framework action.
   * Forwards to the React dispatch prop (and thus to main.tsx).
   */
  dispatch(action: string, ...args: unknown[]): void {
    this.emit("dispatch", { action, args });

    if (!this.dispatchFn) return;

    try {
      const result = this.dispatchFn(action, ...args);
      void Promise.resolve(result)
        .then(() => this.emit("dispatchComplete", { action, args }))
        .catch((error: unknown) => this.reportDispatchError(action, args, error));
    } catch (error) {
      this.reportDispatchError(action, args, error);
    }
  }

  /**
   * Return the last state snapshot received from React.
   * Useful for scenes that need the current state at `create()` time before
   * the first `sendState` fires.
   */
  getState(): GameState {
    return this.latestState;
  }

  // ── Generic event emitter ────────────────────────────────────────────────

  on<K extends keyof BridgeEventMap>(
    event: K,
    listener: BridgeListener<K>,
  ): () => void {
    const key = event as string;
    if (!this.listeners.has(key)) this.listeners.set(key, new Set());
    const set = this.listeners.get(key)!;
    set.add(listener as BridgeListener<never>);
    return () => set.delete(listener as BridgeListener<never>);
  }

  off<K extends keyof BridgeEventMap>(
    event: K,
    listener: BridgeListener<K>,
  ): void {
    this.listeners.get(event as string)?.delete(listener as BridgeListener<never>);
  }

  private emit<K extends keyof BridgeEventMap>(
    event: K,
    data: BridgeEventMap[K],
  ): void {
    this.listeners
      .get(event as string)
      ?.forEach((fn) => fn(data as never));
  }

  /** Called by the Phaser scene's create() to signal boot complete. */
  notifyReady(): void {
    this.emit("ready", undefined as void);
  }

  private reportDispatchError(
    action: string,
    args: unknown[],
    error: unknown,
  ): void {
    this.emit("error", {
      source: "dispatch",
      action,
      args,
      error,
      message: formatBridgeError(error),
    });
  }
}

export function formatBridgeError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return "The game action could not be completed.";
}

/** Global registry: one bridge per Phaser game instance (keyed by gameId). */
const bridgeRegistry = new Map<string, GameBridge>();

export function getBridge(gameId: string): GameBridge {
  if (!bridgeRegistry.has(gameId)) {
    bridgeRegistry.set(gameId, new GameBridge());
  }
  return bridgeRegistry.get(gameId)!;
}

export function releaseBridge(gameId: string): void {
  bridgeRegistry.get(gameId)?.destroy();
  bridgeRegistry.delete(gameId);
}

// ── Per-game-instance bridge channel ────────────────────────────────────────
// PhaserGameComponent attaches its bridge to the Phaser.Game it boots (via
// config.callbacks.preBoot, so the attachment exists before any scene runs).
// BaseScene resolves the bridge through `scene.game`, which means every
// mounted game talks to ITS OWN bridge — two simultaneously mounted
// PhaserGameComponents can no longer clobber each other through the single
// `window.__phaserBridge` global. That global is still written as a
// back-compat alias for the MOST RECENT mount (standalone scenes and older
// integrations read it), but it is only a fallback for scenes whose game
// carries no attachment.

/** Structural host for a per-instance bridge attachment (a Phaser.Game). */
type GameBridgeCarrier = { __phaserBridge?: GameBridge };

/** Attach `bridge` to a booted/booting Phaser.Game instance. */
export function attachBridgeToGame(game: object, bridge: GameBridge): void {
  (game as GameBridgeCarrier).__phaserBridge = bridge;
}

/** Resolve the bridge attached to a Phaser.Game instance, if any. */
export function bridgeOfGame(game: unknown): GameBridge | undefined {
  if (typeof game !== "object" || game === null) return undefined;
  return (game as GameBridgeCarrier).__phaserBridge;
}

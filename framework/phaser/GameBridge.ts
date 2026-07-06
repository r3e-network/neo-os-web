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
  destroy: void;
};

type BridgeListener<K extends keyof BridgeEventMap> = (
  data: BridgeEventMap[K],
) => void;

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
    void this.dispatchFn?.(action, ...args);
    this.emit("dispatch", { action, args });
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

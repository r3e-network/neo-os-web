/**
 * Shared types for the Phaser 3 game integration layer.
 *
 * Every miniapp game that uses Phaser 3 for rendering communicates with
 * the React/framework shell through these typed interfaces.
 */

import type Phaser from "phaser";

// ── Bridge ───────────────────────────────────────────────────────────────────

/** The full state snapshot pushed from React into the running Phaser scene. */
export type GameState = Record<string, unknown>;

/**
 * Typed dispatch function: mirrors the PlayArea `dispatch` prop so scenes can
 * trigger on-chain actions without knowing the React layer.
 */
export type DispatchFn = (action: string, ...args: unknown[]) => Promise<void>;

// ── React ↔ Phaser bridge ────────────────────────────────────────────────────

export interface GameBridgeOptions {
  /**
   * Called by the bridge when the Phaser game is fully booted and ready to
   * receive state. React uses this to start pushing observable state.
   */
  onReady?: () => void;
}

// ── PhaserGameComponent props ─────────────────────────────────────────────────

export interface PhaserGameProps {
  /** The Phaser.Game config to boot from (scene list, physics, etc.). */
  config: Phaser.Types.Core.GameConfig;
  /** Current app state to push into the running game whenever it changes. */
  state?: GameState;
  /** Dispatch function forwarded to the game scene. */
  dispatch: DispatchFn;
  /** CSS width of the game container (defaults to 100%). */
  width?: string | number;
  /** CSS height of the game container (defaults to 560px). */
  height?: string | number;
  /** Optional extra CSS class for the container div. */
  className?: string;
}

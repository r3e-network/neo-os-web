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
export type DispatchFn = (
  action: string,
  ...args: unknown[]
) => Promise<void> | void;

// ── React ↔ Phaser bridge ────────────────────────────────────────────────────

export interface GameBridgeOptions {
  /**
   * Called by the bridge when the Phaser game is fully booted and ready to
   * receive state. React uses this to start pushing observable state.
   */
  onReady?: () => void;
}

// ── PhaserGameComponent props ─────────────────────────────────────────────────

export type PhaserGameConfig = Omit<Phaser.Types.Core.GameConfig, "scene"> & {
  scene?: Phaser.Types.Core.GameConfig["scene"] | readonly Phaser.Types.Scenes.SceneType[];
};

export interface PhaserGameProps {
  /** The Phaser.Game config to boot from (scene list, physics, etc.). */
  config: PhaserGameConfig;
  /** Current app state to push into the running game whenever it changes. */
  state?: GameState;
  /** Dispatch function forwarded to the game scene. */
  dispatch: DispatchFn;
  /** CSS width of the game container (defaults to 100%). */
  width?: string | number;
  /** CSS height of the game container (defaults to 560px). */
  height?: string | number;
  /** Automatically size the game host from mobile viewport + scene aspect ratio. Defaults to true. */
  autoMobileSize?: boolean;
  /** Optional extra CSS class for the container div. */
  className?: string;
  /** Accessible name for the canvas host. */
  ariaLabel?: string;
  /** Text shown while the Phaser scene boots. */
  loadingLabel?: string;
  /** Text shown when Phaser fails to boot or a bridge action fails. */
  errorLabel?: string;
  /** Text shown on the retry control after a recoverable game failure. */
  retryLabel?: string;
  /** Text shown on the dismiss control after a failed action. */
  continueLabel?: string;
  /** Called when the scene reports that it is ready. */
  onReady?: () => void;
}

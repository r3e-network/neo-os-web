/**
 * framework/phaser — Phaser 3 bridge layer for neo-miniapp games.
 *
 * Import in game wrappers and scenes:
 *   import { PhaserGameComponent, BaseScene } from "@framework/phaser";
 *   import type { GameState, DispatchFn } from "@framework/phaser";
 */
export { PhaserGameComponent } from "./PhaserGameComponent";
export { BaseScene } from "./BaseScene";
export {
  GameBridge,
  formatBridgeError,
  getBridge,
  releaseBridge,
} from "./GameBridge";
export type { GameBridgeError } from "./GameBridge";
export type {
  GameState,
  DispatchFn,
  PhaserGameConfig,
  PhaserGameProps,
  GameBridgeOptions,
} from "./types";

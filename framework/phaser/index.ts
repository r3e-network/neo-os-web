/**
 * framework/phaser — Phaser 3 bridge layer for neo-miniapp games.
 *
 * Import in game scenes:
 *   import { BaseScene } from "@framework/phaser";
 *   import type { GameState, DispatchFn } from "@framework/phaser";
 */
export { BaseScene } from "./BaseScene";
export { GameBridge, getBridge, releaseBridge } from "./GameBridge";
export type { GameState, DispatchFn, PhaserGameProps, GameBridgeOptions } from "./types";

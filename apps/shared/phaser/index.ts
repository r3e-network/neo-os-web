/**
 * @shared/phaser — Phaser 3 integration layer for neo-miniapp games.
 *
 * Import from this barrel instead of importing individual files:
 *
 * ```ts
 * import { PhaserGameComponent, BaseScene } from "@shared/phaser";
 * import type { GameState, DispatchFn } from "@shared/phaser";
 * ```
 */
export { PhaserGameComponent } from "./PhaserGameComponent";
export { BaseScene } from "./BaseScene";
export { GameBridge, getBridge, releaseBridge } from "./GameBridge";
export type { GameState, DispatchFn, PhaserGameProps, GameBridgeOptions } from "./types";

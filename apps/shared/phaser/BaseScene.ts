/**
 * BaseScene — base Phaser 3 scene for all miniapp games.
 *
 * Extends Phaser.Scene and wires up:
 * - the GameBridge (state reception + action dispatch)
 * - responsive canvas resizing
 * - prefers-reduced-motion awareness
 *
 * Usage in a game scene:
 *
 * ```ts
 * import { BaseScene } from "@shared/phaser/BaseScene";
 *
 * export class DiceScene extends BaseScene {
 *   constructor() { super("DiceScene"); }
 *
 *   protected onStateUpdate(state: GameState): void {
 *     // React pushed a new state snapshot — update visuals here
 *   }
 *
 *   create(): void {
 *     super.create(); // always call super first
 *     // build scene objects ...
 *   }
 * }
 * ```
 */

import Phaser from "phaser";
import type { GameState } from "./types";
import type { GameBridge } from "./GameBridge";

// Injected by PhaserGameComponent before game boot.
declare global {
  interface Window {
    __phaserBridge?: GameBridge;
  }
}

export abstract class BaseScene extends Phaser.Scene {
  /** Bridge instance injected by PhaserGameComponent via window.__phaserBridge. */
  protected bridge!: GameBridge;

  /** Latest state snapshot received from the React shell. */
  protected state: GameState = {};

  /** True when prefers-reduced-motion is active. */
  protected reducedMotion: boolean = false;

  private stateUnsubscribe: (() => void) | null = null;
  private destroyUnsubscribe: (() => void) | null = null;

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  create(): void {
    // Wire up the bridge
    if (window.__phaserBridge) {
      this.bridge = window.__phaserBridge;
    } else {
      // Fallback no-op bridge for standalone development
      this.bridge = createNopBridge();
    }

    // Subscribe to state updates from React
    this.stateUnsubscribe = this.bridge.on("state", (newState) => {
      this.state = newState as GameState;
      this.onStateUpdate(this.state);
    });

    // Subscribe to destroy signal
    this.destroyUnsubscribe = this.bridge.on("destroy", () => {
      this.scene.stop();
    });

    // Seed with whatever state React already has
    this.state = this.bridge.getState();
    if (Object.keys(this.state).length > 0) {
      this.onStateUpdate(this.state);
    }

    // Detect prefers-reduced-motion
    this.reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    // Tell React the scene is ready
    this.bridge.notifyReady();

    // Responsive resize
    this.scale.on("resize", this.onResize, this);
  }

  // ── Scene resize ───────────────────────────────────────────────────────────

  /** Override to reposition/rescale scene objects on resize. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected onResize(_gameSize: Phaser.Structs.Size): void {
    // Default: no-op. Override in subclass.
  }

  // ── State ──────────────────────────────────────────────────────────────────

  /**
   * Called every time React pushes a new state snapshot.
   * Override to update scene visuals / game phase.
   */
  protected abstract onStateUpdate(state: GameState): void;

  // ── Dispatch helpers ───────────────────────────────────────────────────────

  /** Trigger a framework action in the React/blockchain layer. */
  protected dispatch(action: string, ...args: unknown[]): void {
    this.bridge.dispatch(action, ...args);
  }

  // ── Convenience state accessors ────────────────────────────────────────────

  protected str(key: string, fallback = ""): string {
    const v = this.state[key];
    return v === null || v === undefined ? fallback : String(v);
  }

  protected num(key: string, fallback = 0): number {
    const v = this.state[key];
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  protected bool(key: string): boolean {
    return Boolean(this.state[key]);
  }

  protected val<T>(key: string, fallback?: T): T | undefined {
    return (this.state[key] as T) ?? fallback;
  }

  // ── Tween helpers (respects reduced-motion) ────────────────────────────────

  /**
   * Create a tween only if reduced-motion is off.
   * Returns the Tween or null (so callers don't need a special branch).
   */
  protected tween(
    config: Phaser.Types.Tweens.TweenBuilderConfig,
  ): Phaser.Tweens.Tween | null {
    if (this.reducedMotion) {
      // Jump to final value
      if (config.targets && config.props) {
        const targets = Array.isArray(config.targets)
          ? config.targets
          : [config.targets];
        for (const target of targets) {
          for (const [prop, value] of Object.entries(config.props)) {
            (target as Record<string, unknown>)[prop] =
              typeof value === "object" && value && "value" in value
                ? (value as { value: unknown }).value
                : value;
          }
        }
      }
      config.onComplete?.();
      return null;
    }
    return this.tweens.add(config);
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────

  destroy(fromScene = false): void {
    this.stateUnsubscribe?.();
    this.destroyUnsubscribe?.();
    this.stateUnsubscribe = null;
    this.destroyUnsubscribe = null;
    super.destroy(fromScene);
  }
}

// ── No-op bridge (standalone dev without React shell) ──────────────────────

function createNopBridge(): GameBridge {
  return {
    dispatch() {},
    sendState() {},
    getState: () => ({}),
    notifyReady() {},
    on: () => () => {},
    off: () => {},
    setDispatch: () => {},
    destroy: () => {},
  } as unknown as GameBridge;
}

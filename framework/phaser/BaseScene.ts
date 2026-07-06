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
 * import { BaseScene } from "@framework/phaser";
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
import type { GameBridge, GameBridgeError } from "./GameBridge";

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
  private errorUnsubscribe: (() => void) | null = null;
  private motionQuery: MediaQueryList | null = null;
  private motionChangeHandler: ((event: MediaQueryListEvent) => void) | null = null;
  private cleanedUp = false;

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  create(): void {
    this.cleanupBaseScene();
    this.cleanedUp = false;

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

    this.errorUnsubscribe = this.bridge.on("error", (error) => {
      this.onBridgeError(error);
    });

    // Seed with whatever state React already has
    this.state = this.bridge.getState();
    if (Object.keys(this.state).length > 0) {
      this.onStateUpdate(this.state);
    }

    // Detect prefers-reduced-motion and keep it live while the scene is active.
    this.bindReducedMotion();

    // Tell React the scene is ready
    this.bridge.notifyReady();

    // Responsive resize
    this.scale.on("resize", this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanupBaseScene, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanupBaseScene, this);
  }

  // ── Scene resize ───────────────────────────────────────────────────────────

  /** Override to reposition/rescale scene objects on resize. */
  protected onResize(_gameSize: Phaser.Structs.Size): void {
    // Default: no-op. Override in subclass.
  }

  // ── State ──────────────────────────────────────────────────────────────────

  /**
   * Called every time React pushes a new state snapshot.
   * Override to update scene visuals / game phase.
   */
  protected abstract onStateUpdate(state: GameState): void;

  /** Override when a scene wants to present dispatch failures in-canvas. */
  protected onBridgeError(_error: GameBridgeError): void {
    // Default: React host displays a concise recoverable error overlay.
  }

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
      this.applyTweenEndState(config);
      return null;
    }
    return this.tweens.add(config);
  }

  /** Alias used by newer scenes; keeps call sites readable. */
  protected animate(
    config: Phaser.Types.Tweens.TweenBuilderConfig,
  ): Phaser.Tweens.Tween | null {
    return this.tween(config);
  }

  protected animateCounter(
    config: Phaser.Types.Tweens.NumberTweenBuilderConfig,
  ): Phaser.Tweens.Tween | null {
    if (this.reducedMotion) {
      const callbackScope = (config.callbackScope as object | undefined) ?? this;
      (config.onUpdate as ((...args: unknown[]) => void) | undefined)?.call(
        callbackScope,
        createReducedMotionCounter(config.to ?? config.from ?? 0),
      );
      (config.onComplete as ((...args: unknown[]) => void) | undefined)?.call(
        callbackScope,
      );
      return null;
    }
    return this.tweens.addCounter(config);
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────

  destroy(fromScene = false): void {
    this.cleanupBaseScene();
    void fromScene;
  }

  private cleanupBaseScene(): void {
    if (this.cleanedUp) return;
    this.cleanedUp = true;

    this.stateUnsubscribe?.();
    this.destroyUnsubscribe?.();
    this.errorUnsubscribe?.();
    this.stateUnsubscribe = null;
    this.destroyUnsubscribe = null;
    this.errorUnsubscribe = null;
    this.scale.off("resize", this.onResize, this);
    this.events.off(Phaser.Scenes.Events.SHUTDOWN, this.cleanupBaseScene, this);
    this.events.off(Phaser.Scenes.Events.DESTROY, this.cleanupBaseScene, this);
    this.unbindReducedMotion();
  }

  private bindReducedMotion(): void {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null;
    this.motionQuery = query;
    this.reducedMotion = query?.matches ?? false;
    if (!query) return;

    this.motionChangeHandler = (event) => {
      this.reducedMotion = event.matches;
      this.onReducedMotionChange(event.matches);
    };
    if (query.addEventListener) {
      query.addEventListener("change", this.motionChangeHandler);
    } else {
      query.addListener?.(this.motionChangeHandler);
    }
  }

  private unbindReducedMotion(): void {
    if (this.motionQuery && this.motionChangeHandler) {
      if (this.motionQuery.removeEventListener) {
        this.motionQuery.removeEventListener("change", this.motionChangeHandler);
      } else {
        this.motionQuery.removeListener?.(this.motionChangeHandler);
      }
    }
    this.motionQuery = null;
    this.motionChangeHandler = null;
  }

  protected onReducedMotionChange(_enabled: boolean): void {
    // Scenes can override when they keep long-running tweens in fields.
  }

  private applyTweenEndState(
    config: Phaser.Types.Tweens.TweenBuilderConfig,
  ): void {
    const targets = collectTweenTargets(config.targets);
    const configRecord = config as Record<string, unknown>;
    const tweenKeys = [
      "x",
      "y",
      "alpha",
      "angle",
      "rotation",
      "scale",
      "scaleX",
      "scaleY",
      "displayWidth",
      "displayHeight",
    ];

    for (const target of targets) {
      const targetRecord = target as Record<string, unknown>;
      for (const key of tweenKeys) {
        if (key in configRecord) {
          targetRecord[key] = resolveTweenValue(configRecord[key], targetRecord[key]);
        }
      }

      if (config.props) {
        for (const [key, value] of Object.entries(config.props)) {
          targetRecord[key] = resolveTweenValue(value, targetRecord[key]);
        }
      }
    }

    (config.onComplete as ((...args: unknown[]) => void) | undefined)?.();
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

function collectTweenTargets(targets: unknown): unknown[] {
  if (!targets) return [];
  return Array.isArray(targets) ? targets : [targets];
}

function resolveTweenValue(value: unknown, current: unknown): unknown {
  if (Array.isArray(value)) return value.at(-1);
  if (typeof value === "string") {
    const relative = /^([+-])=(\d+(?:\.\d+)?)$/.exec(value.trim());
    if (relative && typeof current === "number") {
      const delta = Number(relative[2]);
      return relative[1] === "+" ? current + delta : current - delta;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : current;
  }
  if (typeof value === "object" && value) {
    const record = value as Record<string, unknown>;
    if ("to" in record) return resolveTweenValue(record.to, current);
    if ("value" in record) return resolveTweenValue(record.value, current);
  }
  return value;
}

function createReducedMotionCounter(value: number): Pick<Phaser.Tweens.Tween, "getValue"> {
  return {
    getValue: () => value,
  };
}

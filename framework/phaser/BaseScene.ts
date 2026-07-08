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

import * as Phaser from "phaser";
import type { GameState } from "./types";
import type { GameBridge, GameBridgeError } from "./GameBridge";

// Injected by PhaserGameComponent before game boot.
declare global {
  interface Window {
    __phaserBridge?: GameBridge;
  }
}

type SceneTweenTarget = Phaser.Types.Tweens.TweenBuilderConfig["targets"];

type GameButtonFeedbackOptions = {
  targets?: SceneTweenTarget;
  enabled?: () => boolean;
  onPress?: (pointer: Phaser.Input.Pointer) => void;
  onHoverIn?: () => void;
  onHoverOut?: () => void;
  idleScale?: number;
  hoverScale?: number | null;
  pressScale?: number;
  hoverDuration?: number;
  pressDuration?: number;
  cursor?: string | false;
};

type PressFeedbackOptions = {
  scale?: number;
  duration?: number;
  ease?: string;
};

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
  private stateUpdateTimer: Phaser.Time.TimerEvent | null = null;
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
      this.queueStateUpdate();
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
      this.queueStateUpdate();
    }

    // Detect prefers-reduced-motion and keep it live while the scene is active.
    this.bindReducedMotion();

    // Responsive resize
    this.scale.on("resize", this.onResize, this);

    // Tell React the scene is ready after resize hooks are live, so the host's
    // first mobile size application can rebuild the scene instead of only
    // resizing the canvas.
    this.bridge.notifyReady();

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

  /**
   * Child scenes call `super.create()` before building their UI objects. Queue
   * bridge-driven state updates until the next Phaser tick so an already-warm
   * React state snapshot cannot hit uninitialized labels, buttons, or layers.
   */
  private queueStateUpdate(): void {
    if (this.stateUpdateTimer || this.cleanedUp) return;
    this.stateUpdateTimer = this.time.delayedCall(0, () => {
      this.stateUpdateTimer = null;
      if (!this.cleanedUp) {
        this.onStateUpdate(this.state);
      }
    });
  }

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

  // ── Game interaction helpers ──────────────────────────────────────────────

  /**
   * Standardized hover/press feedback for in-canvas controls.
   * Scenes still own layout and artwork; the framework owns game-feel basics.
   */
  protected bindGameButton(
    hitTarget: Phaser.GameObjects.GameObject,
    options: GameButtonFeedbackOptions = {},
  ): void {
    const targets = options.targets ?? hitTarget;
    const isEnabled = () => options.enabled?.() ?? true;
    const idleScale = options.idleScale ?? 1;
    const hoverScale = options.hoverScale === undefined ? 1.04 : options.hoverScale;
    const pressScale = options.pressScale ?? 0.96;
    const hoverDuration = options.hoverDuration ?? 80;

    this.setGameCursor(hitTarget, options.cursor);

    hitTarget.on("pointerover", () => {
      options.onHoverIn?.();
      if (!isEnabled() || hoverScale === null) return;
      this.animate({
        targets,
        scale: hoverScale,
        duration: hoverDuration,
        ease: "Sine.easeOut",
      });
    });

    hitTarget.on("pointerout", () => {
      options.onHoverOut?.();
      if (hoverScale === null) return;
      this.animate({
        targets,
        scale: idleScale,
        duration: hoverDuration,
        ease: "Sine.easeOut",
      });
    });

    hitTarget.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (!isEnabled()) return;
      this.pressFeedback(targets, {
        scale: pressScale,
        duration: options.pressDuration,
      });
      options.onPress?.(pointer);
    });
  }

  protected pressFeedback(
    targets: SceneTweenTarget,
    options: PressFeedbackOptions = {},
  ): Phaser.Tweens.Tween | null {
    if (this.reducedMotion) return null;
    return this.tweens.add({
      targets,
      scale: options.scale ?? 0.96,
      duration: options.duration ?? 60,
      ease: options.ease ?? "Sine.easeOut",
      yoyo: true,
    });
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────

  destroy(fromScene = false): void {
    this.cleanupBaseScene();
    void fromScene;
  }

  private cleanupBaseScene(): void {
    if (this.cleanedUp) return;
    this.cleanedUp = true;

    if (this.stateUpdateTimer) {
      this.stateUpdateTimer.remove(false);
      this.stateUpdateTimer = null;
    }

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
    if (config.yoyo) {
      (config.onComplete as ((...args: unknown[]) => void) | undefined)?.();
      return;
    }

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

  private setGameCursor(
    hitTarget: Phaser.GameObjects.GameObject,
    cursor: string | false | undefined,
  ): void {
    if (cursor === false) return;
    const input = (hitTarget as { input?: { cursor?: string } }).input;
    if (input) input.cursor = cursor ?? "pointer";
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

/**
 * LifecycleService - Miniapp lifecycle management.
 *
 * Manages the mount/unmount lifecycle of a miniapp, including:
 * - Ordered lifecycle callbacks (onMount, onUnmount, onPause, onResume)
 * - Data loading orchestration with reload capability
 * - Cleanup registration for timers, subscriptions, and event listeners
 * - Integration with the platform EventBus for lifecycle events
 *
 * @example
 * ```ts
 * const lifecycle = services.lifecycle;
 *
 * lifecycle.onMount(async () => {
 *   await loadInitialData();
 * });
 *
 * lifecycle.onDataLoad(async () => {
 *   stats.value = await chain.readCached("getPlatformStats");
 * });
 *
 * lifecycle.registerCleanup(() => clearInterval(timerId));
 *
 * // In the component's setup:
 * onMounted(() => lifecycle.mount());
 * onUnmounted(() => lifecycle.unmount());
 * ```
 */

import { createObservable } from "../react/context";
import type { Observable } from "../react/context";
import { EventBus } from "./EventBus";

export type AppState = "idle" | "mounting" | "mounted" | "active" | "paused" | "unmounting";

export class LifecycleService {
  private events: EventBus;
  private appId: string;

  private state: Observable<AppState>;

  private mountCallbacks: Array<() => void | Promise<void>>;
  private unmountCallbacks: Array<() => void>;
  private pauseCallbacks: Array<() => void>;
  private resumeCallbacks: Array<() => void>;
  private dataLoaders: Array<() => Promise<void>>;
  private cleanups: Array<() => void>;

  constructor(appId: string, events: EventBus) {
    this.appId = appId;
    this.events = events;
    this.state = createObservable<AppState>("idle");

    this.mountCallbacks = [];
    this.unmountCallbacks = [];
    this.pauseCallbacks = [];
    this.resumeCallbacks = [];
    this.dataLoaders = [];
    this.cleanups = [];
  }

  // -- State accessor -------------------------------------------------------

  /** Current lifecycle state of the miniapp. */
  get appState(): Observable<AppState> {
    return this.state;
  }

  // -- Lifecycle callback registration --------------------------------------

  /**
   * Register a callback to run during mount.
   * Mount callbacks run in registration order. Async callbacks are awaited.
   */
  onMount(callback: () => void | Promise<void>): void {
    this.mountCallbacks.push(callback);
  }

  /**
   * Register a callback to run during unmount.
   * Unmount callbacks run in reverse registration order (LIFO).
   */
  onUnmount(callback: () => void): void {
    this.unmountCallbacks.push(callback);
  }

  /**
   * Register a callback to run when the miniapp is paused
   * (e.g. when the user navigates away but the component stays mounted).
   */
  onPause(callback: () => void): void {
    this.pauseCallbacks.push(callback);
  }

  /**
   * Register a callback to run when the miniapp resumes from a paused state.
   */
  onResume(callback: () => void): void {
    this.resumeCallbacks.push(callback);
  }

  // -- Data loading lifecycle -----------------------------------------------

  /**
   * Register a data loader function. Data loaders run after mount
   * callbacks complete, and can be re-invoked via reloadData().
   */
  onDataLoad(loader: () => Promise<void>): void {
    this.dataLoaders.push(loader);
  }

  /**
   * Re-execute all registered data loaders.
   * Useful for "pull to refresh" or manual reload buttons.
   */
  async reloadData(): Promise<void> {
    const results = await Promise.allSettled(
      this.dataLoaders.map((loader) => loader()),
    );

    // Report any failures through the event bus
    for (const result of results) {
      if (result.status === "rejected") {
        this.events.emit(EventBus.ERROR, {
          error: result.reason instanceof Error ? result.reason : new Error(String(result.reason)),
          context: `${this.appId}:dataLoad`,
        });
      }
    }
  }

  // -- Cleanup registration -------------------------------------------------

  /**
   * Register a cleanup function. Cleanups run during unmount after
   * all unmount callbacks. Use for timers, subscriptions, etc.
   */
  registerCleanup(cleanup: () => void): void {
    this.cleanups.push(cleanup);
  }

  // -- Lifecycle execution --------------------------------------------------

  /**
   * Execute the mount lifecycle:
   * 1. Run mount callbacks in order
   * 2. Run data loaders in parallel
   * 3. Emit APP_MOUNTED event
   * 4. Transition to "active" state
   */
  async mount(): Promise<void> {
    if (this.state.get() !== "idle") return;

    this.state.set("mounting");

    // Run mount callbacks in order
    for (const callback of this.mountCallbacks) {
      try {
        await callback();
      } catch (err) {
        this.events.emit(EventBus.ERROR, {
          error: err instanceof Error ? err : new Error(String(err)),
          context: `${this.appId}:mount`,
        });
      }
    }

    this.state.set("mounted");

    // Run data loaders in parallel
    if (this.dataLoaders.length > 0) {
      await this.reloadData();
    }

    this.state.set("active");
    this.events.emit(EventBus.APP_MOUNTED, { appId: this.appId });
  }

  /**
   * Execute the unmount lifecycle:
   * 1. Transition to "unmounting" state
   * 2. Run unmount callbacks in reverse order (LIFO)
   * 3. Run all registered cleanups
   * 4. Emit APP_UNMOUNTED event
   * 5. Clear all registrations
   */
  unmount(): void {
    if (this.state.get() === "idle" || this.state.get() === "unmounting") return;

    this.state.set("unmounting");

    // Run unmount callbacks in reverse order
    for (let i = this.unmountCallbacks.length - 1; i >= 0; i--) {
      const callback = this.unmountCallbacks[i];
      if (!callback) continue;
      try {
        callback();
      } catch (err) {
        console.error(`[LifecycleService] Unmount callback error in ${this.appId}:`, err);
      }
    }

    // Run cleanups
    for (const cleanup of this.cleanups) {
      try {
        cleanup();
      } catch (err) {
        console.error(`[LifecycleService] Cleanup error in ${this.appId}:`, err);
      }
    }

    this.events.emit(EventBus.APP_UNMOUNTED, { appId: this.appId });

    // Clear all registrations
    this.mountCallbacks = [];
    this.unmountCallbacks = [];
    this.pauseCallbacks = [];
    this.resumeCallbacks = [];
    this.dataLoaders = [];
    this.cleanups = [];

    this.state.set("idle");
  }

  /**
   * Pause the miniapp. Runs pause callbacks and transitions to "paused" state.
   */
  pause(): void {
    if (this.state.get() !== "active") return;
    this.state.set("paused");
    for (const callback of this.pauseCallbacks) {
      try {
        callback();
      } catch (err) {
        console.error(`[LifecycleService] Pause callback error in ${this.appId}:`, err);
      }
    }
  }

  /**
   * Resume the miniapp from paused state. Runs resume callbacks.
   */
  resume(): void {
    if (this.state.get() !== "paused") return;
    this.state.set("active");
    for (const callback of this.resumeCallbacks) {
      try {
        callback();
      } catch (err) {
        console.error(`[LifecycleService] Resume callback error in ${this.appId}:`, err);
      }
    }
  }
}

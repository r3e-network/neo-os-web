/**
 * S8 app.lifecycle — mount/unmount, data loading and polling surface
 * (framework-extraction plan §2/S8).
 *
 * Retires the 19 hand-rolled pollers (explorer dual-cadence tickers,
 * daily-checkin's 1s ticker, neo-message poll windows): `poll()` gives every
 * app the same interval loop with visibility pausing and automatic disposal
 * on unmount.
 *
 * Binds the injected `ctx.services.lifecycle`
 * (apps/shared/services/LifecycleService) when the host provides one;
 * otherwise runs a standalone implementation with the same ordering
 * guarantees (mount callbacks in registration order, unmount callbacks LIFO,
 * cleanups after unmount callbacks). Visibility pausing always uses the
 * document `visibilitychange` signal — LifecycleService's pause()/resume()
 * hooks have zero callers today, so `document.hidden` is the one reliable
 * "user left the tab" source in every host.
 */

/**
 * Structural shape of apps/shared/services/LifecycleService — the injected
 * platform service. Optional: absent on OneGate/standalone hosts.
 * mount/unmount are optional because the platform shell, not the surface,
 * normally drives them.
 */
export interface LifecycleSurfaceService {
  onMount(callback: () => void | Promise<void>): void;
  onUnmount(callback: () => void): void;
  onDataLoad(loader: () => Promise<void>): void;
  reloadData(): Promise<void>;
  registerCleanup(cleanup: () => void): void;
  mount?(): Promise<void>;
  unmount?(): void;
}

export interface LifecycleSurfaceDeps {
  lifecycle?: LifecycleSurfaceService;
}

export interface FrameworkPollOptions {
  /** Run the callback immediately on start (default true). */
  immediate?: boolean;
  /**
   * Pause the interval while `document.hidden` and resume — with an immediate
   * catch-up run — when the tab becomes visible again (default true).
   */
  pauseWhenHidden?: boolean;
}

/**
 * Build the `app.lifecycle` surface.
 *
 * @param deps.lifecycle injected LifecycleService when the platform host
 *                       provides one; omitted on OneGate/standalone embeds
 */
export function createLifecycleSurface(deps: LifecycleSurfaceDeps = {}) {
  const service = deps.lifecycle;

  // ── standalone registries (unused when a service is bound) ──────────────
  let mounted = false;
  let mountCallbacks: Array<() => void | Promise<void>> = [];
  let unmountCallbacks: Array<() => void> = [];
  let dataLoaders: Array<() => void | Promise<void>> = [];
  let cleanups: Array<() => void> = [];

  const runLoaders = async (): Promise<void> => {
    // Parity with LifecycleService.reloadData: loaders run in parallel and a
    // rejected loader never breaks the others (the service reports failures
    // on the platform bus; standalone has no bus, so they are swallowed).
    await Promise.allSettled(dataLoaders.map(async (loader) => loader()));
  };

  const registerCleanup = (fn: () => void): void => {
    if (service) {
      service.registerCleanup(fn);
      return;
    }
    cleanups.push(fn);
  };

  const surface = {
    /** Register a mount callback (run in registration order; async awaited). */
    onMount(fn: () => void | Promise<void>): void {
      if (service) {
        service.onMount(fn);
        return;
      }
      mountCallbacks.push(fn);
    },

    /** Register an unmount callback (run in reverse registration order). */
    onUnmount(fn: () => void): void {
      if (service) {
        service.onUnmount(fn);
        return;
      }
      unmountCallbacks.push(fn);
    },

    /**
     * Register a data loader. Loaders run after mount callbacks complete and
     * re-run on every `reload()` ("pull to refresh").
     */
    onData(loader: () => void | Promise<void>): void {
      if (service) {
        service.onDataLoad(async () => {
          await loader();
        });
        return;
      }
      dataLoaders.push(loader);
    },

    /** Re-run every registered data loader. */
    async reload(): Promise<void> {
      if (service) {
        await service.reloadData();
        return;
      }
      await runLoaders();
    },

    /**
     * Register a cleanup function, run during unmount after the unmount
     * callbacks. Use for timers, subscriptions and event listeners.
     */
    cleanup(fn: () => void): void {
      registerCleanup(fn);
    },

    /**
     * Start an interval poller. Returns a disposer; the poller is ALSO
     * auto-disposed on unmount, so fire-and-forget usage is safe.
     *
     * Defaults: runs immediately on start and pauses while the tab is hidden
     * (resuming with an immediate catch-up run). Errors thrown by `fn` are
     * swallowed so one failed tick never kills the poller.
     */
    poll(fn: () => void | Promise<void>, ms: number, options: FrameworkPollOptions = {}): () => void {
      const immediate = options.immediate !== false;
      const pauseWhenHidden = options.pauseWhenHidden !== false;
      let timer: ReturnType<typeof setInterval> | null = null;
      let stopped = false;

      const tick = (): void => {
        try {
          const result = fn();
          if (result && typeof (result as Promise<unknown>).catch === "function") {
            (result as Promise<unknown>).catch(() => {
              /* keep polling after a failed async tick */
            });
          }
        } catch {
          /* keep polling after a failed sync tick */
        }
      };

      const start = (runNow: boolean): void => {
        if (stopped || timer !== null) return;
        timer = setInterval(tick, ms);
        if (runNow) tick();
      };

      const pause = (): void => {
        if (timer === null) return;
        clearInterval(timer);
        timer = null;
      };

      let removeVisibilityListener: (() => void) | null = null;
      const hasDocument = typeof document !== "undefined";
      if (pauseWhenHidden && hasDocument) {
        const onVisibilityChange = (): void => {
          if (document.hidden) {
            pause();
          } else {
            start(true);
          }
        };
        document.addEventListener("visibilitychange", onVisibilityChange);
        removeVisibilityListener = () =>
          document.removeEventListener("visibilitychange", onVisibilityChange);
      }

      const startHidden = pauseWhenHidden && hasDocument && document.hidden;
      if (!startHidden) start(immediate);

      const stop = (): void => {
        if (stopped) return;
        stopped = true;
        pause();
        removeVisibilityListener?.();
        removeVisibilityListener = null;
      };

      registerCleanup(stop);
      return stop;
    },

    /**
     * Host hook: drive the mount lifecycle. Delegates to the injected service
     * when bound (the platform shell usually calls the service directly);
     * standalone embeds call this from their setup path.
     */
    async mount(): Promise<void> {
      if (service) {
        await service.mount?.();
        return;
      }
      if (mounted) return;
      mounted = true;
      for (const callback of mountCallbacks) {
        try {
          await callback();
        } catch {
          /* one failed mount callback must not block the rest */
        }
      }
      if (dataLoaders.length > 0) await runLoaders();
    },

    /**
     * Host hook: drive the unmount lifecycle — unmount callbacks in reverse
     * registration order, then cleanups, then clear every registration.
     */
    unmount(): void {
      if (service) {
        service.unmount?.();
        return;
      }
      if (!mounted) return;
      mounted = false;
      for (let index = unmountCallbacks.length - 1; index >= 0; index -= 1) {
        try {
          unmountCallbacks[index]?.();
        } catch {
          /* one failed unmount callback must not block the rest */
        }
      }
      for (const fn of cleanups) {
        try {
          fn();
        } catch {
          /* one failed cleanup must not block the rest */
        }
      }
      mountCallbacks = [];
      unmountCallbacks = [];
      dataLoaders = [];
      cleanups = [];
    },
  };

  return surface;
}

export type FrameworkLifecycleSurface = ReturnType<typeof createLifecycleSurface>;

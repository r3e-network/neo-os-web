export interface UseTickerOptions {
  immediate?: boolean;
}

export function useTicker(onTick: () => void, intervalMs = 1000, options: UseTickerOptions = {}) {
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let started = false;

  const stop = () => {
    if (!intervalId) return;
    clearInterval(intervalId);
    intervalId = null;
    started = false;
  };

  const start = () => {
    stop();
    // Set interval first so it always runs regardless of immediate tick outcome
    intervalId = setInterval(onTick, intervalMs);
    started = true;
    if (options.immediate) {
      try {
        onTick();
      } catch (_e) {
        // Immediate tick failed — interval still running, will retry
      }
    }
  };

  /** Cleanup function — caller is responsible for invoking on teardown. */
  const dispose = () => {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
      started = false;
    }
  };

  return {
    start,
    stop,
    isStarted: () => started,
    dispose,
  };
}

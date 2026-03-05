import { onUnmounted } from "vue";

export interface UseTickerOptions {
  immediate?: boolean;
}

export function useTicker(onTick: () => void, intervalMs = 1000, options: UseTickerOptions = {}) {
  let intervalId: ReturnType<typeof setInterval> | null = null;

  const stop = () => {
    if (!intervalId) return;
    clearInterval(intervalId);
    intervalId = null;
  };

  const start = () => {
    stop();
    if (options.immediate) {
      onTick();
    }
    intervalId = setInterval(onTick, intervalMs);
  };

  onUnmounted(stop);

  return {
    start,
    stop,
  };
}

/**
 * Shared fetch-with-timeout helper.
 *
 * Wraps the global fetch with an AbortController-backed deadline so a single
 * hung connection (degraded indexer, dead edge endpoint) can never suspend a
 * "timeout-bounded" polling loop or lock a payment flow's UI forever.
 *
 * Dependency-free. Callers may pass their own AbortSignal via `init.signal`;
 * it is linked to the internal controller (either abort wins) and the abort
 * listener is always removed, so repeated calls against a long-lived signal
 * do not pile up listeners.
 */

export const DEFAULT_FETCH_TIMEOUT_MS = 10_000;

export interface FetchWithTimeoutInit extends RequestInit {
  /** Hard deadline for the whole request. Defaults to DEFAULT_FETCH_TIMEOUT_MS. */
  timeoutMs?: number;
}

export class FetchTimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(url: string, timeoutMs: number) {
    super(`Request to ${url} timed out after ${timeoutMs}ms`);
    this.name = "FetchTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

export async function fetchWithTimeout(
  input: string | URL,
  init: FetchWithTimeoutInit = {},
): Promise<Response> {
  const { timeoutMs = DEFAULT_FETCH_TIMEOUT_MS, signal, ...rest } = init;
  const url = String(input);
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onCallerAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", onCallerAbort, { once: true });
  }
  try {
    return await fetch(url, { ...rest, signal: controller.signal });
  } catch (error) {
    // Normalize the opaque AbortError from our own deadline into a
    // descriptive, instanceof-checkable error; caller-initiated aborts
    // propagate unchanged so abort handling stays distinguishable.
    if (timedOut) throw new FetchTimeoutError(url, timeoutMs);
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onCallerAbort);
  }
}

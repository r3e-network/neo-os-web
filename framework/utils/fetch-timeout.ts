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
 *
 * Canonical home of apps/shared/utils/fetch-timeout.ts — shared re-exports
 * from here so `instanceof FetchTimeoutError` / `HttpResponseError` checks
 * resolve to a single class identity everywhere.
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

/**
 * Error carrying the HTTP status of a non-2xx response, so retry predicates can
 * tell a transient server-side failure (5xx / 429) apart from a deterministic
 * client error (4xx) that re-issuing the same request will never fix.
 */
export class HttpResponseError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "HttpResponseError";
    this.status = status;
  }
}

/**
 * Classify a thrown fetch error as transient (worth retrying) or not.
 *
 * Transient = our own deadline fired (FetchTimeoutError), a low-level network
 * failure (TypeError "Failed to fetch", DNS/connection reset — `fetch` rejects
 * with no HTTP status), or a server-side HTTP status the server may recover
 * from on its own (429 Too Many Requests, any 5xx). A 4xx is deterministic:
 * the request itself is wrong, so retrying only delays the inevitable failure
 * and can mask bugs — those return false.
 *
 * A caller-initiated abort (AbortError, propagated unchanged by
 * fetchWithTimeout) is NOT transient: the caller cancelled on purpose and must
 * not be silently re-issued.
 */
export function isTransientFetchError(error: unknown): boolean {
  if (error instanceof FetchTimeoutError) return true;
  if (error instanceof HttpResponseError) {
    return error.status === 429 || error.status >= 500;
  }
  if (error instanceof Error) {
    if (error.name === "AbortError") return false;
    // `fetch` rejects with a TypeError for network-layer failures (offline,
    // DNS, connection reset) — no Response, no status — which are retryable.
    if (error.name === "TypeError") return true;
  }
  return false;
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

export const DEFAULT_FETCH_TIMEOUT_MS = 10_000;

export interface FetchWithTimeoutInit extends RequestInit {
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

export class HttpResponseError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "HttpResponseError";
    this.status = status;
  }
}

export function isTransientFetchError(error: unknown): boolean {
  if (error instanceof FetchTimeoutError) return true;
  if (error instanceof HttpResponseError) {
    return error.status === 429 || error.status >= 500;
  }
  if (error instanceof Error) {
    if (error.name === "AbortError") return false;
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
    if (timedOut) throw new FetchTimeoutError(url, timeoutMs);
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onCallerAbort);
  }
}

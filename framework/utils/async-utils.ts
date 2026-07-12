/**
 * Async helpers — timeout, retry, polling, safe wrappers.
 *
 * These are domain-neutral patterns for working with promises. Error
 * classes live in ./errors. See examples in each function's JSDoc.
 *
 * Canonical home of the helpers formerly duplicated in
 * apps/shared/utils/async-utils.ts — shared re-exports from here.
 */

import { MiniAppError } from "./errors";

export async function handleAsync<T>(
  operation: () => Promise<T>,
  options?: {
    context?: string;
    onError?: (error: Error) => void;
    rethrow?: boolean;
  },
): Promise<{ success: true; data: T } | { success: false; error: Error }> {
  const { context, onError, rethrow = false } = options || {};

  try {
    const data = await operation();
    return { success: true, data };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));

    if (context) {
      err.message = `${context}: ${err.message}`;
    }

    if (onError) {
      onError(err);
    }

    if (rethrow) {
      throw err;
    }

    return { success: false, error: err };
  }
}

export async function handleContractOperation<T>(
  operation: () => Promise<T>,
  translator: (key: string) => string,
  options?: {
    statusRef?: { value: { msg: string; type: "success" | "error" } | null };
    rethrow?: boolean;
  },
): Promise<T | null> {
  const { statusRef, rethrow = false } = options || {};

  try {
    const result = await operation();
    return result;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const userMessage = translator("error");

    if (statusRef) {
      statusRef.value = { msg: userMessage || message, type: "error" };
    }

    if (rethrow) {
      const errMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`Contract operation failed: ${errMsg}`);
    }

    return null;
  }
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string = "Operation timed out",
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
}

export async function retryAsync<T>(
  operation: () => Promise<T>,
  options?: {
    maxAttempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
    onRetry?: (attempt: number, error: Error) => void;
    /**
     * Decide whether a thrown error is worth retrying. Return `false` to fail
     * fast (e.g. a deterministic HTTP 4xx that re-issuing will never fix).
     * Omitted → every error is retried until attempts are exhausted (the
     * original behavior).
     */
    shouldRetry?: (error: Error) => boolean;
  },
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 1000,
    maxDelayMs = 10000,
    backoffMultiplier = 2,
    onRetry,
    shouldRetry,
  } = options || {};

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // A non-transient error (per the caller's predicate) is rethrown
      // immediately and verbatim — no backoff, no attempt-count wrapping —
      // so deterministic failures stay fast and keep their original message.
      if (shouldRetry && !shouldRetry(lastError)) {
        throw lastError;
      }

      if (attempt === maxAttempts) {
        break;
      }

      const delay = Math.min(
        baseDelayMs * Math.pow(backoffMultiplier, attempt - 1),
        maxDelayMs,
      );

      if (onRetry) {
        onRetry(attempt, lastError);
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError
    ? new Error(
        `retryAsync(${maxAttempts} attempts) failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
      )
    : new Error(`retryAsync(${maxAttempts} attempts) failed: unknown error`);
}

const ERROR_CODE_EVENT_NOT_FOUND = "EVENT_NOT_FOUND";

export async function pollForEvent<T>(
  fetch: () => Promise<T[]>,
  predicate: (item: T) => boolean,
  options?: {
    timeoutMs?: number;
    pollIntervalMs?: number;
    errorMessage?: string;
  },
): Promise<T | null> {
  const {
    timeoutMs = 10_000,
    pollIntervalMs = 1500,
    errorMessage = "Event not found in time",
  } = options || {};

  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const items = await fetch();
    const found = items.find(predicate);

    if (found) {
      return found;
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new MiniAppError(
    errorMessage,
    ERROR_CODE_EVENT_NOT_FOUND,
    undefined,
    undefined,
    undefined,
    ERROR_CODE_EVENT_NOT_FOUND,
  );
}

export async function safeAsync<T>(
  operation: () => Promise<T>,
  defaultValue: T,
): Promise<T> {
  try {
    return await operation();
  } catch (_e) {
    return defaultValue;
  }
}

/** Options for {@link singleFlight} — `"join"` shares the in-flight promise. */
export interface SingleFlightJoinOptions {
  mode: "join";
}

/** Options for {@link singleFlight} — `"drop"` resolves `undefined` for re-entry. */
export interface SingleFlightDropOptions {
  mode: "drop";
  /** Observer invoked (with the computed key) whenever a call is dropped. */
  onDrop?: (key: string) => void;
}

/**
 * Per-key concurrency limiter — the ONE canonical single-flight used by the
 * framework's two write-lane idioms (RFC P0-2):
 *
 * - `"join"`: a second call for the same key while one is in flight receives
 *   the SAME promise (exactly one underlying run — the `credits.spend`
 *   semantics). Use when callers need the result (payments, spends).
 * - `"drop"`: a second call for the same key resolves `undefined` without
 *   running (the `actions.run` double-click semantics). `onDrop` gives the
 *   host a dev-visibility hook so silent drops stop being a DX trap.
 *
 * Keys are computed per call via `keyOf(...args)`; different keys run
 * concurrently. The key is released when the underlying promise settles
 * (resolve or reject).
 *
 * @example
 * ```ts
 * const spend = singleFlight((action: string) => action, doSpend, { mode: "join" });
 * const [a, b] = [spend("buy"), spend("buy")]; // one doSpend call, shared result
 *
 * const run = singleFlight((key: string) => key, doRun, {
 *   mode: "drop",
 *   onDrop: (key) => console.warn(`[actions] dropped re-entrant run: ${key}`),
 * });
 * ```
 */
export function singleFlight<A extends unknown[], R>(
  keyOf: (...args: A) => string,
  fn: (...args: A) => Promise<R>,
  options: SingleFlightJoinOptions,
): (...args: A) => Promise<R>;
export function singleFlight<A extends unknown[], R>(
  keyOf: (...args: A) => string,
  fn: (...args: A) => Promise<R>,
  options: SingleFlightDropOptions,
): (...args: A) => Promise<R | undefined>;
export function singleFlight<A extends unknown[], R>(
  keyOf: (...args: A) => string,
  fn: (...args: A) => Promise<R>,
  options: SingleFlightJoinOptions | SingleFlightDropOptions,
): (...args: A) => Promise<R | undefined> {
  const inFlight = new Map<string, Promise<R>>();
  return (...args: A): Promise<R | undefined> => {
    const key = keyOf(...args);
    const existing = inFlight.get(key);
    if (existing) {
      if (options.mode === "join") return existing;
      options.onDrop?.(key);
      return Promise.resolve(undefined);
    }
    const flight = (async () => fn(...args))();
    inFlight.set(key, flight);
    const release = () => {
      if (inFlight.get(key) === flight) inFlight.delete(key);
    };
    flight.then(release, release);
    return flight;
  };
}

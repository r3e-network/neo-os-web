/**
 * Async helpers — timeout, retry, polling, safe wrappers.
 *
 * These are domain-neutral patterns for working with promises. Error
 * classes live in ./errors. See examples in each function's JSDoc.
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
  },
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 1000,
    maxDelayMs = 10000,
    backoffMultiplier = 2,
    onRetry,
  } = options || {};

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));

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

/**
 * Standardized error handling utilities for miniapps
 *
 * This module provides consistent error handling patterns to replace
 * scattered try-catch blocks and inconsistent error reporting.
 */

/**
 * Base error class for miniapp errors
 */
export class MiniAppError extends Error {
  constructor(
    message: string,
    public code: string,
    public userMessage?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "MiniAppError";
  }
}

/**
 * Wallet connection error
 */
export class WalletConnectionError extends MiniAppError {
  constructor(message: string, details?: unknown) {
    super(
      message,
      "WALLET_CONNECTION",
      "Please connect your wallet to continue.",
      details,
    );
    this.name = "WalletConnectionError";
  }
}

/**
 * Contract interaction error
 */
export class ContractError extends MiniAppError {
  constructor(message: string, details?: unknown) {
    super(
      message,
      "CONTRACT_ERROR",
      "Contract operation failed. Please try again.",
      details,
    );
    this.name = "ContractError";
  }
}

/**
 * Transaction error
 */
export class TransactionError extends MiniAppError {
  constructor(message: string, details?: unknown) {
    super(
      message,
      "TRANSACTION_ERROR",
      "Transaction failed. Please check your balance and try again.",
      details,
    );
    this.name = "TransactionError";
  }
}

/**
 * Insufficient balance error
 */
export class InsufficientBalanceError extends MiniAppError {
  constructor(required: number, available: number, symbol: string = "GAS") {
    const message = `Insufficient ${symbol} balance. Required: ${required}, Available: ${available}`;
    super(message, "INSUFFICIENT_BALANCE", `Insufficient ${symbol} balance.`, {
      required,
      available,
      symbol,
    });
    this.name = "InsufficientBalanceError";
  }
}

/**
 * Network error
 */
export class NetworkError extends MiniAppError {
  constructor(message: string, details?: unknown) {
    super(
      message,
      "NETWORK_ERROR",
      "Network error. Please check your connection and try again.",
      details,
    );
    this.name = "NetworkError";
  }
}

/**
 * Validation error
 */
export class ValidationError extends MiniAppError {
  constructor(message: string, field?: string, details?: unknown) {
    const detailsObj =
      typeof details === "object" && details !== null ? details : {};
    super(
      message,
      "VALIDATION_ERROR",
      "Invalid input. Please check and try again.",
      { field, ...detailsObj },
    );
    this.name = "ValidationError";
  }
}

/**
 * Type guard to check if error is a MiniAppError
 */
export function isMiniAppError(error: unknown): error is MiniAppError {
  return error instanceof MiniAppError;
}

/**
 * Handle async operation with consistent error reporting
 *
 * @example
 * ```ts
 * const result = await handleAsync(
 *   async () => {
 *     await someOperation();
 *     return { success: true };
 *   },
 *   {
 *     context: "Buying ticket",
 *     onError: (error) => {
 *       status.value = { msg: error.userMessage || error.message, type: "error" };
 *     }
 *   }
 * );
 * ```
 */
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
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));

    // Add context to error message if provided
    if (context) {
      err.message = `${context}: ${err.message}`;
    }

    // Call error handler if provided
    if (onError) {
      onError(err);
    }

    // Rethrow if requested
    if (rethrow) {
      throw err;
    }

    return { success: false, error: err };
  }
}

/**
 * Wrap a contract operation with standard error handling
 *
 * @example
 * ```ts
 * const result = await handleContractOperation(
 *   async () => {
 *     return await invokeContract({
 *       scriptHash: contract,
 *       operation: "myMethod",
 *       args: []
 *     });
 *   },
 *   t,
 *   { status }
 * );
 * ```
 */
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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const userMessage = translator("error");

    if (statusRef) {
      statusRef.value = { msg: userMessage || message, type: "error" };
    }

    if (rethrow) {
      throw error;
    }

    return null;
  }
}

/**
 * Create a status object for error reporting
 *
 * @example
 * ```ts
 * const status = createStatus();
 *
 * const result = await handleAsync(
 *   async () => someOperation(),
 *   {
 *     onError: (error) => {
 *       status.setError(error.message);
 *     }
 *   }
 * );
 * ```
 */
export function createStatusRef() {
  let value: { msg: string; type: "success" | "error" } | null = null;

  return {
    get value() {
      return value;
    },
    set value(newValue: { msg: string; type: "success" | "error" } | null) {
      value = newValue;
    },
    setError: (message: string) => {
      value = { msg: message, type: "error" };
    },
    setSuccess: (message: string) => {
      value = { msg: message, type: "success" };
    },
    clear: () => {
      value = null;
    },
  };
}

/**
 * Format error for user display
 */
export function formatErrorMessage(
  error: unknown,
  defaultMessage: string = "An error occurred",
): string {
  if (isMiniAppError(error)) {
    return error.userMessage || error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return defaultMessage;
}

/**
 * Create timeout promise for async operations
 *
 * @example
 * ```ts
 * const result = await withTimeout(
 *   longRunningOperation(),
 *   5000,
 *   "Operation timed out"
 * );
 * ```
 */
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

/**
 * Retry an async operation with exponential backoff
 *
 * @example
 * ```ts
 * const result = await retryAsync(
 *   async () => await fetchEventData(),
 *   {
 *     maxAttempts: 3,
 *     baseDelayMs: 1000
 *   }
 * );
 * ```
 */
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
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxAttempts) {
        break;
      }

      // Calculate delay with exponential backoff
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

  throw lastError;
}

/**
 * Poll for an event with timeout
 *
 * @example
 * ```ts
 * const event = await pollForEvent(
 *   async () => await listEvents({ app_id: APP_ID, event_name: "MyEvent", limit: 1 }),
 *   (events) => events.find(e => e.tx_hash === txid),
 *   {
 *     timeoutMs: 30000,
 *     pollIntervalMs: 1500,
 *     errorMessage: "Event not found in time"
 *   }
 * );
 * ```
 */
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
    timeoutMs = 30000,
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

  throw new Error(errorMessage);
}

/**
 * Safely execute a function and return null if it fails
 *
 * @example
 * ```ts
 * const balance = await safeAsync(
 *   () => await getBalance("NEO"),
 *   0
 * );
 * ```
 */
export async function safeAsync<T>(
  operation: () => Promise<T>,
  defaultValue: T,
): Promise<T> {
  try {
    return await operation();
  } catch {
    return defaultValue;
  }
}

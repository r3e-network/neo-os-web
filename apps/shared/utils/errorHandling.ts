/**
 * Standardized error handling utilities for miniapps
 *
 * This module provides consistent error handling patterns to replace
 * scattered try-catch blocks and inconsistent error reporting.
 */

type Translator = (key: string) => string;

/**
 * Base error class for miniapp errors
 */
export class MiniAppError extends Error {
  constructor(
    message: string,
    public code: string,
    public userMessage?: string,
    public details?: unknown,
    public _translator?: Translator,
    public _userMessageKey?: string,
  ) {
    super(message);
    this.name = "MiniAppError";
  }

  get translatedUserMessage(): string | undefined {
    if (this.userMessage) return this.userMessage;
    if (this._translator && this._userMessageKey) {
      return this._translator(this._userMessageKey);
    }
    return undefined;
  }
}

/**
 * Wallet connection error
 */
export class WalletConnectionError extends MiniAppError {
  constructor(message: string, details?: unknown, translator?: Translator) {
    const userMessageKey = "walletConnectionError";
    super(
      message,
      "WALLET_CONNECTION",
      translator ? translator(userMessageKey) : "Please connect your wallet to continue.",
      details,
      translator,
      userMessageKey,
    );
    this.name = "WalletConnectionError";
  }
}

/**
 * Contract interaction error
 */
export class ContractError extends MiniAppError {
  constructor(message: string, details?: unknown, translator?: Translator) {
    const userMessageKey = "contractError";
    super(
      message,
      "CONTRACT_ERROR",
      translator ? translator(userMessageKey) : "Contract operation failed. Please try again.",
      details,
      translator,
      userMessageKey,
    );
    this.name = "ContractError";
  }
}

/**
 * Transaction error
 */
export class TransactionError extends MiniAppError {
  constructor(message: string, details?: unknown, translator?: Translator) {
    const userMessageKey = "transactionError";
    super(
      message,
      "TRANSACTION_ERROR",
      translator ? translator(userMessageKey) : "Transaction failed. Please check your balance and try again.",
      details,
      translator,
      userMessageKey,
    );
    this.name = "TransactionError";
  }
}

/**
 * Insufficient balance error
 */
export class InsufficientBalanceError extends MiniAppError {
  constructor(required: number, available: number, symbol: string = "GAS", translator?: Translator) {
    const message = `Insufficient ${symbol} balance. Required: ${required}, Available: ${available}`;
    const userMessageKey = "insufficientBalanceError";
    super(
      message,
      "INSUFFICIENT_BALANCE",
      translator ? translator(userMessageKey) : `Insufficient ${symbol} balance.`,
      { required, available, symbol },
      translator,
      userMessageKey,
    );
    this.name = "InsufficientBalanceError";
  }
}

/**
 * Network error
 */
export class NetworkError extends MiniAppError {
  constructor(message: string, details?: unknown, translator?: Translator) {
    const userMessageKey = "networkError";
    super(
      message,
      "NETWORK_ERROR",
      translator ? translator(userMessageKey) : "Network error. Please check your connection and try again.",
      details,
      translator,
      userMessageKey,
    );
    this.name = "NetworkError";
  }
}

/**
 * Validation error
 */
export class ValidationError extends MiniAppError {
  constructor(message: string, field?: string, details?: unknown, translator?: Translator) {
    const detailsObj =
      typeof details === "object" && details !== null ? details : {};
    const userMessageKey = "validationError";
    super(
      message,
      "VALIDATION_ERROR",
      translator ? translator(userMessageKey) : "Invalid input. Please check and try again.",
      { field, ...detailsObj },
      translator,
      userMessageKey,
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
  } catch (error: unknown) {
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
    return error.translatedUserMessage || error.userMessage || error.message;
  }

  if (error instanceof Error) {
    const msg = error.message;
    // Check if message looks like a user-friendly message (short, no technical artifacts)
    if (
      typeof msg === "string" &&
      msg.length > 0 &&
      msg.length < 100 &&
      !msg.includes("0x") && // No hex addresses/hashes
      !msg.includes("http") && // No URLs
      !msg.includes("stack") &&
      !msg.includes("\n") &&
      !msg.includes("at ") // No stack trace lines
    ) {
      return msg;
    }
    // Message looks like internal details - use default
    return defaultMessage;
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
    } catch (error: unknown) {
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

  throw lastError
    ? new Error(`retryAsync(${maxAttempts} attempts) failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`)
    : new Error(`retryAsync(${maxAttempts} attempts) failed: unknown error`);
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

  throw new MiniAppError(errorMessage, ERROR_CODE_EVENT_NOT_FOUND, undefined, undefined, undefined, ERROR_CODE_EVENT_NOT_FOUND);
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
  } catch (_e: unknown) {
    return defaultValue;
  }
}

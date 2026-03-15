/**
 * Error Handler Composable
 *
 * Provides centralized error handling with user-friendly messages,
 * error categorization, and integration with async operations.
 *
 * @example
 * ```ts
 * const { handleError, getUserMessage, errorCategory } = useErrorHandler();
 *
 * try {
 *   await someAsyncOperation();
 * } catch (e) {
 *   handleError(e, 'Contract interaction');
 *   showToast(getUserMessage(e));
 * }
 * ```
 */

import { ref, type Ref } from "vue";

export type ErrorCategory =
  | "wallet"
  | "network"
  | "contract"
  | "validation"
  | "timeout"
  | "unknown";

export interface ErrorContext {
  /** Operation context for debugging */
  operation?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface ErrorHandlerState {
  /** Last error message */
  lastError: Ref<string | null>;
  /** Last error category */
  lastCategory: Ref<ErrorCategory | null>;
  /** Whether error is recoverable */
  isRecoverable: Ref<boolean>;
}

// Error message mappings for user-friendly display
const ERROR_MESSAGES: Record<string, Record<ErrorCategory, string>> = {
  en: {
    wallet: "Please connect your wallet and try again",
    network: "Network error. Please check your connection and retry",
    contract: "Contract interaction failed. Please try again later",
    validation: "Invalid input. Please check your entries and try again",
    timeout: "Operation timed out. Please try again",
    unknown: "An unexpected error occurred. Please try again",
  },
};

// Error patterns for categorization
const ERROR_PATTERNS: { pattern: RegExp; category: ErrorCategory }[] = [
  { pattern: /wallet|address|connect|account/i, category: "wallet" },
  { pattern: /network|fetch|timeout|connection|offline/i, category: "network" },
  { pattern: /contract|invoke|gas|revert|execution/i, category: "contract" },
  { pattern: /invalid|validation|required|format|range/i, category: "validation" },
  { pattern: /timeout|expired/i, category: "timeout" },
];

/**
 * Categorize an error based on its message
 */
function categorizeError(error: unknown): ErrorCategory {
  const message = error instanceof Error ? error.message : String(error);

  for (const { pattern, category } of ERROR_PATTERNS) {
    if (pattern.test(message)) {
      return category;
    }
  }

  return "unknown";
}

/**
 * Check if error is recoverable (can be retried)
 */
function isRecoverableError(category: ErrorCategory): boolean {
  return category === "network" || category === "timeout" || category === "unknown";
}

/**
 * Create error handler composable
 */
export function useErrorHandler(): ErrorHandlerState & {
  /** Handle and categorize an error */
  handleError: (error: unknown, context?: ErrorContext) => void;
  /** Get user-friendly message for error */
  getUserMessage: (error: unknown, category?: ErrorCategory) => string;
  /** Clear error state */
  clearError: () => void;
  /** Get error category */
  getCategory: (error: unknown) => ErrorCategory;
  /** Check if error is retryable */
  canRetry: (error: unknown) => boolean;
  /** Log error for debugging */
  logError: (error: unknown, context?: ErrorContext) => void;
} {
  const lastError = ref<string | null>(null);
  const lastCategory = ref<ErrorCategory | null>(null);
  const isRecoverable = ref<boolean>(false);

  /**
   * Get user-friendly message for error
   */
  const getUserMessage = (error: unknown, category?: ErrorCategory): string => {
    const cat = category || categorizeError(error);
    const messages = ERROR_MESSAGES.en;
    return messages[cat] || messages.unknown;
  };

  /**
   * Get error category
   */
  const getCategory = (error: unknown): ErrorCategory => {
    return categorizeError(error);
  };

  /**
   * Check if error can be retried
   */
  const canRetry = (error: unknown): boolean => {
    const category = categorizeError(error);
    return isRecoverableError(category);
  };

  /**
   * Log error with context for debugging
   */
  const logError = (error: unknown, context?: ErrorContext): void => {
    const category = categorizeError(error);
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    console.error("[ErrorHandler]", {
      category,
      message,
      stack,
      context: context?.operation,
      metadata: context?.metadata,
      timestamp: new Date().toISOString(),
    });

    // In production, you might send to error tracking service
    if (process.env.NODE_ENV === "production") {
      // Example: sentry.captureException(error, { extra: context });
    }
  };

  /**
   * Handle error - categorize, log, and update state
   */
  const handleError = (error: unknown, context?: ErrorContext): void => {
    const category = categorizeError(error);
    const message = error instanceof Error ? error.message : String(error);

    lastError.value = message;
    lastCategory.value = category;
    isRecoverable.value = isRecoverableError(category);

    logError(error, context);
  };

  /**
   * Clear error state
   */
  const clearError = (): void => {
    lastError.value = null;
    lastCategory.value = null;
    isRecoverable.value = false;
  };

  return {
    lastError,
    lastCategory,
    isRecoverable,
    handleError,
    getUserMessage,
    clearError,
    getCategory,
    canRetry,
    logError,
  };
}

/**
 * Error Tracking & Reporting
 * Captures, categorizes, and reports frontend errors
 */

import { logger } from "../logger";

// Error types
export type ErrorSeverity = "low" | "medium" | "high" | "critical";

export interface ErrorContext {
  // User info
  userId?: string;
  userAgent?: string;
  // Page context
  url?: string;
  path?: string;
  referrer?: string;
  // Error context
  componentStack?: string;
  extra?: Record<string, unknown>;
  // Timing
  timestamp: number;
  errorId?: string;
}

export interface TrackedError {
  id: string;
  name: string;
  message: string;
  stack?: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  context: ErrorContext;
  // Occurrence tracking
  count: number;
  firstSeen: number;
  lastSeen: number;
  // User impact
  impactedUsers: number;
}

export type ErrorCategory =
  | "javascript"
  | "network"
  | "resource"
  | "render"
  | "validation"
  | "auth"
  | "blockchain"
  | "third_party"
  | "unknown";

// Error store for client-side
const errorStore: Map<string, TrackedError> = new Map();
let errorCount = 0;

/**
 * Initialize global error handlers
 */
export function initErrorTracking(): void {
  if (typeof window === "undefined") return;
  
  // Handle uncaught JavaScript errors
  window.addEventListener("error", handleGlobalError);
  
  // Handle unhandled promise rejections
  window.addEventListener("unhandledrejection", handleUnhandledRejection);
  
  // Handle network errors via fetch intercept
  patchFetch();
  patchXHR();
  
  logger.info("Error tracking initialized");
}

/**
 * Handle global errors
 */
function handleGlobalError(event: ErrorEvent): void {
  const error = new Error(event.message);
  error.name = event.filename;
  error.stack = event.error?.stack;
  
  trackError(error, {
    severity: "high",
    category: "javascript",
    extra: {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    },
  });
  
  // Prevent default browser error handling in development
  if (process.env.NODE_ENV === "development") {
    event.preventDefault?.();
  }
}

/**
 * Handle unhandled promise rejections
 */
function handleUnhandledRejection(event: PromiseRejectionEvent): void {
  const error = event.reason instanceof Error
    ? event.reason
    : new Error(String(event.reason));
  
  trackError(error, {
    severity: "high",
    category: "javascript",
    extra: {
      promiseRejection: true,
    },
  });
  
  // Prevent unhandled rejection warning
  event.preventDefault?.();
}

/**
 * Track and report an error
 */
export function trackError(
  error: Error | string,
  options: {
    severity?: ErrorSeverity;
    category?: ErrorCategory;
    extra?: Record<string, unknown>;
    componentStack?: string;
  } = {},
): string {
  const errorId = generateErrorId();
  const timestamp = Date.now();
  
  // Normalize error
  const errorName = error instanceof Error ? error.name : "UnknownError";
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  
  // Determine severity
  const severity = options.severity ?? determineSeverity(errorName, errorMessage);
  
  // Create error context
  const context: ErrorContext = {
    timestamp,
    errorId,
    url: typeof window !== "undefined" ? window.location.href : undefined,
    path: typeof window !== "undefined" ? window.location.pathname : undefined,
    referrer: typeof document !== "undefined" ? document.referrer : undefined,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    componentStack: options.componentStack,
    extra: options.extra,
  };
  
  // Create or update tracked error
  const existingKey = getErrorKey(errorName, errorMessage);
  let trackedError: TrackedError;
  
  if (errorStore.has(existingKey)) {
    const existing = errorStore.get(existingKey)!;
    existing.count += 1;
    existing.lastSeen = timestamp;
    trackedError = existing;
  } else {
    trackedError = {
      id: errorId,
      name: errorName,
      message: errorMessage,
      stack: errorStack,
      severity,
      category: options.category ?? categorizeError(errorName, errorMessage),
      context,
      count: 1,
      firstSeen: timestamp,
      lastSeen: timestamp,
      impactedUsers: 1,
    };
    errorStore.set(existingKey, trackedError);
  }
  
  errorCount++;
  
  // Log error
  logger.error(`[${trackedError.category}] ${errorName}: ${errorMessage}`, {
    errorId,
    severity,
    count: trackedError.count,
  });
  
  // Send to error reporting service in production
  if (process.env.NODE_ENV === "production") {
    sendErrorToService(trackedError);
  }
  
  return errorId;
}

/**
 * Determine error severity based on error type and message
 */
function determineSeverity(name: string, message: string): ErrorSeverity {
  const messageLower = message.toLowerCase();
  const nameLower = name.toLowerCase();
  
  // Critical errors
  if (
    messageLower.includes("out of memory") ||
    messageLower.includes("stack overflow") ||
    nameLower.includes("rangeerror")
  ) {
    return "critical";
  }
  
  // High severity
  if (
    messageLower.includes("cannot read") ||
    messageLower.includes("is not defined") ||
    messageLower.includes("network error") ||
    messageLower.includes("failed to fetch")
  ) {
    return "high";
  }
  
  // Medium severity
  if (
    messageLower.includes("timeout") ||
    messageLower.includes("permission denied") ||
    messageLower.includes("unauthorized")
  ) {
    return "medium";
  }
  
  return "low";
}

/**
 * Categorize error based on name and message
 */
function categorizeError(name: string, message: string): ErrorCategory {
  const messageLower = message.toLowerCase();
  const nameLower = name.toLowerCase();
  
  if (
    messageLower.includes("fetch") ||
    messageLower.includes("network") ||
    messageLower.includes("request failed") ||
    messageLower.includes("http")
  ) {
    return "network";
  }
  
  if (
    messageLower.includes("script") ||
    messageLower.includes("js") ||
    nameLower.includes("reference") ||
    nameLower.includes("type")
  ) {
    return "javascript";
  }
  
  if (
    messageLower.includes("image") ||
    messageLower.includes("font") ||
    messageLower.includes("resource")
  ) {
    return "resource";
  }
  
  if (
    messageLower.includes("render") ||
    messageLower.includes("component") ||
    messageLower.includes("virtual")
  ) {
    return "render";
  }
  
  if (
    messageLower.includes("validation") ||
    messageLower.includes("invalid") ||
    messageLower.includes("schema")
  ) {
    return "validation";
  }
  
  if (
    messageLower.includes("auth") ||
    messageLower.includes("token") ||
    messageLower.includes("session") ||
    messageLower.includes("permission")
  ) {
    return "auth";
  }
  
  if (
    messageLower.includes("blockchain") ||
    messageLower.includes("neo") ||
    messageLower.includes("wallet") ||
    messageLower.includes("contract")
  ) {
    return "blockchain";
  }
  
  if (
    messageLower.includes("sentry") ||
    messageLower.includes("analytics") ||
    messageLower.includes("third party")
  ) {
    return "third_party";
  }
  
  return "unknown";
}

/**
 * Get error key for deduplication
 */
function getErrorKey(name: string, message: string): string {
  // Normalize message for grouping similar errors
  const normalizedMessage = message
    .replace(/\d{10,}/g, "[NUMBER]")
    .replace(/0x[a-fA-F0-9]+/g, "[ADDRESS]")
    .replace(/\/[a-fA-F0-9]{8,}/g, "[HASH]");
  
  return `${name}:${normalizedMessage}`.slice(0, 200);
}

/**
 * Generate unique error ID
 */
function generateErrorId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Send error to external service
 */
function sendErrorToService(error: TrackedError): void {
  const endpoint = process.env.NEXT_PUBLIC_ERROR_ENDPOINT;
  if (!endpoint) return;
  
  fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "error",
      data: error,
      sessionId: getSessionId(),
    }),
  }).catch(() => {
    // Silently fail
  });
}

/**
 * Get session ID
 */
function getSessionId(): string {
  if (typeof window === "undefined") return "";
  
  const key = "neo_monitoring_session";
  return sessionStorage.getItem(key) || "";
}

/**
 * Get all tracked errors
 */
export function getTrackedErrors(): TrackedError[] {
  return Array.from(errorStore.values()).sort((a, b) => b.lastSeen - a.lastSeen);
}

/**
 * Get error count
 */
export function getErrorCount(): number {
  return errorCount;
}

/**
 * Clear error store (for testing)
 */
export function clearErrorStore(): void {
  errorStore.clear();
  errorCount = 0;
}

/**
 * Patch fetch for error tracking
 */
function patchFetch(): void {
  if (typeof window === "undefined" || !("fetch" in window)) return;
  
  const originalFetch = window.fetch;
  
  window.fetch = async function (...args) {
    const startTime = Date.now();
    
    try {
      const response = await originalFetch.apply(this, args);
      
      // Track failed requests
      if (!response.ok) {
        const url = typeof args[0] === "string" ? args[0] : (args[0] as Request).url;
        trackError(new Error(`HTTP ${response.status}: ${response.statusText}`), {
          severity: response.status >= 500 ? "high" : "medium",
          category: "network",
          extra: {
            url,
            status: response.status,
            statusText: response.statusText,
            duration: Date.now() - startTime,
          },
        });
      }
      
      return response;
    } catch (error) {
      const url = typeof args[0] === "string" ? args[0] : (args[0] as Request)?.url;
      trackError(error instanceof Error ? error : new Error(String(error)), {
        severity: "high",
        category: "network",
        extra: {
          url,
          duration: Date.now() - startTime,
        },
      });
      throw error;
    }
  };
}

/**
 * Patch XHR for error tracking
 */
function patchXHR(): void {
  if (typeof window === "undefined" || !("XMLHttpRequest" in window)) return;
  
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  
  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    ...rest: unknown[]
  ) {
    (this as XMLHttpRequest & { _monitoringUrl?: string })._monitoringUrl = String(url);
    return originalOpen.apply(this, [method, url, ...rest] as Parameters<typeof originalOpen>);
  };
  
  XMLHttpRequest.prototype.send = function (...args) {
    const url = (this as XMLHttpRequest & { _monitoringUrl?: string })._monitoringUrl;
    const startTime = Date.now();
    
    this.addEventListener("load", function () {
      if (this.status >= 400) {
        trackError(new Error(`XHR ${this.status}: ${this.statusText}`), {
          severity: this.status >= 500 ? "high" : "medium",
          category: "network",
          extra: {
            url,
            status: this.status,
            duration: Date.now() - startTime,
          },
        });
      }
    });
    
    this.addEventListener("error", function () {
      trackError(new Error("XHR Network Error"), {
        severity: "high",
        category: "network",
        extra: {
          url,
          duration: Date.now() - startTime,
        },
      });
    });
    
    return originalSend.apply(this, args as Parameters<typeof originalSend>);
  };
}

/**
 * Create error boundary handler for React components
 */
export function createErrorHandler(
  componentName: string,
  options: {
    severity?: ErrorSeverity;
    category?: ErrorCategory;
    extra?: Record<string, unknown>;
  } = {},
) {
  return (error: Error, errorInfo: React.ErrorInfo) => {
    trackError(error, {
      ...options,
      componentStack: errorInfo.componentStack || undefined,
      extra: {
        ...options.extra,
        componentName,
      },
    });
  };
}

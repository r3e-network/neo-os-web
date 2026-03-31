/**
 * Error Tracking & Categorization
 * Categorizes errors for UI display; reporting is handled by Sentry.
 */

import { logger } from "../logger";
import { captureError } from "./sentry";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ErrorSeverity = "low" | "medium" | "high" | "critical";

export interface ErrorContext {
  userId?: string;
  userAgent?: string;
  url?: string;
  path?: string;
  referrer?: string;
  componentStack?: string;
  extra?: Record<string, unknown>;
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
  count: number;
  firstSeen: number;
  lastSeen: number;
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

// ---------------------------------------------------------------------------
// In-memory store (for UI panels that display recent errors)
// ---------------------------------------------------------------------------

const errorStore: Map<string, TrackedError> = new Map();
let errorCount = 0;

// ---------------------------------------------------------------------------
// Initialization (registers global handlers that forward to Sentry)
// ---------------------------------------------------------------------------

let isInitialized = false;

export function initErrorTracking(): void {
  if (typeof window === "undefined" || isInitialized) return;
  isInitialized = true;
  logger.info("Error tracking initialized (Sentry-backed)");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Track and report an error.
 * Categorises for UI, logs locally, and forwards to Sentry.
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
  const errorId = `err_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const timestamp = Date.now();

  const errorName = error instanceof Error ? error.name : "UnknownError";
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  const severity = options.severity ?? determineSeverity(errorName, errorMessage);
  const category = options.category ?? categorizeError(errorName, errorMessage);

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

  // Deduplicate in the local store
  const key = `${errorName}:${errorMessage}`.slice(0, 200);
  const existing = errorStore.get(key);
  if (existing) {
    existing.count += 1;
    existing.lastSeen = timestamp;
  } else {
    errorStore.set(key, {
      id: errorId,
      name: errorName,
      message: errorMessage,
      stack: errorStack,
      severity,
      category,
      context,
      count: 1,
      firstSeen: timestamp,
      lastSeen: timestamp,
      impactedUsers: 1,
    });
  }

  errorCount++;

  logger.error(`[${category}] ${errorName}: ${errorMessage}`, {
    errorId,
    severity,
  });

  // Forward to Sentry
  captureError(error instanceof Error ? error : new Error(errorMessage), {
    extra: { ...options.extra, category, severity, errorId },
  });

  return errorId;
}

/** Get all tracked errors (sorted newest first) */
export function getTrackedErrors(): TrackedError[] {
  return Array.from(errorStore.values()).sort((a, b) => b.lastSeen - a.lastSeen);
}

/** Get total error count */
export function getErrorCount(): number {
  return errorCount;
}

/** Clear the local error store (for testing) */
export function clearErrorStore(): void {
  errorStore.clear();
  errorCount = 0;
}

// ---------------------------------------------------------------------------
// Categorization helpers (kept for UI display)
// ---------------------------------------------------------------------------

function determineSeverity(name: string, message: string): ErrorSeverity {
  const m = message.toLowerCase();
  const n = name.toLowerCase();

  if (m.includes("out of memory") || m.includes("stack overflow") || n.includes("rangeerror")) {
    return "critical";
  }
  if (m.includes("cannot read") || m.includes("is not defined") || m.includes("network error") || m.includes("failed to fetch")) {
    return "high";
  }
  if (m.includes("timeout") || m.includes("permission denied") || m.includes("unauthorized")) {
    return "medium";
  }
  return "low";
}

export function categorizeError(name: string, message: string): ErrorCategory {
  const m = message.toLowerCase();
  const n = name.toLowerCase();

  if (m.includes("fetch") || m.includes("network") || m.includes("request failed") || m.includes("http")) return "network";
  if (m.includes("script") || m.includes("js") || n.includes("reference") || n.includes("type")) return "javascript";
  if (m.includes("image") || m.includes("font") || m.includes("resource")) return "resource";
  if (m.includes("render") || m.includes("component") || m.includes("virtual")) return "render";
  if (m.includes("validation") || m.includes("invalid") || m.includes("schema")) return "validation";
  if (m.includes("auth") || m.includes("token") || m.includes("session") || m.includes("permission")) return "auth";
  if (m.includes("blockchain") || m.includes("neo") || m.includes("wallet") || m.includes("contract")) return "blockchain";
  if (m.includes("sentry") || m.includes("analytics") || m.includes("third party")) return "third_party";
  return "unknown";
}

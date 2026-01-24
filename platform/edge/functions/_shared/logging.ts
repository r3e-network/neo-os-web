/**
 * Request/Response Logging Module
 *
 * Provides structured logging for Edge Functions with support for:
 * - Request tracing with unique IDs
 * - Response timing
 * - Error tracking
 * - Sanitized output (no secrets leaked)
 */

// Deno global type definitions
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// ============================================================================
// Types
// ============================================================================

export interface LogContext {
  requestId: string;
  userId?: string;
  method: string;
  path: string;
  userAgent?: string;
  ip?: string;
}

export interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  context: LogContext;
  message: string;
  duration?: number;
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Request ID Generation
// ============================================================================

/**
 * Generate a unique request ID for tracing
 */
export function generateRequestId(): string {
  return crypto.randomUUID();
}

/**
 * Extract or generate request ID from headers
 */
export function getRequestId(req: Request): string {
  // Check for existing request ID in headers
  const existingId =
    req.headers.get("X-Request-ID") || req.headers.get("X-Request-Id") || req.headers.get("Request-ID");

  return existingId || generateRequestId();
}

// ============================================================================
// Log Context Builder
// ============================================================================

/**
 * Build log context from request
 */
export function buildLogContext(req: Request, userId?: string): LogContext {
  const url = new URL(req.url);

  return {
    requestId: getRequestId(req),
    userId,
    method: req.method,
    path: url.pathname + url.search,
    userAgent: req.headers.get("User-Agent") || undefined,
    ip: req.headers.get("X-Forwarded-For") || req.headers.get("X-Real-IP") || undefined,
  };
}

// ============================================================================
// Sanitization
// ============================================================================

/**
 * Sanitize sensitive data from logs
 */
const SENSITIVE_FIELDS = [
  "password",
  "token",
  "secret",
  "key",
  "authorization",
  "cookie",
  "session",
  "csrf",
  "api_key",
  "apikey",
  "private",
];

function sanitizeObject(obj: unknown): Record<string, unknown> | undefined {
  if (typeof obj !== "object" || obj === null) {
    return undefined;
  }

  if (Array.isArray(obj)) {
    return undefined;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_FIELDS.some((field) => lowerKey.includes(field));

    if (isSensitive && typeof value === "string") {
      sanitized[key] = "***REDACTED***";
    } else if (typeof value === "object") {
      const sanitizedValue = sanitizeObject(value);
      sanitized[key] = sanitizedValue !== undefined ? sanitizedValue : value;
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Sanitize request body for logging
 */
export function sanitizeBody(body: unknown): Record<string, unknown> | undefined {
  return sanitizeObject(body);
}

// ============================================================================
// Logging Functions
// ============================================================================

/**
 * Format log entry as JSON string
 */
function formatLogEntry(entry: LogEntry): string {
  return JSON.stringify(entry);
}

/**
 * Write log to console with appropriate level
 */
function writeLog(entry: LogEntry): void {
  const message = formatLogEntry(entry);

  switch (entry.level) {
    case "error":
      console.error(message);
      break;
    case "warn":
      console.warn(message);
      break;
    case "debug":
      // Only log debug in development
      if (Deno.env.get("DENO_ENV")?.includes("dev")) {
        console.debug(message);
      }
      break;
    case "info":
    default:
      console.log(message);
      break;
  }
}

/**
 * Log an info message
 */
export function logInfo(context: LogContext, message: string, metadata?: Record<string, unknown>): void {
  writeLog({
    timestamp: new Date().toISOString(),
    level: "info",
    context,
    message,
    metadata: metadata ? sanitizeObject(metadata) : undefined,
  });
}

/**
 * Log a warning message
 */
export function logWarn(context: LogContext, message: string, metadata?: Record<string, unknown>): void {
  writeLog({
    timestamp: new Date().toISOString(),
    level: "warn",
    context,
    message,
    metadata: metadata ? sanitizeObject(metadata) : undefined,
  });
}

/**
 * Log an error message
 */
export function logError(
  context: LogContext,
  error: Error | { code: string; message: string },
  metadata?: Record<string, unknown>
): void {
  const errorInfo =
    error instanceof Error ? { code: "INTERNAL_ERROR", message: error.message, stack: error.stack } : error;

  writeLog({
    timestamp: new Date().toISOString(),
    level: "error",
    context,
    message: errorInfo.message,
    error: errorInfo,
    metadata: metadata ? sanitizeObject(metadata) : undefined,
  });
}

/**
 * Log a debug message (only in development)
 */
export function logDebug(context: LogContext, message: string, metadata?: Record<string, unknown>): void {
  writeLog({
    timestamp: new Date().toISOString(),
    level: "debug",
    context,
    message,
    metadata: metadata ? sanitizeObject(metadata) : undefined,
  });
}

// ============================================================================
// Request Logging Middleware
// ============================================================================

/**
 * Log incoming request
 */
export function logRequest(context: LogContext, metadata?: Record<string, unknown>): void {
  logInfo(context, "Incoming request", {
    ...metadata,
    phase: "request",
  });
}

/**
 * Log outgoing response
 */
export function logResponse(
  context: LogContext,
  status: number,
  duration: number,
  metadata?: Record<string, unknown>
): void {
  const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";

  writeLog({
    timestamp: new Date().toISOString(),
    level,
    context,
    message: `Response ${status}`,
    metadata: sanitizeObject({
      ...metadata,
      phase: "response",
      status,
      duration_ms: duration,
    }),
  });
}

// ============================================================================
// Timed Operation Helper
// ============================================================================

/**
 * Create a timer for measuring request duration
 */
export function createTimer(): {
  elapsed: () => number;
} {
  const start = performance.now();

  return {
    elapsed: () => performance.now() - start,
  };
}

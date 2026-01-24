/**
 * Logging Middleware
 *
 * Provides automatic request/response logging for Edge Functions.
 * Wraps a handler function and adds logging without modifying the handler code.
 */

import { buildLogContext, logRequest, logResponse, logError } from "./logging.ts";

// Deno global type definitions
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

export interface LoggingContext {
  request_id: string;
  user_id?: string;
  start_time: number;
}

// Use generic type for Request to avoid import issues
type HandlerRequest = any;
type HandlerResponse = Response;

/**
 * Wrap a handler with automatic request/response logging
 *
 * @param handler - The original handler function
 * @param options - Logging options
 * @returns Wrapped handler with logging
 */
export function withLogging(
  handler: (req: HandlerRequest, ctx: LoggingContext) => Promise<HandlerResponse>,
  options?: {
    endpoint?: string;
    logErrors?: boolean;
  }
): (req: HandlerRequest) => Promise<HandlerResponse> {
  return async (req: HandlerRequest): Promise<HandlerResponse> => {
    const startTime = performance.now();
    const requestId = crypto.randomUUID();

    // Extract user ID from request if available (for auth-validated requests)
    let userId: string | undefined;

    try {
      // Try to get user from various possible sources
      // This works with our auth middleware which sets headers
      const authHeader = req.headers?.get("X-User-ID");
      if (authHeader) {
        userId = authHeader;
      }
    } catch {
      // No user ID available
    }

    const ctx: LoggingContext = {
      request_id: requestId,
      user_id: userId,
      start_time: startTime,
    };

    // Build log context
    const logCtx = buildLogContext(req, userId);

    // Log incoming request
    logRequest(logCtx, {
      endpoint: options?.endpoint || "unknown",
      request_id: requestId,
    });

    try {
      // Call original handler
      const response = await handler(req, ctx);

      // Calculate duration
      const duration = performance.now() - startTime;

      // Log response
      logResponse(logCtx, response.status, duration, {
        request_id: requestId,
      });

      return response;
    } catch (error) {
      // Calculate duration
      const duration = performance.now() - startTime;

      // Log error
      if (options?.logErrors !== false) {
        logError(logCtx, error as Error, {
          request_id: requestId,
          duration_ms: duration,
        });
      }

      // Re-throw the error
      throw error;
    }
  };
}

/**
 * Wrap a standard handler (without context parameter)
 */
export function withSimpleLogging(
  handler: (req: HandlerRequest) => Promise<HandlerResponse>,
  options?: {
    endpoint?: string;
    logErrors?: boolean;
  }
): (req: HandlerRequest) => Promise<HandlerResponse> {
  return async (req: HandlerRequest): Promise<HandlerResponse> => {
    const startTime = performance.now();

    // Build log context (user ID may not be available yet)
    const logCtx = buildLogContext(req);

    // Log incoming request
    logRequest(logCtx, {
      endpoint: options?.endpoint || "unknown",
    });

    try {
      // Call original handler
      const response = await handler(req);

      // Calculate duration
      const duration = performance.now() - startTime;

      // Log response
      logResponse(logCtx, response.status, duration);

      return response;
    } catch (error) {
      // Calculate duration
      const duration = performance.now() - startTime;

      // Log error
      if (options?.logErrors !== false) {
        logError(logCtx, error as Error, {
          duration_ms: duration,
        });
      }

      // Re-throw the error
      throw error;
    }
  };
}

/**
 * Add request ID to response headers
 */
export function addRequestId(response: HandlerResponse, requestId: string): HandlerResponse {
  const newHeaders = new Headers(response.headers);
  newHeaders.set("X-Request-ID", requestId);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

/**
 * Enable debug logging based on environment
 */
export function isDebugEnabled(): boolean {
  const env = Deno.env.get("DENO_ENV") || "";
  return env.includes("dev") || env.includes("debug");
}

/**
 * Conditional debug logging
 */
export function debugLog(condition: boolean, fn: () => void): void {
  if (condition) {
    fn();
  }
}

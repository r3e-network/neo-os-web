import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Generate a unique request ID for tracing
 */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `req_${timestamp}_${random}`;
}

/**
 * Get or generate request ID from headers
 */
export function getRequestId(req: NextApiRequest): string {
  const existing = req.headers["x-request-id"];
  if (existing) {
    return Array.isArray(existing) ? existing[0] : existing;
  }
  return generateRequestId();
}

/**
 * Set request ID header on response
 */
export function setRequestIdHeader(res: NextApiResponse, requestId: string): void {
  res.setHeader("X-Request-Id", requestId);
}

/**
 * Standardized API error response format
 * Matches edge functions format: { error: { code, message } }
 */
export interface APIErrorBody {
  error: {
    code: string;
    message: string;
  };
}

/**
 * Standard error codes for consistent API responses
 */
export const ErrorCodes = {
  METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",
  BAD_REQUEST: "BAD_REQUEST",
  NOT_FOUND: "NOT_FOUND",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  CONFIG_ERROR: "CONFIG_ERROR",
  GATEWAY_ERROR: "GATEWAY_ERROR",
  GATEWAY_TIMEOUT: "GATEWAY_TIMEOUT",
  RATE_LIMITED: "RATE_LIMITED",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Send standardized error response
 */
export function sendError(
  res: NextApiResponse,
  status: number,
  message: string,
  code: ErrorCode = ErrorCodes.INTERNAL_ERROR,
): void {
  res.status(status).json({ error: { code, message } } as APIErrorBody);
}

/**
 * Common error response helpers
 */
export const apiError = {
  methodNotAllowed: (res: NextApiResponse) => sendError(res, 405, "method not allowed", ErrorCodes.METHOD_NOT_ALLOWED),

  badRequest: (res: NextApiResponse, message = "bad request") => sendError(res, 400, message, ErrorCodes.BAD_REQUEST),

  notFound: (res: NextApiResponse, message = "not found") => sendError(res, 404, message, ErrorCodes.NOT_FOUND),

  unauthorized: (res: NextApiResponse, message = "unauthorized") =>
    sendError(res, 401, message, ErrorCodes.UNAUTHORIZED),

  forbidden: (res: NextApiResponse, message = "forbidden") => sendError(res, 403, message, ErrorCodes.FORBIDDEN),

  configError: (res: NextApiResponse, message = "server configuration error") =>
    sendError(res, 500, message, ErrorCodes.CONFIG_ERROR),

  gatewayError: (res: NextApiResponse, message = "upstream service error") =>
    sendError(res, 502, message, ErrorCodes.GATEWAY_ERROR),

  gatewayTimeout: (res: NextApiResponse, message = "upstream service timeout") =>
    sendError(res, 504, message, ErrorCodes.GATEWAY_TIMEOUT),

  rateLimited: (res: NextApiResponse, message = "rate limit exceeded") =>
    sendError(res, 429, message, ErrorCodes.RATE_LIMITED),

  internal: (res: NextApiResponse, message = "internal server error") =>
    sendError(res, 500, message, ErrorCodes.INTERNAL_ERROR),
};

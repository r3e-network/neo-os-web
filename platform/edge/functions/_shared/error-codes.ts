/**
 * Unified Error Codes for Edge Functions
 *
 * Error Code Format: CATEGORY_SPECIFIC_CODE
 * - CATEGORY: 3-letter code prefix (e.g., AUTH, VAL, RPC)
 * - SPECIFIC: 3-digit code (e.g., 001, 002)
 *
 * Example: AUTH_001 = "Unauthorized access"
 */

import { withCors } from "./cors.ts";

// ============================================================================
// Error Code Categories
// ============================================================================

export enum ErrorCodeCategory {
  // Authentication & Authorization (AUTH_xxx)
  AUTH = "AUTH",

  // Input Validation (VAL_xxx)
  VALIDATION = "VAL",

  // Rate Limiting (RATE_xxx)
  RATE_LIMIT = "RATE",

  // Blockchain RPC (RPC_xxx)
  RPC = "RPC",

  // Smart Contract (CONTRACT_xxx)
  CONTRACT = "CONTRACT",

  // Database/Storage (DB_xxx)
  DATABASE = "DB",

  // External Services (EXT_xxx)
  EXTERNAL = "EXT",

  // Internal Server (SERVER_xxx)
  SERVER = "SERVER",

  // Not Found (NOTFOUND_xxx)
  NOT_FOUND = "NOTFOUND",
}

// ============================================================================
// Error Code Definitions
// ============================================================================

export const ERROR_CODES = {
  // === AUTH ===
  AUTH_001: { code: "AUTH_001", httpStatus: 401, message: "Unauthorized access" },
  AUTH_002: { code: "AUTH_002", httpStatus: 403, message: "Invalid token" },
  AUTH_003: { code: "AUTH_003", httpStatus: 403, message: "Token expired" },
  AUTH_004: { code: "AUTH_004", httpStatus: 403, message: "Insufficient permissions" },
  AUTH_005: { code: "AUTH_005", httpStatus: 403, message: "Missing required scope" },
  AUTH_006: { code: "AUTH_006", httpStatus: 401, message: "Wallet not bound" },
  AUTH_007: { code: "AUTH_007", httpStatus: 403, message: "Not a primary wallet" },

  // === VALIDATION ===
  VAL_001: { code: "VAL_001", httpStatus: 400, message: "Invalid request body" },
  VAL_002: { code: "VAL_002", httpStatus: 400, message: "Invalid JSON format" },
  VAL_003: { code: "VAL_003", httpStatus: 400, message: "Missing required field" },
  VAL_004: { code: "VAL_004", httpStatus: 400, message: "Invalid address format" },
  VAL_005: { code: "VAL_005", httpStatus: 400, message: "Invalid amount format" },
  VAL_006: { code: "VAL_006", httpStatus: 400, message: "Invalid chain ID" },
  VAL_007: { code: "VAL_007", httpStatus: 400, message: "Amount must be greater than zero" },
  VAL_008: { code: "VAL_008", httpStatus: 400, message: "Amount exceeds maximum limit" },
  VAL_009: { code: "VAL_009", httpStatus: 400, message: "Invalid app_id format" },
  VAL_010: { code: "VAL_010", httpStatus: 400, message: "Invalid hash format" },
  VAL_011: { code: "VAL_011", httpStatus: 400, message: "Invalid parameter type" },

  // === RATE LIMIT ===
  RATE_001: { code: "RATE_001", httpStatus: 429, message: "Rate limit exceeded" },
  RATE_002: { code: "RATE_002", httpStatus: 429, message: "Daily limit exceeded" },
  RATE_003: { code: "RATE_003", httpStatus: 429, message: "Monthly limit exceeded" },

  // === RPC ===
  RPC_001: { code: "RPC_001", httpStatus: 500, message: "RPC connection failed" },
  RPC_002: { code: "RPC_002", httpStatus: 500, message: "RPC timeout" },
  RPC_003: { code: "RPC_003", httpStatus: 500, message: "Invalid RPC response" },
  RPC_004: { code: "RPC_004", httpStatus: 500, message: "RPC endpoint not configured" },

  // === CONTRACT ===
  CONTRACT_001: { code: "CONTRACT_001", httpStatus: 500, message: "Contract execution failed" },
  CONTRACT_002: { code: "CONTRACT_002", httpStatus: 404, message: "Contract not found" },
  CONTRACT_003: { code: "CONTRACT_003", httpStatus: 400, message: "Invalid contract method" },
  CONTRACT_004: { code: "CONTRACT_004", httpStatus: 500, message: "Contract reverted" },
  CONTRACT_005: { code: "CONTRACT_005", httpStatus: 403, message: "Contract paused" },
  CONTRACT_006: { code: "CONTRACT_006", httpStatus: 403, message: "Contract globally paused" },
  CONTRACT_007: { code: "CONTRACT_007", httpStatus: 400, message: "Receipt already used" },
  CONTRACT_008: { code: "CONTRACT_008", httpStatus: 400, message: "Invalid receipt" },
  CONTRACT_009: { code: "CONTRACT_009", httpStatus: 400, message: "Insufficient payment" },
  CONTRACT_010: { code: "CONTRACT_010", httpStatus: 400, message: "Payment app mismatch" },

  // === DATABASE ===
  DB_001: { code: "DB_001", httpStatus: 500, message: "Database connection failed" },
  DB_002: { code: "DB_002", httpStatus: 500, message: "Database query failed" },
  DB_003: { code: "DB_003", httpStatus: 404, message: "Record not found" },
  DB_004: { code: "DB_004", httpStatus: 409, message: "Duplicate record" },
  DB_005: { code: "DB_005", httpStatus: 500, message: "Database transaction failed" },

  // === EXTERNAL ===
  EXT_001: { code: "EXT_001", httpStatus: 502, message: "External service unavailable" },
  EXT_002: { code: "EXT_002", httpStatus: 504, message: "External service timeout" },
  EXT_003: { code: "EXT_003", httpStatus: 500, message: "External service error" },

  // === SERVER ===
  SERVER_001: { code: "SERVER_001", httpStatus: 500, message: "Internal server error" },
  SERVER_002: { code: "SERVER_002", httpStatus: 503, message: "Service unavailable" },
  SERVER_003: { code: "SERVER_003", httpStatus: 500, message: "Configuration error" },

  // === NOT FOUND ===
  NOTFOUND_001: { code: "NOTFOUND_001", httpStatus: 404, message: "Resource not found" },
  NOTFOUND_002: { code: "NOTFOUND_002", httpStatus: 404, message: "App not found" },
  NOTFOUND_003: { code: "NOTFOUND_003", httpStatus: 404, message: "Chain not found" },
  NOTFOUND_004: { code: "NOTFOUND_004", httpStatus: 404, message: "User not found" },
  NOTFOUND_005: { code: "NOTFOUND_005", httpStatus: 404, message: "Wallet not found" },

  // === LEGACY (for backward compatibility) ===
  METHOD_NOT_ALLOWED: { code: "VAL_405", httpStatus: 405, message: "Method not allowed" },
  BAD_JSON: { code: "VAL_400", httpStatus: 400, message: "Invalid JSON body" },
  RPC_ERROR: { code: "RPC_500", httpStatus: 500, message: "RPC request failed" },
} as const;

// ============================================================================
// Type Definitions
// ============================================================================

export type ErrorCodeKey = keyof typeof ERROR_CODES;

export interface ErrorInfo {
  code: string;
  httpStatus: number;
  message: string;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// ============================================================================
// Error Helper Functions
// ============================================================================

/**
 * Create a standardized error response
 */
export function errorResponse(codeKey: ErrorCodeKey, details?: unknown, req?: Request): Response {
  const errorInfo = ERROR_CODES[codeKey];
  const body: ErrorResponse = {
    error: {
      code: errorInfo.code,
      message: errorInfo.message,
      ...(details !== undefined && { details }),
    },
  };

  return json(body, { status: errorInfo.httpStatus }, req);
}

/**
 * Create a validation error response (400)
 */
export function validationError(field: string, message: string, req?: Request): Response {
  return errorResponse("VAL_003", { field, message }, req);
}

/**
 * Create an unauthorized error response (401)
 */
export function unauthorizedError(message = ERROR_CODES.AUTH_001.message, req?: Request): Response {
  return errorResponse("AUTH_001", message, req);
}

/**
 * Create a forbidden error response (403)
 */
export function forbiddenError(message = ERROR_CODES.AUTH_004.message, req?: Request): Response {
  return errorResponse("AUTH_004", message, req);
}

/**
 * Create a not found error response (404)
 */
export function notFoundError(resource: string, req?: Request): Response {
  return errorResponse("NOTFOUND_001", { resource }, req);
}

/**
 * Create a rate limit error response (429)
 */
export function rateLimitError(limitType: "daily" | "monthly" | "request", req?: Request): Response {
  const codeKey = limitType === "daily" ? "RATE_002" : limitType === "monthly" ? "RATE_003" : "RATE_001";
  return errorResponse(codeKey, { limitType }, req);
}

/**
 * Create an RPC error response (500)
 */
export function rpcError(message: string, req?: Request): Response {
  return errorResponse("RPC_001", { rpcMessage: message }, req);
}

/**
 * Create a contract error response
 */
export function contractError(message: string, req?: Request): Response {
  return errorResponse("CONTRACT_001", { contractMessage: message }, req);
}

// ============================================================================
// Legacy Compatibility
// ============================================================================

/**
 * Legacy error function for backward compatibility
 * @deprecated Use errorResponse() with specific error code instead
 */
export function error(status: number, message: string, _code = "ERROR", req?: Request): Response {
  // Map legacy status codes to new error codes
  let codeKey: ErrorCodeKey = "SERVER_001";

  if (status === 400) codeKey = "VAL_001";
  else if (status === 401) codeKey = "AUTH_001";
  else if (status === 403) codeKey = "AUTH_004";
  else if (status === 404) codeKey = "NOTFOUND_001";
  else if (status === 405) codeKey = "METHOD_NOT_ALLOWED";
  else if (status === 429) codeKey = "RATE_001";
  else if (status === 500) codeKey = "SERVER_001";

  return errorResponse(codeKey, { message }, req);
}

// Internal JSON helper
function json(data: unknown, init: ResponseInit = {}, req?: Request): Response {
  const headers = withCors(init.headers || {}, req);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

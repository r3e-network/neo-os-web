import type { NextApiRequest, NextApiResponse } from "next";
import { apiError, generateRequestId, setRequestIdHeader } from "./api-response";
import { standardLimit } from "./rate-limit";
import { validateCsrfToken } from "./csrf";
import {
  logApiRequest,
  logSecurityViolation,
  logRateLimitHit,
  AuditSeverity,
} from "./security/audit-log";
import { validateQueryParams, FieldSchema } from "./security/input-validation";
import type { Permission } from "./security/permissions";

/**
 * API route configuration options
 */
export interface ApiRouteConfig {
  /** HTTP methods allowed (default: GET) */
  allowedMethods?: string[];
  /** Whether to require CSRF protection (default: true for mutating methods) */
  requireCsrf?: boolean;
  /** Whether to apply rate limiting (default: true) */
  rateLimit?: boolean;
  /** Rate limit config override */
  rateLimitConfig?: {
    max?: number;
    windowMs?: number;
  };
  /** Query parameter validation schema */
  querySchema?: Record<string, FieldSchema>;
  /** Whether to require authentication */
  requireAuth?: boolean;
  /** Cache control header value */
  cacheControl?: string;
}

/**
 * Default API route configuration
 */
const DEFAULT_CONFIG: ApiRouteConfig = {
  allowedMethods: ["GET"],
  requireCsrf: true,
  rateLimit: true,
  requireAuth: false,
};

/**
 * Gets cache control header based on method
 */
function getCacheControl(config: ApiRouteConfig, method: string): string | undefined {
  if (config.cacheControl) {
    return config.cacheControl;
  }
  
  // Default cache for safe methods
  if (method === "GET" || method === "HEAD") {
    return "s-maxage=60, stale-while-revalidate=300";
  }
  
  return "no-store, private";
}

/**
 * Validates request method
 */
function validateMethod(
  req: NextApiRequest,
  res: NextApiResponse,
  allowedMethods: string[]
): boolean {
  const method = req.method?.toUpperCase() || "GET";
  
  if (!allowedMethods.includes(method)) {
    apiError.methodNotAllowed(res);
    return false;
  }
  
  return true;
}

/**
 * Validates CSRF token for mutating requests
 */
function validateCsrf(
  req: NextApiRequest,
  res: NextApiResponse,
  requireCsrf: boolean
): boolean {
  if (!requireCsrf) {
    return true;
  }
  
  const method = req.method?.toUpperCase() || "GET";
  const safeMethods = ["GET", "HEAD", "OPTIONS"];
  
  // Skip CSRF for safe methods
  if (safeMethods.includes(method)) {
    return true;
  }
  
  if (!validateCsrfToken(req)) {
    logSecurityViolation(req, {
      violationType: "CSRF_VALIDATION_FAILED",
      details: {
        method,
        url: req.url,
      },
    });
    apiError.forbidden(res, "Invalid CSRF token");
    return false;
  }
  
  return true;
}

/**
 * Creates a standardized API route handler with common middleware
 */
export function createApiHandler<
  T extends (req: NextApiRequest, res: NextApiResponse) => unknown
>(
  handler: T,
  config: ApiRouteConfig = DEFAULT_CONFIG
): (req: NextApiRequest, res: NextApiResponse) => Promise<unknown> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const allowedMethods = finalConfig.allowedMethods ?? DEFAULT_CONFIG.allowedMethods!;
  
  return async function apiHandler(req: NextApiRequest, res: NextApiResponse) {
    // Generate and set request ID
    const requestId = generateRequestId();
    setRequestIdHeader(res, requestId);
    
    // Log API request
    logApiRequest(req, {
      resource: req.url ?? "unknown",
      action: req.method,
      config: {
        minSeverity: "WARNING" as AuditSeverity,
      },
    });
    
    // Validate HTTP method
    if (!validateMethod(req, res, allowedMethods)) {
      return;
    }
    
    // Validate CSRF token
    if (!validateCsrf(req, res, finalConfig.requireCsrf ?? true)) {
      return;
    }
    
    // Apply rate limiting
    if (finalConfig.rateLimit) {
      const rateLimitResult = standardLimit(req, res);
      if (rateLimitResult) {
        logRateLimitHit(req, {
          limit: finalConfig.rateLimitConfig?.max,
          windowMs: finalConfig.rateLimitConfig?.windowMs,
        });
        return;
      }
    }
    
    // Validate query parameters
    if (finalConfig.querySchema) {
      const queryResult = validateQueryParams(req, finalConfig.querySchema);
      if (!queryResult.valid) {
        apiError.badRequest(res, queryResult.errors.join("; "));
        return;
      }
    }
    
    // Set cache control header
    const cacheControl = getCacheControl(finalConfig, req.method ?? "GET");
    if (cacheControl) {
      res.setHeader("Cache-Control", cacheControl);
    }
    
    // Call the actual handler
    try {
      return await handler(req, res);
    } catch (error) {
      const { logger } = await import("@/lib/logger");
      logger.error("API handler error:", error instanceof Error ? error.message : "unknown error");
      
      // Don't expose internal error details to client
      apiError.internal(res);
    }
  };
}

/**
 * Wrapper for async API handlers with error handling
 */
export function withErrorHandling<
  T extends (req: NextApiRequest, res: NextApiResponse) => unknown
>(handler: T): (req: NextApiRequest, res: NextApiResponse) => Promise<unknown> {
  return async function errorHandledHandler(req: NextApiRequest, res: NextApiResponse) {
    try {
      return await handler(req, res);
    } catch (error) {
      const { logger } = await import("@/lib/logger");
      logger.error("API handler error:", error instanceof Error ? error.message : "unknown error");
      apiError.internal(res);
    }
  };
}

/**
 * Wrapper for authentication requirement
 */
export function withAuth<
  T extends (req: NextApiRequest, res: NextApiResponse) => unknown
>(
  handler: T,
  options?: {
    /** Custom auth function (default: requireWalletAuth) */
    authFn?: (req: NextApiRequest, res: NextApiResponse) => Promise<string | null>;
    /** Optional: require specific role or permission */
    permission?: string;
  }
): (req: NextApiRequest, res: NextApiResponse) => Promise<unknown> {
  return async function authenticatedHandler(req: NextApiRequest, res: NextApiResponse) {
    const { requireWalletAuth } = await import("@/lib/require-wallet-auth");
    
    const authFn = options?.authFn ?? requireWalletAuth;
    const wallet = await authFn(req, res);
    
    if (!wallet) {
      return;
    }
    
    // If permission check is provided, verify it
    if (options?.permission) {
      const { getPermissionsForWallet } = await import("@/lib/security/permissions");
      const permissions = getPermissionsForWallet(wallet);
      
      if (!permissions.includes(options.permission as Permission)) {
        apiError.forbidden(res, "Insufficient permissions");
        return;
      }
    }
    
    return handler(req, res);
  };
}

/**
 * Wrapper for admin-only routes
 */
export function withAdminOnly<
  T extends (req: NextApiRequest, res: NextApiResponse) => unknown
>(handler: T): (req: NextApiRequest, res: NextApiResponse) => Promise<unknown> {
  return async function adminOnlyHandler(req: NextApiRequest, res: NextApiResponse) {
    const { requireMiniAppAdmin } = await import("@/lib/admin-auth");
    
    const admin = await requireMiniAppAdmin(req, res);
    
    if (!admin) {
      return;
    }
    
    return handler(req, res);
  };
}

/**
 * Creates a GET-only public endpoint
 */
export function publicGetEndpoint<
  T extends (req: NextApiRequest, res: NextApiResponse) => unknown
>(
  handler: T,
  options?: {
    /** Custom rate limit config */
    rateLimit?: { max: number; windowMs: number };
    /** Cache duration in seconds */
    cacheSeconds?: number;
    /** Query parameter schema */
    querySchema?: Record<string, FieldSchema>;
  }
): (req: NextApiRequest, res: NextApiResponse) => Promise<unknown> {
  return createApiHandler(handler, {
    allowedMethods: ["GET", "HEAD"],
    requireCsrf: false,
    rateLimit: true,
    querySchema: options?.querySchema,
    cacheControl: options?.cacheSeconds
      ? `public, max-age=${options.cacheSeconds}, s-maxage=${options.cacheSeconds}, stale-while-revalidate=${options.cacheSeconds * 2}`
      : undefined,
  });
}

/**
 * Creates a protected mutation endpoint (POST/PUT/DELETE)
 */
export function protectedEndpoint<
  T extends (req: NextApiRequest, res: NextApiResponse) => unknown
>(
  handler: T,
  options?: {
    /** Allowed methods (default: POST) */
    allowedMethods?: string[];
    /** Require admin role */
    adminOnly?: boolean;
    /** Query parameter schema */
    querySchema?: Record<string, FieldSchema>;
  }
): (req: NextApiRequest, res: NextApiResponse) => Promise<unknown> {
  const methods = options?.allowedMethods ?? ["POST"];
  
  if (options?.adminOnly) {
    return createApiHandler(withAdminOnly(handler), {
      allowedMethods: methods,
      requireCsrf: true,
      rateLimit: true,
      querySchema: options.querySchema,
    });
  }
  
  return createApiHandler(withAuth(handler), {
    allowedMethods: methods,
    requireCsrf: true,
    rateLimit: true,
    querySchema: options?.querySchema,
  });
}

/**
 * Health check endpoint helper
 */
export function createHealthCheck(
  options?: {
    /** Additional checks to run */
    checks?: () => Promise<Record<string, unknown>>;
    /** Cache duration in seconds */
    cacheSeconds?: number;
  }
) {
  return async function healthCheck(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "GET" && req.method !== "HEAD") {
      apiError.methodNotAllowed(res);
      return;
    }
    
    const health: Record<string, unknown> = {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
    
    // Run additional checks if provided
    if (options?.checks) {
      try {
        const checkResults = await options.checks();
        health.checks = checkResults;
        
        // If any check fails, mark status as degraded
        if (Object.values(checkResults).some((v) => v === false || v === "error")) {
          health.status = "degraded";
        }
      } catch (error) {
        health.status = "degraded";
        health.error = error instanceof Error ? error.message : "Check failed";
      }
    }
    
    const cacheSeconds = options?.cacheSeconds ?? 10;
    res.setHeader("Cache-Control", `public, max-age=${cacheSeconds}`);
    res.status(200).json(health);
  };
}

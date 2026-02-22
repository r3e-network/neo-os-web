import type { NextApiRequest, NextApiResponse } from "next";
import { logger } from "@/lib/logger";
import crypto from "crypto";

/**
 * Audit log event types
 */
export type AuditEventType =
  | "API_REQUEST"
  | "AUTH_SUCCESS"
  | "AUTH_FAILURE"
  | "AUTHORIZATION_SUCCESS"
  | "AUTHORIZATION_FAILURE"
  | "DATA_ACCESS"
  | "DATA_MODIFICATION"
  | "ADMIN_ACTION"
  | "RATE_LIMIT_HIT"
  | "VALIDATION_FAILURE"
  | "SECURITY_VIOLATION";

/**
 * Audit severity levels
 */
export type AuditSeverity = "INFO" | "WARNING" | "ERROR" | "CRITICAL";

/**
 * Audit log entry structure
 */
export interface AuditLogEntry {
  id: string;
  timestamp: string;
  eventType: AuditEventType;
  severity: AuditSeverity;
  actor?: string;
  actorType?: "wallet" | "api_key" | "user" | "anonymous";
  resource?: string;
  action?: string;
  success: boolean;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  errorMessage?: string;
}

/**
 * Configuration for audit logging
 */
interface AuditConfig {
  includeRequestBody?: boolean;
  sensitiveFields?: string[];
  minSeverity?: AuditSeverity;
}

/**
 * Default sensitive fields that should be masked in logs
 */
const DEFAULT_SENSITIVE_FIELDS = [
  "password",
  "token",
  "secret",
  "api_key",
  "authorization",
  "credit_card",
  "cvv",
  "ssn",
];

/**
 * Masks sensitive fields in an object
 */
function maskSensitiveData(obj: unknown, sensitiveFields: string[]): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === "string") {
    // Check if the string looks like a sensitive value
    const lowerValue = obj.toLowerCase();
    if (sensitiveFields.some((field) => lowerValue.includes(field.toLowerCase()))) {
      return "***REDACTED***";
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => maskSensitiveData(item, sensitiveFields));
  }

  if (typeof obj === "object") {
    const masked: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (sensitiveFields.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
        masked[key] = "***REDACTED***";
      } else {
        masked[key] = maskSensitiveData(value, sensitiveFields);
      }
    }
    return masked;
  }

  return obj;
}

/**
 * Extracts client IP from request
 */
function extractClientIp(req: NextApiRequest): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0];
    return first.trim();
  }
  const realIp = req.headers["x-real-ip"];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }
  return req.socket.remoteAddress ?? "unknown";
}

/**
 * Extracts user agent from request
 */
function extractUserAgent(req: NextApiRequest): string {
  const userAgent = req.headers["user-agent"];
  return Array.isArray(userAgent) ? userAgent[0] ?? "unknown" : userAgent ?? "unknown";
}

/**
 * Extracts actor identifier from request
 */
function extractActor(req: NextApiRequest): { actor?: string; actorType?: "wallet" | "api_key" | "user" | "anonymous" } {
  // Check for wallet auth
  const authHeader = req.headers.authorization;
  if (authHeader) {
    // For wallet auth, we'd need to decode the token
    // This is a simplified version
    return { actor: "authenticated_user", actorType: "user" };
  }

  // Check for admin API key
  const adminKey = req.headers["x-admin-key"];
  if (adminKey) {
    return { actor: "admin_api", actorType: "api_key" };
  }

  return { actorType: "anonymous" };
}

/**
 * Creates an audit log entry from a request
 */
export function createAuditEntry(
  req: NextApiRequest,
  eventType: AuditEventType,
  severity: AuditSeverity,
  success: boolean,
  options?: {
    actor?: string;
    actorType?: "wallet" | "api_key" | "user" | "anonymous";
    resource?: string;
    action?: string;
    details?: Record<string, unknown>;
    errorMessage?: string;
    config?: AuditConfig;
  }
): AuditLogEntry {
  const config = options?.config ?? {};
  const sensitiveFields = config.sensitiveFields ?? DEFAULT_SENSITIVE_FIELDS;

  // Generate unique ID
  const timestamp = new Date().toISOString();
  const random = crypto.randomBytes(4).toString("hex");
  const id = `audit_${timestamp.replace(/[-:]/g, "")}_${random}`;

  // Get request ID if available
  const requestId = (req.headers["x-request-id"] as string) ?? undefined;

  // Build details
  let details = options?.details ?? {};
  
  // Optionally include request body (masked)
  if (config.includeRequestBody && req.body) {
    details = {
      ...details,
      method: req.method,
      url: req.url,
      queryParams: maskSensitiveData(req.query, sensitiveFields),
      body: maskSensitiveData(req.body, sensitiveFields),
    };
  }

  const actor = options?.actor ?? extractActor(req).actor;
  const actorType = options?.actorType ?? extractActor(req).actorType;

  return {
    id,
    timestamp,
    eventType,
    severity,
    actor,
    actorType,
    resource: options?.resource,
    action: options?.action,
    success,
    details: Object.keys(details).length > 0 ? details : undefined,
    ipAddress: extractClientIp(req),
    userAgent: extractUserAgent(req),
    requestId,
    errorMessage: options?.errorMessage,
  };
}

/**
 * Severity level ordering for filtering
 */
const severityOrder: Record<AuditSeverity, number> = {
  INFO: 0,
  WARNING: 1,
  ERROR: 2,
  CRITICAL: 3,
};

/**
 * Determines if an event should be logged based on minimum severity
 */
function shouldLog(severity: AuditSeverity, minSeverity?: AuditSeverity): boolean {
  if (!minSeverity) return true;
  return severityOrder[severity] >= severityOrder[minSeverity];
}

/**
 * Formats audit entry for logging
 */
function formatAuditEntry(entry: AuditLogEntry): string {
  const parts = [
    `[AUDIT:${entry.severity}]`,
    `event=${entry.eventType}`,
    `actor=${entry.actor ?? "anonymous"}`,
    `actorType=${entry.actorType ?? "unknown"}`,
    `success=${entry.success}`,
  ];

  if (entry.resource) parts.push(`resource=${entry.resource}`);
  if (entry.action) parts.push(`action=${entry.action}`);
  if (entry.ipAddress) parts.push(`ip=${entry.ipAddress}`);
  if (entry.errorMessage) parts.push(`error=${entry.errorMessage}`);
  if (entry.requestId) parts.push(`requestId=${entry.requestId}`);

  return parts.join(" | ");
}

/**
 * Writes an audit log entry
 */
export function writeAuditLog(entry: AuditLogEntry, config?: AuditConfig): void {
  if (!shouldLog(entry.severity, config?.minSeverity)) {
    return;
  }

  const message = formatAuditEntry(entry);

  switch (entry.severity) {
    case "CRITICAL":
    case "ERROR":
      logger.error(message, entry.details ?? {});
      break;
    case "WARNING":
      logger.warn(message, entry.details ?? {});
      break;
    default:
      logger.info(message, entry.details ?? {});
  }
}

/**
 * Convenience function to log API request events
 */
export function logApiRequest(
  req: NextApiRequest,
  options?: {
    resource?: string;
    action?: string;
    details?: Record<string, unknown>;
    config?: AuditConfig;
  }
): AuditLogEntry {
  const entry = createAuditEntry(req, "API_REQUEST", "INFO", true, {
    resource: options?.resource,
    action: options?.action,
    details: options?.details,
    config: options?.config,
  });

  writeAuditLog(entry, options?.config);
  return entry;
}

/**
 * Convenience function to log authentication events
 */
export function logAuthEvent(
  req: NextApiRequest,
  success: boolean,
  options?: {
    actor?: string;
    errorMessage?: string;
    details?: Record<string, unknown>;
    config?: AuditConfig;
  }
): AuditLogEntry {
  const eventType = success ? "AUTH_SUCCESS" : "AUTH_FAILURE";
  const severity = success ? "INFO" : "WARNING";

  const entry = createAuditEntry(req, eventType, severity, success, {
    actor: options?.actor,
    actorType: "wallet",
    errorMessage: options?.errorMessage,
    details: options?.details,
    config: options?.config,
  });

  writeAuditLog(entry, options?.config);
  return entry;
}

/**
 * Convenience function to log authorization events
 */
export function logAuthorizationEvent(
  req: NextApiRequest,
  success: boolean,
  options?: {
    actor?: string;
    resource?: string;
    action?: string;
    errorMessage?: string;
    details?: Record<string, unknown>;
    config?: AuditConfig;
  }
): AuditLogEntry {
  const eventType = success ? "AUTHORIZATION_SUCCESS" : "AUTHORIZATION_FAILURE";
  const severity = success ? "INFO" : "WARNING";

  const entry = createAuditEntry(req, eventType, severity, success, {
    actor: options?.actor,
    actorType: "wallet",
    resource: options?.resource,
    action: options?.action,
    errorMessage: options?.errorMessage,
    details: options?.details,
    config: options?.config,
  });

  writeAuditLog(entry, options?.config);
  return entry;
}

/**
 * Convenience function to log admin actions
 */
export function logAdminAction(
  req: NextApiRequest,
  success: boolean,
  options?: {
    actor?: string;
    action?: string;
    resource?: string;
    errorMessage?: string;
    details?: Record<string, unknown>;
    config?: AuditConfig;
  }
): AuditLogEntry {
  const severity = success ? "INFO" : "ERROR";

  const entry = createAuditEntry(req, "ADMIN_ACTION", severity, success, {
    actor: options?.actor,
    actorType: "api_key",
    action: options?.action,
    resource: options?.resource,
    errorMessage: options?.errorMessage,
    details: options?.details,
    config: options?.config,
  });

  writeAuditLog(entry, options?.config);
  return entry;
}

/**
 * Convenience function to log security violations
 */
export function logSecurityViolation(
  req: NextApiRequest,
  options: {
    violationType: string;
    details?: Record<string, unknown>;
    config?: AuditConfig;
  }
): AuditLogEntry {
  const entry = createAuditEntry(req, "SECURITY_VIOLATION", "CRITICAL", false, {
    errorMessage: options.violationType,
    details: options.details,
    config: options.config,
  });

  writeAuditLog(entry, options.config);
  return entry;
}

/**
 * Convenience function to log validation failures
 */
export function logValidationFailure(
  req: NextApiRequest,
  validationErrors: string[],
  options?: {
    actor?: string;
    resource?: string;
    details?: Record<string, unknown>;
    config?: AuditConfig;
  }
): AuditLogEntry {
  const entry = createAuditEntry(req, "VALIDATION_FAILURE", "WARNING", false, {
    actor: options?.actor,
    actorType: "user",
    resource: options?.resource,
    errorMessage: validationErrors.join("; "),
    details: {
      ...options?.details,
      validationErrors,
    },
    config: options?.config,
  });

  writeAuditLog(entry, options?.config);
  return entry;
}

/**
 * Convenience function to log rate limit hits
 */
export function logRateLimitHit(
  req: NextApiRequest,
  options?: {
    actor?: string;
    limit?: number;
    windowMs?: number;
    config?: AuditConfig;
  }
): AuditLogEntry {
  const entry = createAuditEntry(req, "RATE_LIMIT_HIT", "WARNING", false, {
    actor: options?.actor,
    actorType: "user",
    errorMessage: "Rate limit exceeded",
    details: {
      limit: options?.limit,
      windowMs: options?.windowMs,
    },
    config: options?.config,
  });

  writeAuditLog(entry, options?.config);
  return entry;
}

/**
 * Data modification audit helper
 */
export function logDataModification(
  req: NextApiRequest,
  success: boolean,
  options?: {
    actor?: string;
    resource?: string;
    action?: "create" | "update" | "delete";
    errorMessage?: string;
    details?: Record<string, unknown>;
    config?: AuditConfig;
  }
): AuditLogEntry {
  const entry = createAuditEntry(req, "DATA_MODIFICATION", success ? "INFO" : "ERROR", success, {
    actor: options?.actor,
    actorType: "user",
    resource: options?.resource,
    action: options?.action,
    errorMessage: options?.errorMessage,
    details: options?.details,
    config: options?.config,
  });

  writeAuditLog(entry, options?.config);
  return entry;
}

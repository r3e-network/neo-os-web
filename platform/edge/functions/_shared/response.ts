import { withCors } from "./cors.ts";

export function json(data: unknown, init: ResponseInit = {}, req?: Request): Response {
  const headers = withCors(init.headers, req);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

/**
 * Sanitize database error messages to prevent schema information leakage.
 * Removes table names, column names, constraint names, and other sensitive details.
 */
function sanitizeErrorMessage(message: string): string {
  // Remove common database error patterns that leak schema info
  const patterns = [
    // PostgreSQL constraint violations
    /violates? (foreign key|unique|check|not-null) constraint "([^"]+)"/gi,
    // Table/column references
    /\b(table|column|relation|constraint|index|sequence|schema|database)\s+"?([a-z_][a-z0-9_]*)"?/gi,
    // Specific error codes and details
    /\bERROR:\s+/gi,
    /\bDETAIL:\s+/gi,
    /\bHINT:\s+/gi,
    // SQL snippets
    /\bKey\s+\([^)]+\)/gi,
  ];

  let sanitized = message;
  for (const pattern of patterns) {
    sanitized = sanitized.replace(pattern, "[redacted]");
  }

  // If the message was heavily sanitized, return a generic message
  if (sanitized.includes("[redacted]") || sanitized.length < message.length * 0.3) {
    return "database operation failed";
  }

  return sanitized;
}

export function error(status: number, message: string, code = "ERROR", req?: Request): Response {
  // Sanitize database errors (5xx errors are likely internal/database errors)
  const sanitizedMessage = status >= 500 ? sanitizeErrorMessage(message) : message;
  return json({ error: { code, message: sanitizedMessage } }, { status }, req);
}

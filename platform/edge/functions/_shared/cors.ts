/**
 * CORS Configuration for Edge Functions
 *
 * SECURITY: This module implements strict CORS policies.
 * - EDGE_CORS_ORIGINS environment variable MUST be set in production
 * - Localhost bypass is DISABLED for security
 * - Default behavior is DENY (fail closed)
 */

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, x-api-key, content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

/**
 * Parse allowed origins from environment variable.
 * SECURITY: Returns null if not configured, which triggers DENY behavior.
 */
function parseAllowedOrigins(): string[] | null {
  const raw = (Deno.env.get("EDGE_CORS_ORIGINS") ?? "").trim();
  if (!raw) return null;
  const parts = raw
    .split(/[,\s]+/g)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return parts.length > 0 ? Array.from(new Set(parts)) : null;
}

/**
 * Check if running in development mode.
 * SECURITY: Only enabled via explicit environment variable.
 */
function isDevelopmentMode(): boolean {
  const mode = (Deno.env.get("DENO_ENV") ?? "").trim().toLowerCase();
  return mode === "development" || mode === "dev";
}

/**
 * Validate an origin against the allowlist.
 * SECURITY: Case-insensitive comparison, exact match required.
 */
function isOriginAllowed(origin: string, allowed: string[]): boolean {
  const normalizedOrigin = origin.toLowerCase();
  return allowed.includes(normalizedOrigin);
}

/**
 * Add CORS headers to response.
 * SECURITY: Implements fail-closed behavior - no Access-Control-Allow-Origin
 * header is set if origin is not explicitly allowed.
 */
export function withCors(headers: HeadersInit = {}, req?: Request): Headers {
  const out = new Headers(headers);
  for (const [k, v] of Object.entries(corsHeaders)) {
    out.set(k, v);
  }

  const allowed = parseAllowedOrigins();
  const origin = (req?.headers.get("Origin") ?? "").trim();

  // SECURITY: If no origins configured, check if we're in dev mode
  if (!allowed) {
    if (isDevelopmentMode()) {
      // Development mode: warn and allow (with logging)
      console.warn("[CORS] WARNING: EDGE_CORS_ORIGINS not configured, allowing in dev mode");
      if (origin) {
        out.set("Access-Control-Allow-Origin", origin);
        out.set("Access-Control-Allow-Credentials", "true");
        out.set("Vary", "Origin");
      } else {
        out.set("Access-Control-Allow-Origin", "*");
      }
    } else {
      // Production mode: DENY - do not set Access-Control-Allow-Origin
      // This will cause CORS errors in browsers (fail closed)
      console.error("[CORS] ERROR: EDGE_CORS_ORIGINS not configured in production mode");
    }
    return out;
  }

  // Check if origin is in allowlist
  if (origin && isOriginAllowed(origin, allowed)) {
    out.set("Access-Control-Allow-Origin", origin);
    out.set("Access-Control-Allow-Credentials", "true");
    const vary = out.get("Vary");
    if (!vary) {
      out.set("Vary", "Origin");
    } else if (
      !vary
        .split(",")
        .map((v) => v.trim().toLowerCase())
        .includes("origin")
    ) {
      out.set("Vary", `${vary}, Origin`);
    }
  }
  // SECURITY: If origin not in allowlist, do NOT set Access-Control-Allow-Origin
  // This implements fail-closed behavior

  return out;
}

/**
 * Handle CORS preflight requests.
 * SECURITY: Returns 403 if origin is not allowed.
 */
export function handleCorsPreflight(req: Request): Response | null {
  if (req.method !== "OPTIONS") return null;
  const headers = withCors({}, req);
  if (!headers.get("Access-Control-Allow-Origin")) {
    // SECURITY: Explicitly reject unauthorized origins
    return new Response(null, { status: 403, headers });
  }
  return new Response(null, { status: 204, headers });
}

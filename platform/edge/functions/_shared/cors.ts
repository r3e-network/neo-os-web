/**
 * CORS Configuration for Edge Functions
 *
 * SECURITY: Configure EDGE_CORS_ORIGINS in production for strict security.
 * Default behavior allows all origins for easier deployment.
 */

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, x-api-key, content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS,PUT,DELETE,PATCH",
};

/**
 * Parse allowed origins from environment variable.
 * If not set, returns null (which triggers permissive mode).
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
 * Check if running in strict mode (production with configured origins).
 */
function isStrictMode(): boolean {
  return parseAllowedOrigins() !== null;
}

/**
 * Validate an origin against the allowlist.
 */
function isOriginAllowed(origin: string, allowed: string[]): boolean {
  const normalizedOrigin = origin.toLowerCase();
  return allowed.includes(normalizedOrigin);
}

/**
 * Add CORS headers to response.
 * 
 * BEHAVIOR:
 * - If EDGE_CORS_ORIGINS is set: strict mode, only allowlisted origins
 * - If EDGE_CORS_ORIGINS is not set: permissive mode, allow all origins
 */
export function withCors(headers: HeadersInit = {}, req?: Request): Headers {
  const out = new Headers(headers);
  for (const [k, v] of Object.entries(corsHeaders)) {
    out.set(k, v);
  }

  const allowed = parseAllowedOrigins();
  const origin = (req?.headers.get("Origin") ?? "").trim();

  if (allowed) {
    // STRICT MODE: Only allow configured origins
    if (origin && isOriginAllowed(origin, allowed)) {
      out.set("Access-Control-Allow-Origin", origin);
      out.set("Access-Control-Allow-Credentials", "true");
      out.set("Vary", "Origin");
    } else if (origin) {
      // Origin not in allowlist - don't set CORS headers (will fail in browser)
      console.warn("[CORS] Origin not allowed:", origin);
    }
  } else {
    // PERMISSIVE MODE: Allow all origins (default for easy deployment)
    // This is less secure but works out of the box
    if (origin) {
      out.set("Access-Control-Allow-Origin", origin);
      out.set("Access-Control-Allow-Credentials", "true");
      out.set("Vary", "Origin");
    } else {
      out.set("Access-Control-Allow-Origin", "*");
    }
  }

  return out;
}

/**
 * Handle CORS preflight requests.
 */
export function handleCorsPreflight(req: Request): Response | null {
  if (req.method !== "OPTIONS") return null;
  const headers = withCors({}, req);
  
  // Always return 204 for preflight, even without Access-Control-Allow-Origin
  // The browser will handle the actual CORS check on the real request
  return new Response(null, { status: 204, headers });
}

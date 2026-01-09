export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, x-api-key, content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

function parseAllowedOrigins(): string[] | null {
  const raw = (Deno.env.get("EDGE_CORS_ORIGINS") ?? "").trim();
  if (!raw) return null;
  const parts = raw
    .split(/[,\s]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? Array.from(new Set(parts)) : null;
}

export function withCors(headers: HeadersInit = {}, req?: Request): Headers {
  const out = new Headers(headers);
  for (const [k, v] of Object.entries(corsHeaders)) {
    out.set(k, v);
  }
  const allowed = parseAllowedOrigins();
  if (!allowed) {
    // No CORS origins configured - allow all
    out.set("Access-Control-Allow-Origin", "*");
  } else {
    const origin = (req?.headers.get("Origin") ?? "").trim();
    if (origin && allowed.includes(origin)) {
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
    } else if (origin) {
      // Origin not in allowed list - still set header for proper CORS error
      // In development, allow localhost origins
      const isDev = origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:");
      if (isDev) {
        out.set("Access-Control-Allow-Origin", origin);
        out.set("Access-Control-Allow-Credentials", "true");
        out.set("Vary", "Origin");
      }
    }
  }
  return out;
}

export function handleCorsPreflight(req: Request): Response | null {
  if (req.method !== "OPTIONS") return null;
  const headers = withCors({}, req);
  if (!headers.get("Access-Control-Allow-Origin")) {
    return new Response(null, { status: 403, headers });
  }
  return new Response(null, { status: 204, headers });
}

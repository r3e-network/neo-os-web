import crypto from "crypto";

/**
 * Server-only admin API key used to authenticate with the upstream host-app.
 * MUST NOT be prefixed with NEXT_PUBLIC_ — it is read exclusively in server-side
 * API routes and never sent to browsers.
 */
const HOST_ADMIN_KEY = String(process.env.ADMIN_CONSOLE_API_KEY || process.env.ADMIN_API_KEY || "").trim();

export function resolveHostAppBaseURL(): string {
  const value = process.env.MINIAPP_HOST_APP_BASE_URL || process.env.HOST_APP_BASE_URL || "";
  return String(value).trim();
}

/**
 * Build headers for proxying admin requests to the upstream host-app.
 *
 * The admin key is injected from the server-only environment variable, NOT
 * forwarded from the incoming browser request. This ensures the secret never
 * transits through the browser.
 */
export function createProxyHeaders(_req: Request): Record<string, string> {
  const csrfToken = crypto.randomBytes(16).toString("hex");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-CSRF-Token": csrfToken,
    Cookie: `csrf-token=${csrfToken}`,
  };

  if (HOST_ADMIN_KEY) {
    headers["X-Admin-Key"] = HOST_ADMIN_KEY;
  }

  return headers;
}

export async function parseHostErrorPayload(response: Response, fallback: string): Promise<string> {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await response.text().catch((e: unknown) => { console.warn("[host-admin-proxy] failed to read response text:", e instanceof Error ? e.message : String(e)); return ""; });
    return text || fallback;
  }

  const payload = await response.json().catch((e: unknown) => { console.warn("[host-admin-proxy] failed to parse error JSON:", e instanceof Error ? e.message : String(e)); return null; }) as {
    error?: { message?: string } | string;
    message?: string;
  } | null;

  if (typeof payload?.error === "string") return payload.error;
  if (payload?.error && typeof payload.error === "object" && payload.error.message) return payload.error.message;
  if (typeof payload?.message === "string" && payload.message) return payload.message;
  return fallback;
}

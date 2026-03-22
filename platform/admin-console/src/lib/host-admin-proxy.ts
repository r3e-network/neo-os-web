import crypto from "crypto";

export function resolveHostAppBaseURL(): string {
  const value = process.env.MINIAPP_HOST_APP_BASE_URL || process.env.HOST_APP_BASE_URL || "";
  return String(value).trim();
}

export function createProxyHeaders(req: Request): Record<string, string> {
  const csrfToken = crypto.randomBytes(16).toString("hex");
  const adminKey = req.headers.get("x-admin-key") || "";
  const authHeader = req.headers.get("authorization") || "";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-CSRF-Token": csrfToken,
    Cookie: `csrf-token=${csrfToken}`,
  };

  if (adminKey) {
    headers["X-Admin-Key"] = adminKey;
  } else if (authHeader) {
    headers.Authorization = authHeader;
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

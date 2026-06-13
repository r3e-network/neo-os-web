import crypto from "crypto";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";

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

/**
 * Centralized request timeouts (ms) for proxying to the upstream host-app.
 *
 * These named constants replace the scattered numeric literals previously
 * inlined in every route. The values are unchanged — only their definition
 * site moved — so the observable abort behaviour of each route is preserved.
 */
export const HOST_PROXY_TIMEOUTS = {
  /** Fast, low-payload endpoints (definition preview, batch import). */
  SHORT: 10_000,
  /** Default for catalog/list/status reads and upserts. */
  STANDARD: 15_000,
  /** Review/audit/media/template-market endpoints with heavier upstream work. */
  EXTENDED: 20_000,
} as const;

export interface ProxyToHostOptions {
  /** Already-resolved, non-empty host-app base URL (caller validates first). */
  hostAppBaseURL: string;
  /** Upstream path, e.g. "/api/miniapps/catalog". */
  path: string;
  /** HTTP method for the upstream call (default "GET"). */
  method?: string;
  /**
   * Query parameters to append. Only entries with a non-null/undefined value
   * are set, matching the existing per-route conditional `set(...)` calls.
   */
  searchParams?: Record<string, string | undefined | null>;
  /** Request body object; JSON-stringified when present. */
  body?: unknown;
  /** Abort timeout in ms. */
  timeoutMs: number;
  /** Message returned by the 502 catch when the host is unreachable. */
  fallbackError: string;
  /**
   * Fallback message used when the upstream returns a non-OK status. When
   * `parseHostError` is true (default) it is passed to `parseHostErrorPayload`;
   * otherwise it is returned verbatim via `jsonError(notOkError, status)`.
   */
  notOkError: string;
  /**
   * Whether to extract the upstream error message via `parseHostErrorPayload`.
   * Defaults to true. Set false for routes that emit a fixed error literal.
   */
  parseHostError?: boolean;
  /** Value substituted when the success-body JSON parse fails. Defaults to {}. */
  parseFallback?: unknown;
  /** Log prefix used in the JSON-parse warning, e.g. "[miniapps]". */
  logLabel: string;
  /**
   * Transform applied to the successfully-parsed body to produce the final
   * Response. When omitted, the route returns `NextResponse.json(data, {
   * status: response.status })`, matching the common pass-through routes.
   */
  onSuccess?: (data: unknown, response: Response) => Response;
}

/**
 * Proxy an admin-console request to the upstream host-app, centralizing the
 * boilerplate shared by the `/api/miniapps/*` routes: URL build → fetch with
 * injected proxy headers + timeout → non-OK error mapping → JSON-parse with a
 * per-route fallback → 502 catch on transport failure.
 *
 * The caller is responsible for auth, base-URL resolution/validation, and zod
 * input validation; per-route success shaping is supplied via `onSuccess`.
 */
export async function proxyToHost(req: Request, options: ProxyToHostOptions): Promise<Response> {
  const {
    hostAppBaseURL,
    path,
    method = "GET",
    searchParams,
    body,
    timeoutMs,
    fallbackError,
    notOkError,
    parseHostError = true,
    parseFallback = {},
    logLabel,
    onSuccess,
  } = options;

  try {
    const upstream = new URL(path, hostAppBaseURL);
    if (searchParams) {
      for (const [key, value] of Object.entries(searchParams)) {
        if (value !== undefined && value !== null) {
          upstream.searchParams.set(key, value);
        }
      }
    }

    const init: RequestInit = {
      method,
      headers: createProxyHeaders(req),
      signal: AbortSignal.timeout(timeoutMs),
    };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }

    const response = await fetch(upstream.toString(), init);

    if (!response.ok) {
      if (parseHostError) {
        const message = await parseHostErrorPayload(response, notOkError);
        return jsonError(message, response.status);
      }
      return jsonError(notOkError, response.status);
    }

    const data = await response.json().catch((e: unknown) => {
      console.warn(`${logLabel} failed to parse response JSON:`, e instanceof Error ? e.message : String(e));
      return parseFallback;
    });

    if (onSuccess) {
      return onSuccess(data, response);
    }
    return NextResponse.json(data, { status: response.status });
  } catch {
    return jsonError(fallbackError, 502);
  }
}

export const DEFAULT_FETCH_TIMEOUT_MS = 10_000;

export type ApiError = {
  message: string;
  code?: string;
};

export class RequestError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code = "HTTP_ERROR", status = 0) {
    super(message);
    this.name = "RequestError";
    this.code = code;
    this.status = status;
  }
}

function isRequest(value: RequestInfo | URL): value is Request {
  return typeof Request !== "undefined" && value instanceof Request;
}

function shouldAttachWalletToken(input: RequestInfo | URL): boolean {
  if (typeof window === "undefined") return false;
  try {
    const rawUrl = isRequest(input)
      ? input.url
      : input instanceof URL
        ? input.toString()
        : String(input);
    const url = new URL(rawUrl, window.location.origin);
    return (
      url.origin === window.location.origin && url.pathname.startsWith("/api/")
    );
  } catch (_e: unknown) {
    return false;
  }
}

function readWalletSessionToken(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.sessionStorage.getItem("sb-access-token")?.trim() || "";
  } catch (_e: unknown) {
    return "";
  }
}

function applyDefaultHeaders(
  input: RequestInfo | URL,
  init?: RequestInit,
): RequestInit {
  const token = shouldAttachWalletToken(input) ? readWalletSessionToken() : "";
  const inputIsRequest = isRequest(input);
  if (!inputIsRequest && !token) return init || {};

  const headers = new Headers(inputIsRequest ? input.headers : undefined);
  new Headers(init?.headers).forEach((value, key) => headers.set(key, value));

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return { ...init, headers };
}

function applyDefaultSignal(
  input: RequestInfo | URL,
  init?: RequestInit,
): RequestInit {
  const withHeaders = applyDefaultHeaders(input, init);
  if (withHeaders.signal) return withHeaders;
  return {
    ...withHeaders,
    signal: AbortSignal.timeout(DEFAULT_FETCH_TIMEOUT_MS),
  };
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

async function parseJSONSafe(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch (_e: unknown) {
    console.warn(
      "[fetch-client] failed to parse JSON response:",
      _e instanceof Error ? _e.message : String(_e),
    );
    return null;
  }
}

function toRequestError(res: Response, payload: unknown): RequestError {
  const obj = asObject(payload);
  const message =
    (typeof obj?.error === "string" && obj.error) ||
    (typeof obj?.message === "string" && obj.message) ||
    `HTTP ${res.status || 0}: ${res.statusText || "Request failed"}`;

  const code = (typeof obj?.code === "string" && obj.code) || "HTTP_ERROR";
  return new RequestError(message, code, res.status || 0);
}

export async function fetchJSON<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(input, applyDefaultSignal(input, init));
  const payload = await parseJSONSafe(res);
  if (!res.ok) {
    throw toRequestError(res, payload);
  }
  return payload as T;
}

export async function fetchOK(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<void> {
  const res = await fetch(input, applyDefaultSignal(input, init));
  if (res.ok) return;
  throw toRequestError(res, await parseJSONSafe(res));
}

export function toApiError(
  err: unknown,
  fallbackCode = "NETWORK_ERROR",
): ApiError {
  if (err instanceof RequestError) {
    return { message: err.message, code: err.code };
  }
  if (err instanceof Error) {
    return { message: err.message || "Network error", code: fallbackCode };
  }
  return { message: "Network error", code: fallbackCode };
}

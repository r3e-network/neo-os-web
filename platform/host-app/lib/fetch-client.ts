export const DEFAULT_FETCH_TIMEOUT_MS = 30_000;

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

function applyDefaultSignal(init?: RequestInit): RequestInit {
  if (init?.signal) return init;
  return {
    ...init,
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
  } catch {
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

export async function fetchJSON<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, applyDefaultSignal(init));
  const payload = await parseJSONSafe(res);
  if (!res.ok) {
    throw toRequestError(res, payload);
  }
  return payload as T;
}

export async function fetchOK(input: RequestInfo | URL, init?: RequestInit): Promise<void> {
  const res = await fetch(input, applyDefaultSignal(init));
  if (res.ok) return;
  throw toRequestError(res, await parseJSONSafe(res));
}

export function toApiError(err: unknown, fallbackCode = "NETWORK_ERROR"): ApiError {
  if (err instanceof RequestError) {
    return { message: err.message, code: err.code };
  }
  if (err instanceof Error) {
    return { message: err.message || "Network error", code: fallbackCode };
  }
  return { message: "Network error", code: fallbackCode };
}

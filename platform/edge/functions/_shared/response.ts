import { withCors } from "./cors.ts";

export function json(data: unknown, init: ResponseInit = {}, req?: Request): Response {
  const headers = withCors(init.headers, req);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Content-Security-Policy", "default-src 'none'");
  let body: string;
  try {
    body = JSON.stringify(data);
  } catch (_e: unknown) {
    body = String(data);
  }
  return new Response(body, { ...init, headers });
}

/**
 * Build a JSON error response.
 *
 * When a `correlationId` is supplied it is echoed back to the caller in two
 * additive places — the top-level `requestId` and `error.requestId` — so a
 * user-reported failure can be matched to the structured server log line that
 * carries the same id. The field is additive only; existing
 * `error: { code, message }` consumers are unaffected.
 */
export function error(
  status: number,
  message: string,
  code = "ERROR",
  req?: Request,
  correlationId?: string,
): Response {
  const body: Record<string, unknown> = { error: { code, message } };
  if (correlationId) {
    body.requestId = correlationId;
    (body.error as Record<string, unknown>).requestId = correlationId;
  }
  return json(body, { status }, req);
}

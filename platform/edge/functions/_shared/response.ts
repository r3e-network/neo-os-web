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

export function error(status: number, message: string, code = "ERROR", req?: Request): Response {
  return json({ error: { code, message } }, { status }, req);
}

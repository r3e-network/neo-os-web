import { withCors } from "./cors.ts";

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = withCors(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function error(status: number, message: string, code = "ERROR"): Response {
  return json({ error: { code, message } }, { status });
}


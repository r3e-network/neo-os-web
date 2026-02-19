import { error } from "./response.ts";

const MAX_BODY_BYTES = 1024 * 1024; // 1 MB

export async function readJsonBody<T = unknown>(req: Request, maxBytes = MAX_BODY_BYTES): Promise<T | Response> {
  const ct = (req.headers.get("content-type") ?? "").toLowerCase();
  if (ct && !ct.includes("application/json")) {
    return error(415, "Content-Type must be application/json", "UNSUPPORTED_MEDIA_TYPE", req);
  }
  const cl = req.headers.get("content-length");
  if (cl && parseInt(cl, 10) > maxBytes) {
    return error(413, "request body too large", "PAYLOAD_TOO_LARGE", req);
  }
  try {
    return await req.json() as T;
  } catch {
    return error(400, "invalid JSON", "INVALID_INPUT", req);
  }
}

import { error } from "./response.ts";

const MAX_BODY_BYTES = 1024 * 1024; // 1 MB

// Read the request body with a hard byte cap. Content-Length is only a
// fast-path pre-check — clients can omit it (chunked encoding) or lie, so
// the stream itself is the enforcement point (audit low).
async function readBodyTextWithCap(req: Request, maxBytes: number): Promise<string | null> {
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        try {
          await reader.cancel();
        } catch { /* best effort */ }
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(out);
}

export async function readJsonBody<T = unknown>(req: Request, maxBytes = MAX_BODY_BYTES): Promise<T | Response> {
  const ct = (req.headers.get("content-type") ?? "").toLowerCase();
  if (ct && !ct.includes("application/json")) {
    return error(415, "Content-Type must be application/json", "UNSUPPORTED_MEDIA_TYPE", req);
  }
  // Fast path: reject an over-cap declared length before reading anything.
  const cl = req.headers.get("content-length");
  if (cl && parseInt(cl, 10) > maxBytes) {
    return error(413, "request body too large", "PAYLOAD_TOO_LARGE", req);
  }
  const text = await readBodyTextWithCap(req, maxBytes);
  if (text === null) {
    return error(413, "request body too large", "PAYLOAD_TOO_LARGE", req);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return error(400, "invalid JSON", "INVALID_INPUT", req);
  }
}

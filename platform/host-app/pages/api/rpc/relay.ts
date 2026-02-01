import type { NextApiRequest, NextApiResponse } from "next";
import { forwardEdgeRpcHeaders, getEdgeFunctionsBaseUrl, isEdgeRpcAllowed } from "../../../lib/edge";

/** Parsed JSON body with optional function name fields */
interface RPCJsonBody {
  fn?: string;
  function?: string;
  name?: string;
  [key: string]: unknown;
}

async function readRawBody(req: NextApiRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => resolve());
    req.on("error", reject);
  });
  return Buffer.concat(chunks);
}

function extractFnFromJsonBody(rawBody: Buffer | undefined, contentType: string) {
  if (!rawBody || !contentType.toLowerCase().includes("application/json")) return null;
  try {
    const parsed: RPCJsonBody = JSON.parse(rawBody.toString("utf8"));
    if (!parsed || typeof parsed !== "object") return null;
    const fn = String(parsed.fn ?? parsed.function ?? parsed.name ?? "").trim();
    if (!fn) return null;
    if (!Array.isArray(parsed)) {
      delete parsed.fn;
      delete parsed.function;
      delete parsed.name;
    }
    const nextBody = JSON.stringify(parsed);
    return { fn, body: new Uint8Array(Buffer.from(nextBody)) };
  } catch {
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  let fn = String(req.query.fn ?? "").trim();
  const base = getEdgeFunctionsBaseUrl();
  if (!base) {
    res.status(500).json({ error: "EDGE_BASE_URL (or NEXT_PUBLIC_SUPABASE_URL) not configured" });
    return;
  }

  const method = String(req.method || "GET").toUpperCase();
  const hasBody = !(method === "GET" || method === "HEAD");
  const rawBody = hasBody ? await readRawBody(req) : undefined;
  const contentType = String(req.headers["content-type"] ?? "");
  let body = rawBody ? new Uint8Array(rawBody) : undefined;

  if (!fn && rawBody) {
    const extracted = extractFnFromJsonBody(rawBody, contentType);
    if (extracted) {
      fn = extracted.fn;
      body = extracted.body;
    }
  }

  if (!fn) {
    res.status(400).json({ error: "function name required" });
    return;
  }
  if (!isEdgeRpcAllowed(fn)) {
    res.status(403).json({ error: "function not allowed" });
    return;
  }

  const url = new URL(`${base}/${encodeURIComponent(fn)}`);
  for (const [key, value] of Object.entries(req.query)) {
    if (key === "fn") continue;
    if (Array.isArray(value)) {
      for (const v of value) url.searchParams.append(key, String(v));
    } else if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  const headers = forwardEdgeRpcHeaders(req);

  const upstream = await fetch(url.toString(), {
    method,
    headers,
    body,
  });

  res.status(upstream.status);
  upstream.headers.forEach((value, key) => {
    if (key === "transfer-encoding" || key === "connection") return;
    res.setHeader(key, value);
  });

  const buf = Buffer.from(await upstream.arrayBuffer());
  res.send(buf);
}

export const config = {
  api: { bodyParser: false },
};
